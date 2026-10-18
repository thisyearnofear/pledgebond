// Default-path rehearsal: a funded win the organizer never pays, start to
// finish, on Arc.
//
//   PHASE=1 (now)      declare → anchor → tranche-backed offer → commit → accept → bets
//   PHASE=2 (after dueAt AND the market deadline) defaultLoan → resolveMarket UNPAID → claims
//
// Story: the organizer sponsors the first-loss tranche, so a default pays
// the lender 1:1 out of NAMED third-party capital (invariant 1 — the
// platform contributes nothing), the builder's default is recorded
// publicly in builderHistory (invariant 4), and the "doesn't pay" bettors
// take the pool.
//
// Timing note: the market resolves UNPAID on the win's resolutionDeadline —
// declaredAt + marketResolutionWindow, FROZEN at anchor. Phase 1 shrinks the
// global window to TERM_DAYS before anchoring so the demo can finish in days,
// not 90. That freeze is itself the invariant: no admin call can rewrite a
// live market's deadline.
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
      [builder.address]: USDC(0.1), // gas only — no collateral in tranche mode
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

    // Shrink the market window BEFORE anchoring — the deadline freezes into
    // the win at anchor time, so phase 2 can resolve in days. Only affects
    // wins anchored after this call.
    step("rail.setResolutionWindow — demo window = loan term");
    await (await rail.setResolutionWindow(TERM_DAYS * 24 * 60 * 60)).wait();

    step("registry.declareWinner (organizer)");
    await (await registry.declareWinner(hackathonId, builder.address, "Default Rehearsal", PRIZE)).wait();
    const declIndex = (await registry.getWinnerCount(hackathonId)).sub(1);

    step("rail.anchorWin (builder)");
    const parsed = await parseFrom(
      rail,
      await rail.connect(builder).anchorWin(hackathonId, declIndex),
      ["WinAnchored"]
    );
    const winId = parsed.WinAnchored.winId;
    assert(!winId.isZero(), "WinAnchored parsed → winId " + winId.toString());

    step("rail.proposeLoan TRANCHE_BACKED → organizer commitTranche → builder acceptLoan");
    await (await usdc.connect(lender).approve(rail.address, ethers.constants.MaxUint256)).wait();
    await (await usdc.connect(bettor).approve(rail.address, ethers.constants.MaxUint256)).wait();
    await (await usdc.connect(organizer).approve(rail.address, TRANCHE)).wait();
    const fee = PRINCIPAL.mul(500).div(10000);
    const before = { builder: await bal(builder), tranchePool: await rail.totalTrancheCapacity() };

    const propParsed = await parseFrom(
      rail,
      await rail.connect(lender).proposeLoan(
        winId, PRINCIPAL, 0, TRANCHE, organizer.address, 500, TERM_DAYS, 0
      ),
      ["LoanProposed"]
    );
    const proposalId = propParsed.LoanProposed.proposalId;
    assert(proposalId !== undefined, "LoanProposed → proposalId " + proposalId);

    await (await rail.connect(organizer).commitTranche(proposalId)).wait();
    await (await rail.connect(builder).acceptLoan(proposalId)).wait();

    const loan = await rail.loans(winId);
    const dueAt = loan.dueAt.toNumber();
    // Arc burns gas in USDC — the delta is draw−gas, not exactly draw.
    const netDraw = PRINCIPAL.sub(fee);
    const builderDelta = (await bal(builder)).sub(before.builder);
    assert(
      builderDelta.lte(netDraw) && builderDelta.gt(netDraw.sub(USDC(0.1))),
      `builder received ${fmt(netDraw)} USDC (principal minus 5% fee), less gas`
    );
    assert(
      (await rail.totalTrancheCapacity()).eq(before.tranchePool.add(TRANCHE)),
      "invariant: first-loss capital came from the organizer, not the lender and not the platform"
    );

    step("rail.placeBet (bettor bets 'paid', lender bets 'won't pay')");
    await (await rail.connect(bettor).placeBet(winId, BET, true)).wait();
    await (await rail.connect(lender).placeBet(winId, BET, false)).wait();
    assert((await rail.totalBetStakes()).gte(BET.mul(2)), "both sides staked; pool live");

    // Restore the global window — this win keeps its 1-day deadline (frozen
    // at anchor) but future wins should get the real 90-day window.
    await (await rail.setResolutionWindow(90 * 24 * 60 * 60)).wait();

    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(
        {
          winId: winId.toString(),
          proposalId: proposalId.toString(),
          declIndex: declIndex.toString(),
          dueAt,
          hackathonId,
          startedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    const ready = new Date((dueAt + 60) * 1000).toISOString();
    console.log(`\n⏳ Phase 1 done — win #${winId}. The organizer will NOT pay this prize.`);
    console.log(`   Run phase 2 after the loan is overdue: PHASE=2 at/after ${ready}`);
    return;
  }

  // ── Phase 2 ───────────────────────────────────────────────────────────────
  const state = JSON.parse(fs.readFileSync(STATE_FILE));
  const winId = state.winId;
  const proposalId = state.proposalId;
  const loan = await rail.loans(winId);
  assert(loan.status === 1, "loan still OPEN (phase 2 only)");
  assert(loan.trancheProvider.toLowerCase() === organizer.address.toLowerCase(), "organizer is the tranche provider");

  step("Pre-check: no payout recorded, clock past dueAt and the market deadline");
  const histBefore = await rail.builderHistory(builder.address);
  const absorbedBefore = await rail.totalTrancheAbsorbed();
  const feesBefore = await rail.accruedFees();
  const win = await rail.wins(winId);
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  assert(now >= loan.dueAt.toNumber(), `clock ${now} past dueAt ${loan.dueAt}`);
  assert(now >= win.resolutionDeadline.toNumber(), `clock ${now} past market deadline ${win.resolutionDeadline}`);

  step("rail.defaultLoan (permissionless after dueAt)");
  const defParsed = await parseFrom(
    rail,
    await rail.defaultLoan(winId),
    ["LoanDefaulted"]
  );
  assert(defParsed.LoanDefaulted, "LoanDefaulted event emitted");
  const loan2 = await rail.loans(winId);
  assert(loan2.status === 3, "loan DEFAULTED");
  assert(
    defParsed.LoanDefaulted.trancheToLender.eq(TRANCHE) &&
      defParsed.LoanDefaulted.collateralToLender.isZero(),
    "tranche paid the lender in full; there was no collateral to liquidate"
  );
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
    histAfter.loansDefaulted.gt(histBefore.loansDefaulted),
    "builder's public history records the default (invariant 4 — credibility from receipts)"
  );

  step("rail.resolveMarket — no payout in the registry, deadline passed → UNPAID");
  await (await rail.resolveMarket(winId)).wait();
  const market = await rail.markets(winId);
  assert(Number(market.outcome) === 2, "market outcome = UNPAID (2)");

  step("rail.claimWinnings — 'won't pay' side takes the whole pool");
  const lenderClaim = await parseFrom(rail, await rail.connect(lender).claimWinnings(winId), ["WinningsClaimed"]);
  assert(
    lenderClaim.WinningsClaimed && lenderClaim.WinningsClaimed.payout.eq(BET.mul(2)),
    `lender claimed the full ${fmt(BET.mul(2))} pool on the ${fmt(BET)} 'won't pay' bet (2x)`
  );
  let bettorRefused = false;
  try {
    await (await rail.connect(bettor).claimWinnings(winId)).wait();
  } catch {
    bettorRefused = true;
  }
  assert(bettorRefused, "bettor's 'paid' side has nothing to claim");

  step("Consumed tranche cannot be withdrawn — withdrawTranche must refuse");
  let refused = false;
  try {
    await (await rail.connect(organizer).withdrawTranche(proposalId)).wait();
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
