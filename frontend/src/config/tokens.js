/**
 * Correct Testnet USDC Token Addresses
 * Updated with official Circle testnet addresses
 */

// ── Arc network selection ───────────────────────────────────────────
// NEXT_PUBLIC_ARC_NETWORK="mainnet" flips every Arc-facing surface
// (x402 Gateway client, chain configs, explorer links, Circle W3S
// blockchain enum) to Arc Mainnet (chain 5042). Defaults to testnet so
// dev/demo never touches real funds. The NEXT_PUBLIC_ prefix is required
// because nanopaymentService runs client-side; ARC_NETWORK is accepted
// as a server-side alias.
export const ARC_MAINNET_CHAIN_ID = 5042;
export const ARC_TESTNET_CHAIN_ID = 5042002;

export const ARC_NETWORK =
  String(
    process.env.NEXT_PUBLIC_ARC_NETWORK || process.env.ARC_NETWORK || "testnet"
  ).toLowerCase() === "mainnet"
    ? "mainnet"
    : "testnet";

export const ARC_CHAIN_ID =
  ARC_NETWORK === "mainnet" ? ARC_MAINNET_CHAIN_ID : ARC_TESTNET_CHAIN_ID;

// Chain name as understood by @circle-fin/x402-batching SupportedChainName
export const ARC_GATEWAY_CHAIN =
  ARC_NETWORK === "mainnet" ? "arc" : "arcTestnet";

// CAIP-2 network id used in x402 payment requirements
export const ARC_CAIP2 = `eip155:${ARC_CHAIN_ID}`;

// Circle W3S blockchain enum: ARC (mainnet) / ARC-TESTNET (testnet)
export const ARC_CIRCLE_BLOCKCHAIN =
  ARC_NETWORK === "mainnet" ? "ARC" : "ARC-TESTNET";

// Canonical endpoints (docs.arc.io). ARC_*_RPC_URL env vars can override.
export const ARC_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_RPC_URL ||
  process.env.ARC_RPC_URL ||
  (ARC_NETWORK === "mainnet"
    ? "https://rpc.mainnet.arc.io"
    : "https://rpc.testnet.arc.network");

export const ARC_EXPLORER =
  ARC_NETWORK === "mainnet"
    ? "https://explorer.arc.io"
    : "https://explorer.testnet.arc.io";

export const SOLANA_MAINNET_USDC = "EPjFW364Ac7H5keePybR7L5tS5sLwerZEv8oaW6wED7L";
export const SOLANA_DEVNET_USDC = "4zMMC9srtvSqzRLsS51uVtoQpYp5yFdC8PYy8Y79zNLX";
export const BAGS_FEE_SHARE_V2_ID = "FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK";

export const TESTNET_USDC_ADDRESSES = {
  // Ethereum Sepolia
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",

  // Arbitrum Sepolia
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",

  // Base Sepolia
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",

  // OP Sepolia
  11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",

  // Celo Alfajores
  44787: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",

  // Linea Sepolia
  59141: "0xFEce4462D57bD51A6A552365A011b95f0E16d9B7",

  // Arc Testnet (native USDC ERC-20 interface)
  5042002: "0x3600000000000000000000000000000000000000",

  // Solana Devnet
  'sol-devnet': SOLANA_DEVNET_USDC,
};

export const MAINNET_USDC_ADDRESSES = {
  // Ethereum Mainnet
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",

  // Arbitrum One
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",

  // Base
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",

  // Optimism
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",

  // Celo
  42220: "0x765DE816845861e75A25fCA122bb6898B8B1282a",

  // Linea
  59144: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",

  // Arc Mainnet (native USDC ERC-20 interface — same system address as testnet)
  5042: "0x3600000000000000000000000000000000000000",

  // Solana
  'sol': SOLANA_MAINNET_USDC,
};

