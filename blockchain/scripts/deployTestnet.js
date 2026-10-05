const { ethers, network } = require("hardhat");
const fs = require("fs");

// Native USDC ERC-20 interface on Arc is the same system address on
// testnet and mainnet; other entries are per-chain USDC deployments.
const USDC_ADDRESSES = {
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  44787: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
  59141: "0xFEce4462D57bD51A6A552365A011b95f0E16d9B7",
  5042002: "0x3600000000000000000000000000000000000000",
  5042: "0x3600000000000000000000000000000000000000",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = network.config.chainId;
  const networkName = network.name;

  console.log(`\n🚀 Deploying to ${networkName} (Chain ID: ${chainId})`);
  console.log(`📝 Deploying contracts with account: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`💰 Account balance: ${ethers.utils.formatEther(balance)} ETH`);

  const usdcAddress = USDC_ADDRESSES[chainId];
  if (!usdcAddress) {
    console.error(`❌ USDC address not found for chain ID ${chainId}`);
    process.exit(1);
  }
  console.log(`🏦 Using USDC address: ${usdcAddress}`);

  // Deploy HackathonRegistry
  console.log("\n📋 Deploying HackathonRegistry...");
  const HackathonRegistry = await ethers.getContractFactory("HackathonRegistry");
  const hackathonRegistry = await HackathonRegistry.deploy();
  await hackathonRegistry.deployed();
  console.log(`✅ HackathonRegistry deployed to: ${hackathonRegistry.address}`);

  // Deploy LiquidityRail implementation
  console.log("\n🏗️ Deploying LiquidityRail implementation...");
  const LiquidityRail = await ethers.getContractFactory("LiquidityRail");
  const impl = await LiquidityRail.deploy();
  await impl.deployed();
  console.log(`✅ Implementation deployed to: ${impl.address}`);

  // Admin can differ from the deployer: set ADMIN_ADDRESS to a multisig so
  // upgrade/pause/treasury powers never sit on the hot deploy key.
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;
  if (adminAddress === deployer.address && chainId === 5042) {
    console.warn(
      "⚠️  ADMIN_ADDRESS not set — deployer key will hold admin roles on mainnet."
    );
  }
  console.log(`🔐 Contract admin: ${adminAddress}`);

  // Fee recipient: where origination fees are withdrawn. Defaults to the admin
  // so a first deployment doesn't strand revenue.
  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS || adminAddress;
  console.log(`💸 Fee recipient: ${feeRecipient}`);

  // Encode the initialize call
  const initData = impl.interface.encodeFunctionData("initialize", [
    hackathonRegistry.address,
    usdcAddress,
    adminAddress,
    feeRecipient,
  ]);

  // Deploy ERC1967 proxy manually using the ERC1967Proxy artifact from upgrades-core
  console.log("📦 Deploying ERC1967 proxy...");
  const proxyArtifact = require("@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json");
  const proxyFactory = new ethers.ContractFactory(
    proxyArtifact.abi,
    proxyArtifact.bytecode,
    deployer
  );
  const proxy = await proxyFactory.deploy(impl.address, initData);
  await proxy.deployed();
  console.log(`✅ Proxy deployed to: ${proxy.address}`);

  // Wrap the proxy as LiquidityRail for verification calls
  const rail = LiquidityRail.attach(proxy.address);

  // Verify deployment
  const storedRegistry = await rail.registry();
  const storedToken = await rail.usdcToken();
  console.log(`\n🔍 Verification:`);
  console.log(`   registry: ${storedRegistry}`);
  console.log(`   usdcToken: ${storedToken}`);
  console.log(`   admin role: ${await rail.hasRole(await rail.DEFAULT_ADMIN_ROLE(), adminAddress)}`);
  console.log(`   fee role: ${await rail.hasRole(await rail.FEE_ROLE(), feeRecipient)}`);
  console.log(`   maxLoanSize: ${await rail.maxLoanSize()}`);

  console.log("\n⏳ Waiting for confirmations...");
  await hackathonRegistry.deployTransaction.wait(3);
  await proxy.deployTransaction.wait(3);

  // Setup sample hackathon
  console.log("\n⚙️ Setting up initial configuration...");
  const now = Math.floor(Date.now() / 1000);
  // Seed hackathon ownership follows the admin, not the deployer: a host set to
  // the hot deploy key would leave the seeded hackathon administered by a key
  // that should hold no powers.
  const tx1 = await hackathonRegistry.createHackathon(
    "Agentic Economy on Arc",
    adminAddress,
    [adminAddress],
    1,
    now,
    now + 7 * 24 * 60 * 60
  );
  await tx1.wait();
  console.log("✅ Test hackathon created");

  // Save deployment info
  const deploymentInfo = {
    network: networkName,
    chainId: chainId,
    usdcAddress: usdcAddress,
    contractVersion: "3.0.0",
    contracts: {
      LiquidityRail: proxy.address,
      LiquidityRailImpl: impl.address,
      HackathonRegistry: hackathonRegistry.address,
    },
    deployer: deployer.address,
    admin: adminAddress,
    feeRecipient,
    deploymentTime: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
    proxyKind: "uups",
  };

  const deploymentFile = `./deployments/${networkName}_deployment.json`;
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Deployment info saved to ${deploymentFile}`);

  console.log("\n🎉 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Network: ${networkName} (${chainId})`);
  console.log(`🏦 USDC Address: ${usdcAddress}`);
  console.log(`📋 HackathonRegistry: ${hackathonRegistry.address}`);
  console.log(`🏗️ LiquidityRail (proxy): ${proxy.address}`);
  console.log(`🔧 LiquidityRail (impl): ${impl.address}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (chainId === 5042002) {
    console.log("\n📝 Frontend env (tokens.js carries this as the testnet fallback):");
    console.log(`NEXT_PUBLIC_LIQUIDITY_RAIL_TESTNET_ADDRESS=${proxy.address}`);
    console.log(`NEXT_PUBLIC_HACKATHON_REGISTRY_TESTNET_ADDRESS=${hackathonRegistry.address}`);
  } else if (chainId === 5042) {
    console.log("\n📝 Set these env vars to point the app at this deployment:");
    console.log(`NEXT_PUBLIC_LIQUIDITY_RAIL_ADDRESS=${proxy.address}`);
    console.log(`NEXT_PUBLIC_HACKATHON_REGISTRY_ADDRESS=${hackathonRegistry.address}`);
    console.log(`LIQUIDITY_RAIL_ADDRESS=${proxy.address}  # server allowlist (RealCircleService)`);
  }

  return { hackathonRegistry: hackathonRegistry.address, liquidityRail: proxy.address, usdcAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  });
