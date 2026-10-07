// Phase-1 rehearsal: one real bridge loan + one resolved payout market, start
// to finish, on Arc Testnet with four genuinely separate parties.
//
//   organizer = deployer host key   (PRIVATE_KEY)     — declares the winner, pays the prize, records the payout
//   builder   = BUILDER_PRIVATE_KEY — declares the win on the rail, repays out of the prize
//   lender    = LENDER_PRIVATE_KEY  — funds principal + collateral, gets repaid at par; also hedges the skeptic side of the market
//   bettor    = BETTOR_PRIVATE_KEY  — bets on the organizer paying, claims the pool pro-rata
//
// Usage: npx hardhat run scripts/demo-loan.js --network arcTestnet
// Idempotent-ish: tops demo wallets from the deployer when short, and sweeps
// funds back after settlement so the next take has runway.
const { ethers, network } = require("hardhat");
const fs = require("fs");

const USDC = (x) => ethers.utils.parseUnits(String(x), 6);
// Arc testnet USDC is faucet-change money; the amounts below only need to
// show the mechanics. Rehearsal notes: winIds 1-2 are permanently OPEN in
// this deployment (their collateral is locked for 30 days), so each fresh
// take lands on a new winId.
const PRIZE = USDC(0.6);
const PRINCIPAL = USDC(0.3);
const COLLATERAL = USDC(0.33); // > principal, per the rail's overcollateralized mode
const RATE_BPS = 500;
const TERM_DAYS = 30;
const BET = USDC(0.05); // each side of the payout market

let steps = 0;
function step(msg) {
  steps += 1;
  console.log(`\n[${steps}] ${msg}`);
}
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`    ✔ ${msg}`);
}