export const USDC_ADDRESSES = {
  ...TESTNET_USDC_ADDRESSES,
  ...MAINNET_USDC_ADDRESSES,
};

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ⚠️  PLACEHOLDER ADDRESSES — These need real deployed contracts.     ║
// ║  BUILDER_CREDIT_CORE_ADDRESSES and HACKATHON_REGISTRY_ADDRESSES      ║
// ║  are set to placeholder values (0x7890...5678) because the actual   ║
// ║  contracts have not been deployed yet across all chains.             ║
// ║                                                                      ║
// ║  Before mainnet launch:                                              ║
// ║    1. Deploy BuilderCreditCore and HackathonRegistry to each chain   ║
// ║    2. Update addresses below with real deployed contract addresses   ║
// ║    3. Remove this warning block                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝
export const BUILDER_CREDIT_CORE_ADDRESSES = {
  // Ethereum Mainnet
  1: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Ethereum Sepolia
  11155111: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Arbitrum One
  42161: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Arbitrum Sepolia
  421614: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Base
  8453: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Base Sepolia
  84532: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Optimism
  10: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // OP Sepolia
  11155420: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Celo
  42220: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Celo Alfajores
  44787: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Linea
  59144: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Linea Sepolia
  59141: "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
  // Arc Testnet
  5042002: "0xC93Cf6034Bb2193bDA8B942eE91B244aa7DC7942", // deployed — real address
  // Arc Mainnet — deploy via `npx hardhat run scripts/deployTestnet.js --network arc`
  5042: process.env.BUILDER_CREDIT_ARC_MAINNET_ADDRESS || "0x7890123456789012345678901234567890123456", // TODO: deploy & replace
};

export const HACKATHON_REGISTRY_ADDRESSES = {
  // Ethereum Mainnet
  1: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Ethereum Sepolia
  11155111: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Arbitrum One
  42161: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Arbitrum Sepolia
  421614: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Base
  8453: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Base Sepolia
  84532: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Optimism
  10: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // OP Sepolia
  11155420: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Celo
  42220: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Celo Alfajores
  44787: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Linea
  59144: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Linea Sepolia
  59141: "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
  // Arc Testnet
  5042002: "0x78077d311e06A05720f50AeD6E42A0D5116D14c1", // deployed — real address
  // Arc Mainnet — deploy via `npx hardhat run scripts/deployTestnet.js --network arc`
  5042: process.env.HACKATHON_REGISTRY_ARC_MAINNET_ADDRESS || "0x9012345678901234567890123456789012345678", // TODO: deploy & replace
};

export const TESTNET_CHAIN_INFO = {
  11155111: {
    name: "Ethereum Sepolia",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: "https://sepolia.infura.io/v3/",
    explorer: "https://sepolia.etherscan.io",
  },
  421614: {
    name: "Arbitrum Sepolia",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorer: "https://sepolia.arbiscan.io",
  },
  84532: {
    name: "Base Sepolia",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
  },
  11155420: {
    name: "OP Sepolia",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: "https://sepolia.optimism.io",
    explorer: "https://sepolia-optimism.etherscan.io",
  },
  44787: {
    name: "Celo Alfajores",
    symbol: "CELO",
    decimals: 18,
    rpcUrl: "https://alfajores-forno.celo-testnet.org",
    explorer: "https://alfajores-blockscout.celo-testnet.org",
  },
  59141: {
    name: "Linea Sepolia",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: "https://rpc.sepolia.linea.build",
    explorer: "https://sepolia.lineascan.build",
  },
  5042002: {
    name: "Arc Testnet",
    symbol: "USDC",
    decimals: 18,
    rpcUrl: "https://rpc.testnet.arc.network",
    explorer: "https://explorer.testnet.arc.io",
  },
  'sol-devnet': {
    name: "Solana Devnet",
    symbol: "SOL",
    decimals: 9,
    rpcUrl: "https://api.devnet.solana.com",
    explorer: "https://explorer.solana.com/?cluster=devnet",
  },
};

export const MAINNET_CHAIN_INFO = {
  5042: {
    name: "Arc",
    symbol: "USDC",
    decimals: 18,
    rpcUrl: "https://rpc.mainnet.arc.io",
    explorer: "https://explorer.arc.io",
  },
};

// Combined lookup for services that resolve chain metadata by chainId at
// runtime (payout verification, bridging). Prefer this over the
// network-specific maps in generic lookups.
export const CHAIN_INFO = {
  ...TESTNET_CHAIN_INFO,
  ...MAINNET_CHAIN_INFO,
};

export const USDC_TOKEN_INFO = {
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  isStablecoin: true,
};
