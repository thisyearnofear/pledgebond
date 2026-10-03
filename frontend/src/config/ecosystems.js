/**
 * Ecosystem Configuration
 * Single source of truth for all ecosystem-related data
 */

export const ECOSYSTEM_CONFIGS = {
  celo: {
    id: 'celo',
    name: 'Celo Ecosystem',
    shortName: 'Celo',
    description: 'Mobile-first blockchain projects focused on financial inclusion',
    longDescription: 'Projects built during Celo\'s PledgeBond program across three seasons, focusing on mobile-first blockchain solutions and financial inclusion.',
    chainFamily: 'evm',
    
    // Visual identity
    icon: '🌱',
    color: '#35D07F',
    bgGradient: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    bgColor: 'bg-green-50',
    
    // Routing
    route: '/ecosystems/celo',
    apiEndpoint: '/api/projects/celo',
    
    // Features & metadata
    features: ['Multi-season tracking', 'GitHub analytics', 'Community metrics'],
    submissionRequirements: [
      'Project must be deployed on Celo',
      'Include clear onchain contract references (address or explorer)',
      'Provide a GitHub repo for reviewers and users'
    ],
    category: 'PledgeBond Program',
    
    // Data source configuration
    dataSource: 'static', // static (repos.json) or dynamic (firestore)
    hasSeasons: true,
    seasons: [1, 2, 3],
    
    // Display preferences
    defaultSort: 'season',
    showHealthScore: true,
    showActivity: true,
    previewLimit: 4
  },

  arc: {
    id: 'arc',
    name: 'Arc Ecosystem',
    shortName: 'Arc',
    description: 'Circle\'s L2 with native USDC and x402 nanopayments',
    longDescription: 'Projects building on Arc, Circle\'s EVM L2 with native USDC, gasless transactions, and the x402 nanopayment protocol for agentic economies.',
    chainFamily: 'evm',
    icon: '⚡',
    color: '#00D395',
    bgGradient: 'from-teal-50 to-cyan-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-800',
    bgColor: 'bg-teal-50',
    route: '/ecosystems/arc',
    apiEndpoint: '/api/projects/arc',
    features: ['x402 nanopayments', 'Native USDC', 'Gasless transactions', 'Agentic economy'],
    submissionRequirements: [
      'Project must use Arc Testnet or Mainnet',
      'Demonstrate x402 or USDC payment integration',
      'Provide a GitHub repo for reviewers'
    ],
    category: 'Agentic Economy',
    dataSource: 'dynamic',
    hasSeasons: false,
    hasCategories: true,
    categories: ['defi', 'ai-agents', 'payments', 'infrastructure', 'social', 'dao', 'other'],
    defaultSort: 'recent',
    showHealthScore: true,
    showActivity: true,
    showFunding: true,
    previewLimit: 4
  },

  base: {
    id: 'base',
    name: 'Base Ecosystem',
    shortName: 'Base',
    description: 'Coinbase\'s L2 network enabling fast, low-cost applications',
    longDescription: 'Projects building on Coinbase\'s Base network, leveraging low fees and fast transactions for innovative decentralized applications.',
    chainFamily: 'evm',
    icon: '🔵',
    color: '#0052FF',
    bgGradient: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    bgColor: 'bg-blue-50',
    route: '/ecosystems/base',
    apiEndpoint: '/api/projects/base',
    features: ['Developer funding', 'L2 benefits', 'Coinbase integration'],
    submissionRequirements: [
      'Project must be deployed on Base',
      'Provide a GitHub repo for reviewers and users',
      'Add at least one contract address for your onchain surface area'
    ],
    category: 'L2 Innovation',
    dataSource: 'dynamic',
    hasSeasons: false,
    hasCategories: true,
    categories: ['defi', 'nft', 'gaming', 'social', 'infrastructure', 'dao', 'other'],
    defaultSort: 'recent',
    showHealthScore: true,
    showActivity: true,
    showFunding: true,
    previewLimit: 4
  },

  linea: {
    id: 'linea',
    name: 'Linea Ecosystem',
    shortName: 'Linea',
    description: 'Consensys zkEVM L2 with low fees and Ethereum security',
    longDescription: 'Projects building on Linea, a zkEVM Layer 2 by Consensys offering Ethereum-level security with significantly lower transaction costs.',
    chainFamily: 'evm',
    icon: '🟣',
    color: '#61DFFF',
    bgGradient: 'from-purple-50 to-blue-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    bgColor: 'bg-purple-50',
    route: '/ecosystems/linea',
    apiEndpoint: '/api/projects/linea',
    features: ['zkEVM security', 'Low gas fees', 'Consensys ecosystem'],
    submissionRequirements: [
      'Project must be deployed on Linea',
      'Provide a GitHub repo for reviewers and users'
    ],
    category: 'zkEVM L2',
    dataSource: 'dynamic',
    hasSeasons: false,
    hasCategories: true,
    categories: ['defi', 'nft', 'gaming', 'social', 'infrastructure', 'dao', 'other'],
    defaultSort: 'recent',
    showHealthScore: true,
    showActivity: true,
    previewLimit: 4
  },

  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum Ecosystem',
    shortName: 'Arbitrum',
    description: 'Leading Optimistic Rollup L2 with deep DeFi liquidity',
    longDescription: 'Projects building on Arbitrum, the largest Optimistic Rollup Layer 2 by TVL, known for its thriving DeFi ecosystem and developer tooling.',
    chainFamily: 'evm',
    icon: '🔷',
    color: '#28A0F0',
    bgGradient: 'from-sky-50 to-blue-50',
    borderColor: 'border-sky-200',
    textColor: 'text-sky-800',
    bgColor: 'bg-sky-50',
    route: '/ecosystems/arbitrum',
    apiEndpoint: '/api/projects/arbitrum',
    features: ['Deep DeFi liquidity', 'Optimistic rollup', 'Stylus smart contracts'],
    submissionRequirements: [
      'Project must be deployed on Arbitrum',
      'Provide a GitHub repo for reviewers and users'
    ],
    category: 'Optimistic Rollup',
    dataSource: 'dynamic',
    hasSeasons: false,
    hasCategories: true,
    categories: ['defi', 'nft', 'gaming', 'social', 'infrastructure', 'dao', 'other'],
    defaultSort: 'recent',
    showHealthScore: true,
    showActivity: true,
    previewLimit: 4
  },

  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Ecosystem',
    shortName: 'Ethereum',
    description: 'The original smart contract platform and settlement layer',
    longDescription: 'Projects building on Ethereum mainnet and Sepolia testnet, the foundational layer for decentralized applications and DeFi.',
    chainFamily: 'evm',
    icon: '💎',
    color: '#627EEA',
    bgGradient: 'from-indigo-50 to-violet-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-800',
    bgColor: 'bg-indigo-50',
    route: '/ecosystems/ethereum',
    apiEndpoint: '/api/projects/ethereum',
    features: ['Maximum decentralization', 'Largest developer community', 'Settlement layer'],
    submissionRequirements: [
      'Project must be deployed on Ethereum',
      'Provide a GitHub repo for reviewers and users'
    ],
    category: 'Layer 1',
    dataSource: 'dynamic',
    hasSeasons: false,
    hasCategories: true,
    categories: ['defi', 'nft', 'gaming', 'social', 'infrastructure', 'dao', 'other'],
    defaultSort: 'recent',
    showHealthScore: true,
    showActivity: true,
    previewLimit: 4
  },

  optimism: {
    id: 'optimism',
    name: 'Optimism Ecosystem',
    shortName: 'Optimism',
    description: 'OP Stack L2 powering the Superchain vision',
    longDescription: 'Projects building on Optimism, the OP Stack Layer 2 driving the Superchain ecosystem with retroactive public goods funding.',
    chainFamily: 'evm',
    icon: '🔴',
    color: '#FF0420',
    bgGradient: 'from-red-50 to-orange-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    bgColor: 'bg-red-50',
    route: '/ecosystems/optimism',
    apiEndpoint: '/api/projects/optimism',
    features: ['Superchain ecosystem', 'RetroPGF funding', 'OP Stack'],
    submissionRequirements: [
      'Project must be deployed on Optimism',
      'Provide a GitHub repo for reviewers and users'
    ],
    category: 'Superchain',
    dataSource: 'dynamic',
    hasSeasons: false,
    hasCategories: true,
    categories: ['defi', 'nft', 'gaming', 'social', 'infrastructure', 'dao', 'other'],
    defaultSort: 'recent',
    showHealthScore: true,
    showActivity: true,
    previewLimit: 4
  },

  solana: {
    id: 'solana',
    name: 'Solana Ecosystem',
    shortName: 'Solana',
    description: 'High-performance blockchain for decentralized applications',
    longDescription: 'Projects building on Solana, a high-performance blockchain supporting fast transactions and low fees for builders and users globally.',
    chainFamily: 'solana',
    icon: '☀️',
    color: '#14F195',
    bgGradient: 'from-purple-50 to-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-800',
    bgColor: 'bg-emerald-50',
    route: '/ecosystems/solana',
    apiEndpoint: '/api/projects/solana',
    features: ['High throughput', 'Low latency', 'Rust smart contracts'],
    submissionRequirements: [
      'Project must be deployed on Solana',
      'Provide a GitHub repo for reviewers and users'
    ],
    category: 'Layer 1',
    dataSource: 'dynamic',
    hasSeasons: false,
    hasCategories: true,
    categories: ['defi', 'nft', 'gaming', 'social', 'infrastructure', 'dao', 'other'],
    defaultSort: 'recent',
    showHealthScore: true,
    showActivity: true,
    previewLimit: 4
  }
};

