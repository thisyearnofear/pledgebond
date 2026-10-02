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

  // Deploy BuilderCreditCore implementation
  console.log("\n🏗️ Deploying BuilderCreditCore implementation...");
  const BuilderCreditCore = await ethers.getContractFactory("BuilderCreditCore");
  const impl = await BuilderCreditCore.deploy();
  await impl.deployed();
  console.log(`✅ Implementation deployed to: ${impl.address}`);

  // Encode the initialize call
  const initData = impl.interface.encodeFunctionData("initialize", [
    hackathonRegistry.address,
    usdcAddress,
    deployer.address,
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

  // Wrap the proxy as BuilderCreditCore for verification calls
  const builderCreditCore = BuilderCreditCore.attach(proxy.address);

  // Verify deployment
  const storedRegistry = await builderCreditCore.registry();
  const storedToken = await builderCreditCore.usdcToken();
  console.log(`\n🔍 Verification:`);
  console.log(`   registry: ${storedRegistry}`);
  console.log(`   usdcToken: ${storedToken}`);
  console.log(`   admin role: ${await builderCreditCore.hasRole(await builderCreditCore.DEFAULT_ADMIN_ROLE(), deployer.address)}`);

  console.log("\n⏳ Waiting for confirmations...");
  await hackathonRegistry.deployTransaction.wait(3);
  await proxy.deployTransaction.wait(3);

  // Setup sample hackathon
  console.log("\n⚙️ Setting up initial configuration...");
  const now = Math.floor(Date.now() / 1000);
  const tx1 = await hackathonRegistry.createHackathon(
    "Agentic Economy on Arc",
    deployer.address,
    [deployer.address],
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
    contracts: {
      HackathonRegistry: hackathonRegistry.address,
      BuilderCreditCore: proxy.address,
      BuilderCreditCoreImpl: impl.address,
    },
    deployer: deployer.address,
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
  console.log(`🏗️ BuilderCreditCore (proxy): ${proxy.address}`);
  console.log(`🔧 BuilderCreditCore (impl): ${impl.address}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (chainId === 5042002 || chainId === 5042) {
    const suffix = chainId === 5042 ? "_MAINNET" : "";
    console.log(`\n📝 BUILDER_CREDIT_ARC${suffix}_ADDRESS=${proxy.address}`);
    console.log(`HACKATHON_REGISTRY_ARC${suffix}_ADDRESS=${hackathonRegistry.address}`);
  }

  return { hackathonRegistry: hackathonRegistry.address, builderCreditCore: proxy.address, usdcAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  });
