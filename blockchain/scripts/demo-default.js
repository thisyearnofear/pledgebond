// Phase-2 rehearsal: the default path, start to finish, on Arc Testnet.
//
// A lender funds a win that never gets paid. Two phases, because openLoan
// requires durationDays >= 1 and the testnet clock cannot be warped:
//
//   PHASE=1 (now)      declare → tranche-backed loan → bets placed
//   PHASE=2 (after dueAt) defaultLoan → market resolves UNPAID → claims
//
// Story: the organizer sponsors the first-loss tranche, so a default pays
// the lender 1:1 out of NAMED third-party capital (invariant 1 — the
// platform contributes nothing), the builder's default is recorded
// publicly in builderHistory (invariant 4), and the "doesn't pay" bettors
// take the pool.
//
// Usage:
//   PHASE=1 npx hardhat run scripts/demo-default.js --network arcTestnet
//   PHASE=2 npx hardhat run scripts/demo-default.js --network arcTestnet
const { ethers, network } = require("hardhat");
const fs = require("fs");

const USDC = (x) => ethers.utils.parseUnits(String(x), 6);
const PRIZE = USDC(0.6);
const PRINCIPAL = USDC(0.3);
const TRANCHE = PRINCIPAL; // first-loss cover >= principal
const BET = USDC(0.05); // each side of the payout market
const TERM_DAYS = 1;
const STATE_FILE = `./deployments/${network.name}_default_rehearsal.json`;

function step(msg) {
  step.n = (step.n || 0) + 1;
  console.log(`\n[${step.n}] ${msg}`);
}
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`    ✔ ${msg}`);
}

async function parseFrom(rail, tx, names) {
  const receipt = await tx.wait();
  const out = { receipt };
  for (const log of receipt.logs) {
    try {
      const railP = rail.interface.parseLog(log);
      if (railP && names.includes(railP.name)) out[railP.name] = railP.args;
    } catch {}
    try {
      const ercP = new ethers.utils.Interface(
        ["event Transfer(address indexed from,address indexed to,uint256 value)"]
      ).parseLog(log);
      if (ercP) (out.transfers = out.transfers || []).push(ercP.args);
    } catch {}
  }
  return out;
}

