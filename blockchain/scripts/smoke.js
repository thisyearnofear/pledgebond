// Post-deployment smoke checks — read-only, no state changes.
// Usage: npx hardhat run scripts/smoke.js --network <arcTestnet|arc>
// Reads ./deployments/<network>_deployment.json written by deployTestnet.js.
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
  console.log(`   proxy: ${d.contracts.BuilderCreditCore}`);
  console.log(`   impl:  ${d.contracts.BuilderCreditCoreImpl}`);
  console.log(`   registry: ${d.contracts.HackathonRegistry}\n`);

  const core = await ethers.getContractAt(
    "BuilderCreditCore",
    d.contracts.BuilderCreditCore
  );
  const registry = await ethers.getContractAt(
    "HackathonRegistry",
    d.contracts.HackathonRegistry
  );

  // Proxy wiring
  check(
    "registry pointer matches deployment",
    (await core.registry()) === d.contracts.HackathonRegistry
  );
  check(
    "usdcToken pointer matches deployment",
    (await core.usdcToken()) === d.usdcAddress,
    await core.usdcToken()
  );

  // USDC actually deployed at the configured address
  const usdcCode = await ethers.provider.getCode(d.usdcAddress);
  check("USDC contract exists at configured address", usdcCode !== "0x");

  // Implementation actually deployed
  const implCode = await ethers.provider.getCode(
    d.contracts.BuilderCreditCoreImpl
  );
  check("implementation has code", implCode !== "0x");

  // Roles: deployer/admin wiring from initialize()
  const DEFAULT_ADMIN = await core.DEFAULT_ADMIN_ROLE();
  check(
    "admin holds DEFAULT_ADMIN_ROLE",
    await core.hasRole(DEFAULT_ADMIN, d.admin),
    d.admin
  );
  check(
    "admin holds PLATFORM_ADMIN_ROLE",
    await core.hasRole(await core.PLATFORM_ADMIN_ROLE(), d.admin)
  );
  check(
    "admin holds TREASURY_ROLE",
    await core.hasRole(await core.TREASURY_ROLE(), d.admin)
  );
  check(
    "admin holds SCORER_ROLE",
    await core.hasRole(await core.SCORER_ROLE(), d.admin)
  );

  // v2 storage: safety limits initialized
  const maxBacking = await core.maxBackingPerTx();
  check("maxBackingPerTx initialized", maxBacking.gt(0), `${maxBacking} wei`);
  const refundDelay = await core.backingRefundDelay();
  check(
    "backingRefundDelay initialized",
    refundDelay.gt(0),
    `${refundDelay}s`
  );
  const checkIn = await core.checkInInterval();
  check("checkInInterval initialized", checkIn.gt(0), `${checkIn}s`);

  // Credit parameters
  const maxCredit = await core.maxCreditAmount();
  check("maxCreditAmount initialized", maxCredit.gt(0), `${maxCredit} wei`);

  // Registry seeded hackathon (deploy script creates id 1)
  check("hackathon #1 exists", await registry.hackathonExists(1));
  check(
    "hackathon #1 has a threshold",
    (await registry.getRequiredSignatures(1)).gt(0)
  );

  // Pause state
  check("contract not paused", !(await core.paused()));

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n${failed.length === 0 ? "🎉" : "💥"} ${checks.length - failed.length}/${
      checks.length
    } checks passed`
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("💥 Smoke run failed:", e);
  process.exit(1);
});