// Utility functions
export const getEcosystemConfig = (ecosystemId) => {
  return ECOSYSTEM_CONFIGS[ecosystemId] || null;
};

export const getAllEcosystems = () => {
  return Object.values(ECOSYSTEM_CONFIGS).filter(e => e.dataSource !== 'special');
};

export const getEcosystemsByDataSource = (dataSource) => {
  return Object.values(ECOSYSTEM_CONFIGS).filter(config => config.dataSource === dataSource);
};

export const getEcosystemColors = () => {
  return Object.fromEntries(
    Object.entries(ECOSYSTEM_CONFIGS).map(([key, config]) => [key, config.color])
  );
};

export const getChainFamily = (ecosystemId) => {
  const config = getEcosystemConfig(ecosystemId);
  return config ? config.chainFamily : 'evm';
};

// CSS class generators
export const getEcosystemClasses = (ecosystemId) => {
  const config = getEcosystemConfig(ecosystemId);
  if (!config) return {};
  
  return {
    gradient: `bg-gradient-to-r ${config.bgGradient}`,
    border: config.borderColor,
    text: config.textColor,
    bg: config.bgColor
  };
};

// Validation
export const isValidEcosystem = (ecosystemId) => {
  return ecosystemId in ECOSYSTEM_CONFIGS;
};