async function main() {
  const d = JSON.parse(
    fs.readFileSync(`./deployments/${network.name}_deployment.json`)
  );
  const usdc = await ethers.getContractAt("IERC20", d.usdcAddress);
  const rail = await ethers.getContractAt("LiquidityRail", d.contracts.LiquidityRail);
  const registry = await ethers.getContractAt("HackathonRegistry", d.contracts.HackathonRegistry);

  const organizer = (await ethers.getSigners())[0];
  const builder = new ethers.Wallet(process.env.BUILDER_PRIVATE_KEY, organizer.provider);
  const lender = new ethers.Wallet(process.env.LENDER_PRIVATE_KEY, organizer.provider);
  const bettor = new ethers.Wallet(process.env.BETTOR_PRIVATE_KEY, organizer.provider);
  const hackathonId = 1;

  console.log(`🎭 organizer ${organizer.address}`);
  console.log(`   builder   ${builder.address}`);
  console.log(`   lender    ${lender.address}`);
  console.log(`   bettor    ${bettor.address}`);
  console.log(`   rail      ${rail.address}`);

  const bal = async (w) => usdc.balanceOf(w.address);
  const fmt = (x) => ethers.utils.formatUnits(x, 6);

  // ── Funding (top up demo wallets when they can't cover their role) ──
  step("Funding wallets");
  const want = {
    [builder.address]: USDC(0.5),
    [lender.address]: COLLATERAL.add(PRINCIPAL).add(BET),
    [bettor.address]: BET.add(USDC(0.1)),
  };
  for (const [addr, min] of Object.entries(want)) {
    if ((await usdc.balanceOf(addr)).lt(min)) {
      const send = min.sub(await usdc.balanceOf(addr)).add(USDC(0.1));
      const t = await usdc.transfer(addr, send);
      await t.wait();
      console.log(`    ↳ organizer topped ${addr.slice(0, 10)}… with ${fmt(send)} USDC`);
    }
  }
  assert((await bal(lender)).gte(COLLATERAL.add(PRINCIPAL)), "lender can cover principal + collateral");
  assert((await bal(organizer)).gte(PRIZE), "organizer can pay the prize");

  // ── 1. Organizer declares the winner in the registry ──────────────────────
  step("registry.declareWinner (organizer)");
  await (await registry.declareWinner(hackathonId, builder.address, "Bridge Demo", PRIZE)).wait();

  // ── 2. Builder declares the win on the rail ───────────────────────────────
  step("rail.declareWin (builder)");
  const dw = rail.connect(builder);
  const declareTx = await dw.declareWin(hackathonId, builder.address, "Bridge Demo", PRIZE);
  const declareReceipt = await declareTx.wait();
  let winId;
  for (const log of declareReceipt.logs) {
    try {
      const p = rail.interface.parseLog(log);
      if (p.name === "WinDeclared") winId = p.args.winId;
    } catch {}
  }
  assert(winId !== undefined, "WinDeclared event parsed → winId " + winId);

  // ── 3. Lender funds the loan ──────────────────────────────────────────────
  step("rail.openLoan (lender funds principal + collateral)");
  const l = usdc.connect(lender);
  await (await l.approve(rail.address, ethers.constants.MaxUint256)).wait();
  await (await usdc.connect(builder).approve(rail.address, ethers.constants.MaxUint256)).wait();
  const before = { builder: await bal(builder), lender: await bal(lender) };
  const fee = PRINCIPAL.mul(RATE_BPS).div(10000);
  const collBefore = await rail.totalCollateral();
  await (await rail.connect(lender).openLoan(
    winId, PRINCIPAL, COLLATERAL, 0, ethers.constants.AddressZero, RATE_BPS, TERM_DAYS, 0
  )).wait();
  assert(
    (await bal(builder)).eq(before.builder.add(PRINCIPAL).sub(fee)),
    `builder received ${fmt(PRINCIPAL.sub(fee))} USDC (principal minus ${(RATE_BPS / 100).toFixed(0)}% fee)`
  );
  const loanRecord = await rail.loans(winId);
  assert(
    loanRecord.lender.toLowerCase() === lender.address.toLowerCase() &&
      loanRecord.collateral.eq(COLLATERAL) &&
      (await rail.totalCollateral()).eq(collBefore.add(COLLATERAL)),
    "rail booked lender = separate wallet, collateral escrowed from it (invariant: platform funded nothing)"
  );
  assert((await rail.accruedFees()).gte(fee), "platform revenue is exactly the fee");

  // ── 3b. Bettor market: two opposing stakes while the win is still DECLARED ─
  step("rail.placeBet (bettor bets 'paid', lender hedges 'unpaid')");
  for (const w of [bettor, lender]) {
    await (await usdc.connect(w).approve(rail.address, ethers.constants.MaxUint256)).wait();
  }
  const stakesBefore = await rail.totalBetStakes();
  const collAtBets = await rail.totalCollateral();
  await (await rail.connect(bettor).placeBet(winId, BET, true)).wait();
  await (await rail.connect(lender).placeBet(winId, BET, false)).wait();
  assert(
    (await rail.totalBetStakes()).eq(stakesBefore.add(BET.mul(2))),
    "bet pool grew by exactly the two stakes"
  );
  assert(
    (await rail.totalCollateral()).eq(collAtBets),
    "invariant: lending reserves untouched by betting — pools are separate"
  );
  const lenderMid = await bal(lender);

  // ── 4. Organizer pays the prize, then records the payout ──────────────────
  step("organizer pays the prize (real USDC transfer)");
  const prizeTx = await usdc.transfer(builder.address, PRIZE);
  await prizeTx.wait();
  step("registry.recordPayout (organizer)");
  await (await registry.recordPayout(hackathonId, builder.address, prizeTx.hash)).wait();

  // ── 5. Settle ─────────────────────────────────────────────────────────────
  step("rail.settleLoan (anyone)");
  const b2 = await bal(builder);
  await (await rail.settleLoan(winId)).wait();
  const loan = await rail.loans(winId);
  assert(Number(loan.status) === 2, "loan status = REPAID");
  assert((await bal(lender)).eq(lenderMid.add(PRINCIPAL)), "lender repaid at par");
  assert((await bal(builder)).eq(b2.add(COLLATERAL).sub(PRINCIPAL)), "builder repaid principal, collateral released back");
  const hist = await rail.builderHistory(builder.address);
  assert(hist.winsSettledInFull.gte(1), "credibility: ≥1 win settled in full, derived on-chain");

  // ── 6. Resolve the market and pay the winning side ────────────────────────
  step("rail.settleBet (anyone) — organizer paid, so the market resolves PAID");
  await (await rail.settleBet(winId)).wait();
  assert((await rail.betOutcome(winId)) === 1, "betOutcome = PAID (1)");

  step("rail.claimBet — winning side takes the whole pool");
  // Arc charges gas in USDC, so claimers net their payout minus gas. Assert
  // the payout the rail actually sent (BetClaimed event), not raw balances.
  const parseClaim = async (receipt) => {
    for (const log of receipt.logs) {
      try {
        const p = rail.interface.parseLog(log);
        if (p.name === "BetClaimed") return p.args.payout;
      } catch {}
    }
    return null;
  };
  const bettorClaim = await parseClaim(
    await (await rail.connect(bettor).claimBet(winId)).wait()
  );
  const lenderClaim = await parseClaim(
    await (await rail.connect(lender).claimBet(winId)).wait()
  );
  assert(
    bettorClaim && bettorClaim.eq(BET.mul(2)),
    `bettor claimed the full ${fmt(BET.mul(2))} USDC pool on a ${fmt(BET)} stake (2x)`
  );
  assert(lenderClaim && lenderClaim.eq(0), "losing side claimed exactly nothing");
  assert(
    (await rail.totalBetStakes()).gte(stakesBefore.add(BET.mul(2))),
    "bet pool accounting consistent with the stakes placed this run"
  );

  // ── Sweep so the next take has runway ─────────────────────────────────────
  step("Re-sweep funds toward the organizer");
  for (const w of [builder, lender, bettor]) {
    const available = (await bal(w)).sub(USDC(0.3));
    if (available.gt(0)) {
      await (await usdc.connect(w).transfer(organizer.address, available)).wait();
    }
  }

  console.log(`\n🎉 Bridge loan + payout market closed on ${network.name} — win #${winId}.`);
  console.log("   organizer declared & paid · builder declared & repaid · lender funded & recovered at par");
  console.log("   bettor won the market 2x · lender's losing hedge paid the pool");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
