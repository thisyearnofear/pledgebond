/**
 * Network Configuration
 * Centralized network definitions and utilities
 */

import {
  TESTNET_USDC_ADDRESSES,
  MAINNET_USDC_ADDRESSES,
  TESTNET_CHAIN_INFO,
  MAINNET_CHAIN_INFO,
} from "./tokens";

const toKey = (chainId) => (isNaN(parseInt(chainId)) ? chainId : parseInt(chainId));

export const NETWORK_CONFIGS = {
  // Combine chain info with USDC addresses
  ...Object.keys(TESTNET_CHAIN_INFO).reduce((acc, chainId) => {
    const id = toKey(chainId);
    acc[id] = {
      ...TESTNET_CHAIN_INFO[chainId],
      chainId: id,
      usdcAddress: TESTNET_USDC_ADDRESSES[chainId],
      isTestnet: true,
    };
    return acc;
  }, {}),
  ...Object.keys(MAINNET_CHAIN_INFO).reduce((acc, chainId) => {
    const id = toKey(chainId);
    acc[id] = {
      ...MAINNET_CHAIN_INFO[chainId],
      chainId: id,
      usdcAddress: MAINNET_USDC_ADDRESSES[chainId],
      isTestnet: false,
    };
    return acc;
  }, {}),
};

export const SUPPORTED_CHAINS = Object.keys(NETWORK_CONFIGS).map(toKey);

export const MAINNET_CHAIN_IDS = Object.keys(MAINNET_CHAIN_INFO).map(toKey);
export const TESTNET_CHAIN_IDS = Object.keys(TESTNET_CHAIN_INFO).map(toKey);

// Helper functions
export const getNetworkConfig = (chainId) => {
  return NETWORK_CONFIGS[chainId] || null;
};

export const getUSDCAddress = (chainId) => {
  return TESTNET_USDC_ADDRESSES[chainId] || MAINNET_USDC_ADDRESSES[chainId] || null;
};

export const isTestnet = (chainId) => {
  return TESTNET_CHAIN_IDS.includes(chainId);
};

export const getExplorerUrl = (chainId) => {
  const config = getNetworkConfig(chainId);
  return config?.explorer || null;
};

export const getRpcUrl = (chainId) => {
  const config = getNetworkConfig(chainId);
  return config?.rpcUrl || null;
};

export const getNetworkName = (chainId) => {
  const config = getNetworkConfig(chainId);
  return config?.name || `Chain ${chainId}`;
};

export const getSupportedChainIds = () => {
  return SUPPORTED_CHAINS;
};

export const validateChainId = (chainId) => {
  if (typeof chainId === 'string' && isNaN(parseInt(chainId))) {
    return SUPPORTED_CHAINS.includes(chainId);
  }
  return SUPPORTED_CHAINS.includes(parseInt(chainId));
};
