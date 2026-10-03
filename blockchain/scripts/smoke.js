// Post-deployment smoke checks — read-only, no state changes.
// Usage: npx hardhat run scripts/smoke.js --network <arcTestnet|arc>
// Reads ./deployments/<network>_deployment.json written by deployTestnet.js.
//
// The rail's invariants are structural, so the checks below are the ones an
// auditor asks first: is principal custodiable at all, can fees reach beyond
// accrued, and are the pools separated?
const { ethers, network } = require("hardhat");
const fs = require("fs");

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const file = `./deployments/${network.name}_deployment.json`;
  if (!fs.existsSync(file)) {
    console.error(`No deployment manifest at ${file} — deploy first.`);
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(file));

  console.log(`\n🔍 Smoke checks: ${d.network} (chain ${d.chainId})`);
  console.log(`   rail:     ${d.contracts.LiquidityRail}`);
  console.log(`   impl:     ${d.contracts.LiquidityRailImpl}`);
  console.log(`   registry: ${d.contracts.HackathonRegistry}`);
  console.log(`   admin:    ${d.admin}`);
  console.log(`   fees to:  ${d.feeRecipient}\n`);

  const rail = await ethers.getContractAt("LiquidityRail", d.contracts.LiquidityRail);
  const registry = await ethers.getContractAt("HackathonRegistry", d.contracts.HackathonRegistry);

  // ── Wiring ───────────────────────────────────────────────────────────
  check("registry pointer matches deployment", (await rail.registry()) === d.contracts.HackathonRegistry);
  check(
    "usdcToken pointer matches deployment",
    (await rail.usdcToken()) === d.usdcAddress,
    await rail.usdcToken()
  );

  const usdcCode = await ethers.provider.getCode(d.usdcAddress);
  check("USDC contract exists at configured address", usdcCode !== "0x");

  const implCode = await ethers.provider.getCode(d.contracts.LiquidityRailImpl);
  check("implementation has code", implCode !== "0x");

  const adminRole = await rail.DEFAULT_ADMIN_ROLE();
  const feeRole = await rail.FEE_ROLE();
  check("admin holds DEFAULT_ADMIN_ROLE", await rail.hasRole(adminRole, d.admin), d.admin);
  check("fee recipient holds FEE_ROLE", await rail.hasRole(feeRole, d.feeRecipient), d.feeRecipient);

  // ── Invariant 2: fees are the only withdrawable balance ──────────────
  check(
    "no principal custodiable on a fresh deploy (invariant 1)",
    (await rail.totalLoanPrincipal()).isZero()
  );
  check("no accrued fees on a fresh deploy", (await rail.accruedFees()).isZero());
  check("no residual collateral", (await rail.totalCollateral()).isZero());
  check("no bet stakes (pools start empty)", (await rail.totalBetStakes()).isZero());

  // A non-FEE_ROLE caller must be rejected. This is the direct test that
  // withdrawFees can never be reached by a stray key. Pick a signer that is
  // NOT the fee recipient — on a default deploy they are the same account, and
  // the call would legitimately succeed.
  const signers = await ethers.getSigners();
  const stranger =
    signers.find((s) => s.address.toLowerCase() !== d.feeRecipient.toLowerCase()) ||
    signers[0];
  try {
    await rail.connect(stranger).withdrawFees(stranger.address, 1);
    check("withdrawFees rejects non-FEE_ROLE caller", false, "call succeeded");
  } catch (err) {
    const msg = err.message || "";
    check(
      "withdrawFees rejects non-FEE_ROLE caller",
      msg.includes("missing role") || msg.includes("AccessControl"),
      "AccessControl"
    );
  }

  // ── Bounds initialized ───────────────────────────────────────────────
  const maxLoanSize = await rail.maxLoanSize();
  check("maxLoanSize initialized", maxLoanSize.gt(0), `${maxLoanSize} wei`);
  const maxRateBps = await rail.maxRateBps();
  check("maxRateBps initialized", maxRateBps.gt(0), `${maxRateBps} bps`);
  const maxDuration = await rail.maxLoanDuration();
  check("maxLoanDuration initialized", maxDuration.gt(0), `${maxDuration}s`);

  // ── No admin-assigned reputation (invariant 4) ───────────────────────
  const fnNames = rail.interface.fragments
    .filter((f) => f.type === "function")
    .map((f) => (f.name || "").toLowerCase());
  const reputationSetters = fnNames.filter(
    (n) => /set.*(reputation|credibility|score)/.test(n)
  );
  check(
    "no reputation setter exists (credibility is derived)",
    reputationSetters.length === 0,
    reputationSetters.length ? reputationSetters.join(", ") : "none"
  );

  // ── Registry credibility anchor ──────────────────────────────────────
  check("hackathon #1 exists", await registry.hackathonExists(1));
  check("hackathon #1 has a threshold", (await registry.getRequiredSignatures(1)).gt(0));
  check(
    "registry exposes winner declarations (credibility anchor)",
    typeof registry.getWinnerDeclarations === "function"
  );

  // ── Pause state ──────────────────────────────────────────────────────
  check("rail not paused", !(await rail.paused()));

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n${failed.length === 0 ? "🎉" : "💥"} ${checks.length - failed.length}/${checks.length} checks passed`
  );
  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  ❌ ${f.name}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("💥 Smoke run failed:", e);
    process.exit(1);
  });