/**
 * Real LI.FI Service
 * Actual implementation using LI.FI SDK for cross-chain transfers
 */

import { LiFi, RouteOptions, StatusResponse, SwitchChainHookData, ConfigUpdate } from "@lifi/sdk";
import type { WalletClient } from 'viem';
import { USDC_ADDRESSES, CHAIN_INFO } from "../config/tokens";

interface LiFiRoute {
  transactionHash?: string;
  status?: string;
  sending: { amount: string };
  token: { address: string; symbol: string; decimals: number };
  fromChainId: number;
  toChainId: number;
  fromAddress: string;
  toAddress: string;
  steps: any[];
  [key: string]: any;
}

interface LiFiStatus {
  status: string;
  substatus?: string;
  txHash?: string;
  [key: string]: any;
}

interface RouteRequest {
  fromChainId: number;
  fromAmount: string;
  fromTokenAddress: string;
  toChain: number;
  toTokenAddress: string;
  fromAddress: string;
  toAddress: string;
  order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST' | 'SAFEST';
  slippage?: number;
}

interface TransferResult {
  success: boolean;
  txHash?: string;
  route?: LiFiRoute;
  error?: string;
  status?: string;
}

interface WalletBalance {
  chainId: number;
  token: string;
  balance: string;
  usdValue?: string;
}

class RealLiFiService {
  private lifi: LiFi | null;
  private apiKey: string | undefined;
  private integrator: string;

  constructor() {
    this.lifi = null;
    this.apiKey = process.env.NEXT_PUBLIC_LIFI_API_KEY;
    this.integrator = "BuilderCredit";
    this.initialize();
  }

  initialize(): void {
    try {
      this.lifi = new LiFi({
        apiUrl: "https://li.fi/v1",
        integrator: this.integrator,
        apiKey: this.apiKey,
      });
    } catch (error) {
      console.error("Failed to initialize LI.FI SDK:", error);
    }
  }

  isConfigured(): boolean {
    return this.lifi !== null;
  }

  async getQuote(params: RouteRequest): Promise<LiFiRoute | null> {
    if (!this.lifi) throw new Error("LI.FI not initialized");
    const routes = await this.lifi.getRoutes({
      fromChainId: params.fromChainId,
      fromAmount: params.fromAmount,
      fromTokenAddress: params.fromTokenAddress,
      toChainId: params.toChain,
      toTokenAddress: params.toTokenAddress,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      options: {
        slippage: params.slippage || 0.03,
        order: params.order || 'RECOMMENDED',
      },
    });
    return routes.routes?.[0] || null;
  }

  async executeRoute(route: LiFiRoute, signer: WalletClient | any): Promise<TransferResult> {
    if (!this.lifi) throw new Error("LI.FI not initialized");
    try {
      const execution = await this.lifi.executeRoute(signer as any, route, {
        switchChainHook: async (chainId: number) => {
          const chainInfo = CHAIN_INFO[chainId as keyof typeof CHAIN_INFO];
          console.warn(`[LiFi] switchChainHook: need to switch to chain ${chainId} (${chainInfo?.name || 'unknown'})`);
          throw new Error(`Chain switch to ${chainId} not handled automatically`);
        },
        updateRouteHook: (route: LiFiRoute) => {
          console.log(`[LiFi] Route update: ${route.status}`);
        },
      });
      return {
        success: execution.status === 'DONE',
        txHash: execution.transactionHash,
        route: execution,
        status: execution.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Route execution failed',
      };
    }
  }

  async getStatus(txHash: string, fromChain: number, toChain: number): Promise<LiFiStatus | null> {
    if (!this.lifi) throw new Error("LI.FI not initialized");
    try {
      return await this.lifi.getStatus({
        txHash,
        fromChain,
        toChain,
        bridgeType: 'LI.FI',
      });
    } catch {
      return null;
    }
  }

  async getBridgeRoute(
    fromChain: number,
    toChain: number,
    token: string,
    amount: string,
    fromAddress: string,
    toAddress: string
  ): Promise<LiFiRoute | null> {
    return this.getQuote({
      fromChainId: fromChain,
      fromAmount: amount,
      fromTokenAddress: token,
      toChain,
      toTokenAddress: token,
      fromAddress,
      toAddress,
      order: 'RECOMMENDED',
    });
  }

  async getUSDCBridgeRoute(
    fromChain: number,
    toChain: number,
    amount: string,
    fromAddress: string,
    toAddress: string
  ): Promise<LiFiRoute | null> {
    const usdcAddress = USDC_ADDRESSES[fromChain as keyof typeof USDC_ADDRESSES];
    if (!usdcAddress) throw new Error(`USDC not available on chain ${fromChain}`);
    return this.getBridgeRoute(fromChain, toChain, usdcAddress, amount, fromAddress, toAddress);
  }

  async executeBridgeRoute(route: LiFiRoute, signer: WalletClient | any): Promise<TransferResult> {
    return this.executeRoute(route, signer);
  }

  async getWalletBalances(address: string, chains: number[]): Promise<WalletBalance[]> {
    if (!this.lifi) throw new Error("LI.FI not initialized");
    const balances = await this.lifi.getTokenBalances({ wallets: [address], chains });
    const result: WalletBalance[] = [];
    for (const chain of balances || []) {
      for (const token of chain.tokens || []) {
        result.push({
          chainId: chain.chainId,
          token: token.address,
          balance: token.amount || '0',
          usdValue: token.priceUSD,
        });
      }
    }
    return result;
  }

  async checkApproval(
    tokenAddress: string,
    amount: string,
    fromAddress: string,
    chainId: number
  ): Promise<boolean> {
    if (!this.lifi) throw new Error("LI.FI not initialized");
    const approval = await this.lifi.getApprovalData({
      amount,
      tokenAddress,
      fromAddress,
      chainId,
    });
    return approval !== null;
  }

  async getTokenPrice(tokenAddress: string, chainId: number): Promise<{ priceUSD: string } | null> {
    if (!this.lifi) throw new Error("LI.FI not initialized");
    try {
      const token = await this.lifi.getToken({ token: tokenAddress, chainId });
      return { priceUSD: token?.priceUSD || '0' };
    } catch {
      return null;
    }
  }

  async getSupportedChains(): Promise<{ id: number; name: string; token: string }[]> {
    if (!this.lifi) throw new Error("LI.FI not initialized");
    const chains = await this.lifi.getChains();
    return chains.map(c => ({ id: c.id, name: c.name, token: c.token }));
  }

  clearCache(): void {
    // LI.FI SDK manages its own cache — nothing to clear on our end
  }
}

const realLiFiService = new RealLiFiService();
export { RealLiFiService };
export { realLiFiService };
export default realLiFiService;