async function main() {
  const phase = process.env.PHASE || "1";
  const d = JSON.parse(fs.readFileSync(`./deployments/${network.name}_deployment.json`));
  const usdc = await ethers.getContractAt("IERC20", d.usdcAddress);
  const rail = await ethers.getContractAt("LiquidityRail", d.contracts.LiquidityRail);
  const registry = await ethers.getContractAt("HackathonRegistry", d.contracts.HackathonRegistry);

  const organizer = (await ethers.getSigners())[0];
  const builder = new ethers.Wallet(process.env.BUILDER_PRIVATE_KEY, organizer.provider);
  const lender = new ethers.Wallet(process.env.LENDER_PRIVATE_KEY, organizer.provider);
  const bettor = new ethers.Wallet(process.env.BETTOR_PRIVATE_KEY, organizer.provider);
  const hackathonId = 1; // same registry slot the paid demo uses

  console.log(`🎭 phase ${phase} on ${network.name}`);
  console.log(`   organizer ${organizer.address} (also the tranche provider)`);
  console.log(`   builder   ${builder.address}`);
  console.log(`   lender    ${lender.address}`);
  console.log(`   bettor    ${bettor.address}`);

  const bal = async (w) => usdc.balanceOf(w.address);
  const fmt = (x) => ethers.utils.formatUnits(x, 6);

  if (phase === "1") {
    step("Funding wallets");
    const want = {
      [builder.address]: USDC(0.1),
      [lender.address]: PRINCIPAL.add(BET),
      [bettor.address]: BET.add(USDC(0.1)),
      [organizer.address]: TRANCHE.add(USDC(0.2)),
    };
    for (const [addr, min] of Object.entries(want)) {
      if ((await usdc.balanceOf(addr)).lt(min)) {
        const send = min.sub(await usdc.balanceOf(addr)).add(USDC(0.1));
        await (await usdc.transfer(addr, send)).wait();
        console.log(`    ↳ organizer topped ${addr.slice(0, 10)}… with ${fmt(send)} USDC`);
      }
    }

    step("registry.declareWinner (organizer)");
    await (await registry.declareWinner(hackathonId, builder.address, "Default Rehearsal", PRIZE)).wait();

    step("rail.declareWin (builder)");
    const parsed = await parseFrom(
      rail,
      await rail.connect(builder).declareWin(hackathonId, builder.address, "Default Rehearsal", PRIZE),
      ["WinDeclared"]
    );
    const winId = parsed.WinDeclared.winId;
    assert(!winId.isZero(), "WinDeclared parsed → winId " + winId.toString());

    step("rail.openLoan TRANCHE_BACKED (lender funds; organizer commits first-loss)");
    await (await usdc.connect(lender).approve(rail.address, ethers.constants.MaxUint256)).wait();
    await (await usdc.connect(bettor).approve(rail.address, ethers.constants.MaxUint256)).wait();
    await (await usdc.connect(organizer).approve(rail.address, TRANCHE)).wait();
    const fee = PRINCIPAL.mul(500).div(10000);
    const before = { builder: await bal(builder), tranchePool: await rail.totalTrancheCapacity() };
    const openParsed = await parseFrom(
      rail,
      await rail.connect(lender).openLoan(
        winId, PRINCIPAL, 0, TRANCHE, organizer.address, 500, TERM_DAYS, 0
      ),
      ["LoanOpened"]
    );
    const dueAt = Number(openParsed.LoanOpened.dueAt);
    assert(
      (await bal(builder)).eq(before.builder.add(PRINCIPAL).sub(fee)),
      `builder received ${fmt(PRINCIPAL.sub(fee))} USDC (principal minus 5% fee)`
    );
    assert(
      (await rail.totalTrancheCapacity()).eq(before.tranchePool.add(TRANCHE)),
      "invariant: first-loss capital came from the organizer, not the lender and not the platform"
    );

    step("rail.placeBet (bettor bets 'paid', lender bets 'won't pay')");
    await (await rail.connect(bettor).placeBet(winId, BET, true)).wait();
    await (await rail.connect(lender).placeBet(winId, BET, false)).wait();
    assert((await rail.totalBetStakes()).gte(BET.mul(2)), "both sides staked; pool live");

    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ winId: winId.toString(), dueAt, hackathonId, startedAt: new Date().toISOString() }, null, 2)
    );
    const ready = new Date((dueAt + 60) * 1000).toISOString();
    console.log(`\n⏳ Phase 1 done — win #${winId}. The organizer will NOT pay this prize.`);
    console.log(`   Run phase 2 after the loan is overdue: PHASE=2 at/after ${ready}`);
    return;
  }

  // ── Phase 2 ───────────────────────────────────────────────────────────────
  const state = JSON.parse(fs.readFileSync(STATE_FILE));
  const winId = state.winId;
  const loan = await rail.loans(winId);
  assert(loan.status === 1, "loan still OPEN (phase 2 only)");
  assert(Number(loan.trancheProvider).toLowerCase() === organizer.address.toLowerCase(), "organizer is the tranche provider");

  step("Pre-check: no payout recorded, clock past dueAt");
  const histBefore = await rail.builderHistory(builder.address);
  const absorbedBefore = await rail.totalTrancheAbsorbed();
  const feesBefore = await rail.accruedFees();
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  assert(now >= loan.dueAt.toNumber(), `clock ${now} past dueAt ${loan.dueAt}`);

  step("rail.defaultLoan (permissionless after dueAt)");
  const defParsed = await parseFrom(
    rail,
    await rail.defaultLoan(winId),
    ["LoanDefaulted", "CollateralReleased"]
  );
  assert(defParsed.LoanDefaulted, "LoanDefaulted event emitted");
  const loan2 = await rail.loans(winId);
  const win2 = await rail.wins(winId);
  assert(loan2.status === 3 && win2.status === 3, "loan DEFAULTED and win DEFAULTED");
  assert(defParsed.CollateralReleased === undefined, "no collateral refund — this loan was tranche-backed");
  assert(
    (await rail.totalTrancheAbsorbed()).eq(absorbedBefore.add(TRANCHE)),
    `tranche consumed exactly ${fmt(TRANCHE)}`
  );
  const lenderTransfers = (defParsed.transfers || []).filter(
    (t) => t.to.toLowerCase() === lender.address.toLowerCase()
  );
  assert(
    lenderTransfers.some((t) => t.value.eq(TRANCHE)),
    `lender made whole with organizer's first-loss money (${fmt(TRANCHE)}), not platform money (invariant 1)`
  );
  assert((await rail.accruedFees()).eq(feesBefore), "platform revenue unchanged by the default");
  const histAfter = await rail.builderHistory(builder.address);
  assert(
    histAfter.winsDefaulted.gt(histBefore.winsDefaulted),
    "builder's public history records the default (invariant 4 — credibility from receipts)"
  );

  step("rail.settleBet — no payout in the registry, so the market resolves UNPAID");
  await (await rail.settleBet(winId)).wait();
  assert((await rail.betOutcome(winId)) === 2, "betOutcome = UNPAID (2)");

  step("rail.claimBet — 'won't pay' side takes the whole pool");
  const lenderClaim = await parseFrom(rail, await rail.connect(lender).claimBet(winId), ["BetClaimed"]);
  const bettorClaim = await parseFrom(rail, await rail.connect(bettor).claimBet(winId), ["BetClaimed"]);
  assert(
    lenderClaim.BetClaimed && lenderClaim.BetClaimed.payout.eq(BET.mul(2)),
    `lender claimed the full ${fmt(BET.mul(2))} pool on the ${fmt(BET)} losing-organization bet (2x)`
  );
  assert(bettorClaim.BetClaimed && bettorClaim.BetClaimed.payout.isZero(), "bettor's 'paid' side claimed exactly nothing");

  step("Tranche is gone — releaseTranche must refuse");
  let refused = false;
  try {
    await (await rail.connect(organizer).releaseTranche(winId)).wait();
  } catch {
    refused = true;
  }
  assert(refused, "consumed tranche cannot be released (it paid the lender)");

  step("Re-sweep funds toward the organizer");
  for (const w of [builder, lender, bettor]) {
    const available = (await bal(w)).sub(USDC(0.3));
    if (available.gt(0)) {
      await (await usdc.connect(w).transfer(organizer.address, available)).wait();
    }
  }
  fs.unlinkSync(STATE_FILE);

  console.log(`\n🎉 Default rehearsal complete on ${network.name} — win #${winId}.`);
  console.log("   unpaid prize → lender whole via named tranche capital → skeptic bettors paid 2x");
  console.log("   builder's default is now public on-chain history; the platform paid nothing.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
