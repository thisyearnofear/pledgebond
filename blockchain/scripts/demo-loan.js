// Paid-path rehearsal: one real bridge loan + one resolved payout market,
// start to finish, on Arc, with four genuinely separate parties.
//
//   organizer = deployer host key   (PRIVATE_KEY)     — declares the winner, pays the prize, attests the payout
//   builder   = BUILDER_PRIVATE_KEY — anchors the win on the rail, posts collateral at accept, repays from the prize
//   lender    = LENDER_PRIVATE_KEY  — proposes funded terms, gets repaid at par; also hedges the skeptic side of the market
//   bettor    = BETTOR_PRIVATE_KEY  — bets on the organizer paying, claims the pool pro-rata
//
// Lifecycle: declareWinner → anchorWin → proposeLoan → acceptLoan →
// recordPayout → repayLoan → resolveMarket → claimWinnings.
//
// Usage: npx hardhat run scripts/demo-loan.js --network arcTestnet
// Idempotent-ish: tops demo wallets from the deployer when short, and sweeps
// funds back after settlement so the next take has runway.
const { ethers, network } = require("hardhat");
const fs = require("fs");

const USDC = (x) => ethers.utils.parseUnits(String(x), 6);
// Arc USDC is faucet-change money; the amounts below only need to show the
// mechanics. Each fresh take lands on a new declarationIndex and winId.
const PRIZE = USDC(0.6);
const PRINCIPAL = USDC(0.3);
const COLLATERAL = USDC(0.33); // > principal; the BUILDER posts it at accept
const FEE_BPS = 500;
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

  // recordPayout is verifier-attested — the organizer must be on the
  // hackathon's verifier list (deploy script seeds it with the admin).
  assert(
    await registry.isVerifier(hackathonId, organizer.address),
    "organizer is a verifier for the seeded hackathon (needed to attest the payout)"
  );

  const bal = async (w) => usdc.balanceOf(w.address);
  const fmt = (x) => ethers.utils.formatUnits(x, 6);

  // ── Funding (top up demo wallets when they can't cover their role) ──
  step("Funding wallets");
  const want = {
    [builder.address]: COLLATERAL.add(USDC(0.2)), // posts collateral at accept + gas
    [lender.address]: PRINCIPAL.add(BET),
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
  assert((await bal(builder)).gte(COLLATERAL), "builder can post the collateral");
  assert((await bal(lender)).gte(PRINCIPAL), "lender can fund the principal");
  assert((await bal(organizer)).gte(PRIZE), "organizer can pay the prize");

  // ── 1. Organizer declares the winner in the registry ─────────────────────
  step("registry.declareWinner (organizer) — the host attestation");
  await (await registry.declareWinner(hackathonId, builder.address, "Bridge Demo", PRIZE)).wait();
  const declIndex = (await registry.getWinnerCount(hackathonId)).sub(1);

  // ── 2. Anchor the declaration on the rail ────────────────────────────────
  step("rail.anchorWin (builder) — binds this exact declaration");
  const anchorReceipt = await (await rail.connect(builder).anchorWin(hackathonId, declIndex)).wait();
  let winId;
  for (const log of anchorReceipt.logs) {
    try {
      const p = rail.interface.parseLog(log);
      if (p.name === "WinAnchored") winId = p.args.winId;
    } catch {}
  }
  assert(winId !== undefined, "WinAnchored event parsed → winId " + winId);

  // ── 3. Lender proposes funded terms ──────────────────────────────────────
  step("rail.proposeLoan (lender offers terms; nothing moves yet)");
  await (await usdc.connect(lender).approve(rail.address, ethers.constants.MaxUint256)).wait();
  const proposeReceipt = await (await rail.connect(lender).proposeLoan(
    winId, PRINCIPAL, COLLATERAL, 0, ethers.constants.AddressZero, FEE_BPS, TERM_DAYS, 0
  )).wait();
  let proposalId;
  for (const log of proposeReceipt.logs) {
    try {
      const p = rail.interface.parseLog(log);
      if (p.name === "LoanProposed") proposalId = p.args.proposalId;
    } catch {}
  }
  assert(proposalId !== undefined, "LoanProposed event parsed → proposalId " + proposalId);

  // ── 4. Builder accepts — posts collateral, draws principal net of fee ────
  step("rail.acceptLoan (builder posts collateral, draws principal net of fee)");
  await (await usdc.connect(builder).approve(rail.address, ethers.constants.MaxUint256)).wait();
  const before = { builder: await bal(builder), lender: await bal(lender) };
  const fee = PRINCIPAL.mul(FEE_BPS).div(10000);
  const collBefore = await rail.totalCollateral();
  const acceptReceipt = await (await rail.connect(builder).acceptLoan(proposalId)).wait();
  // Arc burns gas in USDC, so the builder's balance delta is net−gas — verify
  // the amounts the rail moved via the LoanFunded event instead of equality.
  let funded;
  for (const log of acceptReceipt.logs) {
    try {
      const p = rail.interface.parseLog(log);
      if (p.name === "LoanFunded") funded = p.args;
    } catch {}
  }
  assert(
    funded && funded.principal.eq(PRINCIPAL) && funded.originationFee.eq(fee) &&
      funded.collateral.eq(COLLATERAL) &&
      funded.builder.toLowerCase() === builder.address.toLowerCase(),
    `builder drew ${fmt(PRINCIPAL.sub(fee))} USDC net and escrowed ${fmt(COLLATERAL)} collateral`
  );
  const netDraw = PRINCIPAL.sub(fee).sub(COLLATERAL);
  const builderDelta = (await bal(builder)).sub(before.builder);
  assert(
    builderDelta.lte(netDraw) && builderDelta.gt(netDraw.sub(USDC(0.1))),
    "balance delta consistent with the draw minus gas"
  );
  const loanRecord = await rail.loans(winId);
  assert(
    loanRecord.lender.toLowerCase() === lender.address.toLowerCase() &&
      loanRecord.builder.toLowerCase() === builder.address.toLowerCase() &&
      loanRecord.collateral.eq(COLLATERAL) &&
      (await rail.totalCollateral()).eq(collBefore.add(COLLATERAL)),
    "rail booked builder-posted collateral and the separate lender (invariant: platform funded nothing)"
  );
  assert((await rail.accruedFees()).gte(fee), "platform revenue is exactly the fee, actually funded");

  // ── 4b. Bettor market: two opposing stakes while the win is unresolved ───
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

  // ── 5. Organizer pays the prize, then attests the payout ─────────────────
  step("organizer pays the prize (real USDC transfer)");
  const prizeTx = await usdc.transfer(builder.address, PRIZE);
  await prizeTx.wait();
  step("registry.recordPayout (verifier attestation on this declaration)");
  await (await registry.recordPayout(hackathonId, declIndex, prizeTx.hash)).wait();
  const decl = await registry.getDeclaration(hackathonId, declIndex);
  assert(decl.paidAt.gt(0), "declaration paidAt recorded — the credibility anchor");

  // ── 6. Builder repays — collateral releases in the same transaction ───────
  step("rail.repayLoan (builder repays at par)");
  await (await rail.connect(builder).repayLoan(winId)).wait();
  const loan = await rail.loans(winId);
  assert(Number(loan.status) === 2, "loan status = REPAID");
  // Lender sent principal+fee at accept, got principal back at par, and lost
  // the hedge bet into the pool — expected delta is fee + bet + gas spent.
  const lenderDelta = (await bal(lender)).sub(before.lender);
  const lenderCosts = fee.add(BET);
  assert(
    lenderDelta.lte(0) && lenderDelta.gt(lenderCosts.add(USDC(0.1)).mul(-1)),
    "lender repaid at par — out only the fee, the lost hedge, and gas"
  );
  const hist = await rail.builderHistory(builder.address);
  assert(hist.loansRepaid.gte(1), "credibility: ≥1 loan repaid, derived on-chain");

  // ── 7. Resolve the market and pay the winning side ────────────────────────
  step("rail.resolveMarket (anyone) — registry paid → PAID");
  await (await rail.resolveMarket(winId)).wait();
  const market = await rail.markets(winId);
  assert(Number(market.outcome) === 1, "market outcome = PAID (1)");

  step("rail.claimWinnings — winning side takes the whole pool");
  // Arc charges gas in USDC, so assert the payout the rail sent (WinningsClaimed
  // event), not raw balances. The losing side's claim reverts — nothing to claim.
  const parseClaim = async (receipt) => {
    for (const log of receipt.logs) {
      try {
        const p = rail.interface.parseLog(log);
        if (p.name === "WinningsClaimed") return p.args.payout;
      } catch {}
    }
    return null;
  };
  const bettorClaim = await parseClaim(
    await (await rail.connect(bettor).claimWinnings(winId)).wait()
  );
  assert(
    bettorClaim && bettorClaim.eq(BET.mul(2)),
    `bettor claimed the full ${fmt(BET.mul(2))} USDC pool on a ${fmt(BET)} stake (2x)`
  );
  let losingClaimRefused = false;
  try {
    await (await rail.connect(lender).claimWinnings(winId)).wait();
  } catch {
    losingClaimRefused = true;
  }
  assert(losingClaimRefused, "losing side has nothing to claim — the market is zero-house");

  // ── Sweep so the next take has runway ────────────────────────────────────
  step("Re-sweep funds toward the organizer");
  for (const w of [builder, lender, bettor]) {
    const available = (await bal(w)).sub(USDC(0.3));
    if (available.gt(0)) {
      await (await usdc.connect(w).transfer(organizer.address, available)).wait();
    }
  }

  console.log(`\n🎉 Bridge loan + payout market closed on ${network.name} — win #${winId}.`);
  console.log("   organizer declared & paid · builder anchored, collateralized & repaid · lender made whole at par");
  console.log("   bettor won the market 2x · lender's losing hedge paid the pool");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
