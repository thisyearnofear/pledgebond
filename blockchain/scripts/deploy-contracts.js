const { ethers, network } = require('hardhat');
const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);

  // USDC addresses for different networks
  const USDC_ADDRESSES = {
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum mainnet
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet
    42220: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // Celo mainnet
    59144: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", // Linea mainnet
    11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia testnet
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
    44787: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B", // Celo Alfajores
    5042002: "0x3600000000000000000000000000000000000000", // Arc Testnet (native USDC ERC-20 interface, 6 decimals)
    5042: "0x3600000000000000000000000000000000000000", // Arc Mainnet (native USDC ERC-20 interface, 6 decimals)
  };

  const chainId = network.config.chainId;
  console.log(`Deploying to network: ${network.name} (chainId: ${chainId})`);

  let usdcAddress = USDC_ADDRESSES[chainId];
  if (!usdcAddress) {
    console.error(`Unsupported network: ${chainId}. Please add USDC address to the script.`);
    process.exit(1);
  }

  console.log(`Using USDC address: ${usdcAddress}`);

  // Deploy HackathonRegistry
  const HackathonRegistry = await ethers.getContractFactory('HackathonRegistry');
  const hackathonRegistry = await HackathonRegistry.deploy();
  await hackathonRegistry.deployed();
  console.log('HackathonRegistry deployed to:', hackathonRegistry.address);

  // Deploy BuilderCreditCore
  const BuilderCreditCore = await ethers.getContractFactory('BuilderCreditCore');
  const builderCreditCore = await BuilderCreditCore.deploy(hackathonRegistry.address, usdcAddress);
  await builderCreditCore.deployed();
  console.log('BuilderCreditCore deployed to:', builderCreditCore.address);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: chainId,
    hackathonRegistryAddress: hackathonRegistry.address,
    builderCreditCoreAddress: builderCreditCore.address,
    usdcAddress: usdcAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  const deploymentFile = `./deployments/${network.name}_deployment.json`;
  if (!fs.existsSync('./deployments')) {
    fs.mkdirSync('./deployments');
  }
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to ${deploymentFile}`);

  // Verify contracts if not on a local network
  if (chainId !== 31337 && chainId !== 1337) {
    console.log('Waiting for block confirmations...');
    await builderCreditCore.deployTransaction.wait(6);

    try {
      await hre.run('verify:verify', {
        address: hackathonRegistry.address,
        constructorArguments: [],
      });
      console.log('HackathonRegistry verified');
    } catch (e) {
      console.log('HackathonRegistry verification failed:', e.message);
    }

    try {
      await hre.run('verify:verify', {
        address: builderCreditCore.address,
        constructorArguments: [hackathonRegistry.address, usdcAddress],
      });
      console.log('BuilderCreditCore verified');
    } catch (e) {
      console.log('BuilderCreditCore verification failed:', e.message);
    }
  }

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
