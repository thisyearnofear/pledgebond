/**
 * Nanopayment Service - Client Side
 * 
 * Handles nanopayments to x402-protected endpoints using Circle Gateway.
 * Part of the "Agentic Economy on Arc" hackathon submission.
 * 
 * Uses the GatewayClient to:
 * 1. Deposit USDC into Gateway wallet (one-time onchain transaction)
 * 2. Pay for x402-protected resources with gasless EIP-3009 authorizations
 * 3. Check balances and withdraw earnings
 */

import { GatewayClient } from "@circle-fin/x402-batching/client";

interface NanopaymentConfig {
  chain: string;
  privateKey: `0x${string}`;
  gatewayWalletAddress?: string;
}

interface PaymentResult {
  success: boolean;
  data?: any;
  error?: string;
  txHash?: string;
  status?: "paid" | "payment_required" | "failed";
}

class NanopaymentService {
  private client: GatewayClient | null = null;
  private config: NanopaymentConfig | null = null;

  async initialize(config: NanopaymentConfig) {
    this.config = config;

    // Map user-facing chain names to the GatewayClient's SupportedChainName.
    // The @circle-fin/x402-batching SDK natively supports "arcTestnet"
    // (GATEWAY_DOMAINS.arcTestnet = 26). Previously this was incorrectly
    // mapped to "arbitrum", which would route payments to the wrong chain.
    const chain = config.chain === "arc" || config.chain === "arcTestnet"
      ? "arcTestnet" as const
      : "arbitrumSepolia" as const;

    this.client = new GatewayClient({
      chain,
      privateKey: config.privateKey,
    });
    return this.client;
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  async getBalance(): Promise<{ available: string; locked: string }> {
    if (!this.client) {
      throw new Error("NanopaymentClient not initialized");
    }
    const balance = await this.client.getBalance() as unknown as { available: string | number; locked?: string | number };
    const available = String(balance.available);
    const locked = balance.locked ? String(balance.locked) : '0';
    return { available, locked };
  }

  async deposit(amountUSDC: number): Promise<{ txHash: string }> {
    if (!this.client) {
      throw new Error("NanopaymentClient not initialized");
    }
    const amountWei = (BigInt(amountUSDC) * BigInt(1e6)).toString();
    const result = await this.client.deposit(amountWei) as { txHash?: string; hash?: string };
    return { txHash: result.txHash || result.hash || '' };
  }

  async withdraw(amountUSDC: number): Promise<{ txHash: string }> {
    if (!this.client) {
      throw new Error("NanopaymentClient not initialized");
    }
    const amountWei = (BigInt(amountUSDC) * BigInt(1e6)).toString();
    const result = await this.client.withdraw(amountWei) as { txHash?: string; hash?: string };
    return { txHash: result.txHash || result.hash || '' };
  }

  async pay(url: string, options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: string;
    headers?: Record<string, string>;
  }): Promise<PaymentResult> {
    if (!this.client) {
      throw new Error("NanopaymentClient not initialized");
    }

    try {
      const result = await this.client.pay(url, {
        method: options?.method || 'GET',
        body: options?.body,
        headers: options?.headers,
      }) as { data?: any; status?: number; headers?: Record<string, string> };
      const { data, status, headers } = result;

      if (status === 402) {
        return {
          success: false,
          status: "payment_required",
          error: headers?.["x-payment-requirement"] || "Payment required",
        };
      }

      return {
        success: true,
        status: "paid",
        data,
        txHash: headers?.["x-settlement-hash"] || headers?.["x-tx-hash"],
      };
    } catch (error: unknown) {
      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Payment failed",
      };
    }
  }

  async payForHealthScore(projectId: string, baseUrl?: string): Promise<PaymentResult> {
    const url = `${baseUrl || ""}/api/agent/underwrite?projectId=${projectId}`;
    return this.pay(url);
  }

  /**
   * Sponsored-first agent call: plain fetch first — the server funds it
   * from the caller's free-call budget (agentSponsorship) when available.
   * On 402 (budget spent) fall back to the deposit-gated x402 client.
   * Same call shape as pay(): { success, data, status }.
   */
  async payOrSponsor(url: string, options?: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
  }): Promise<PaymentResult> {
    try {
      const res = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
      });
      if (res.status === 402) {
        // Budget spent — paid path (requires an initialized client).
        if (!this.client) {
          return {
            success: false,
            status: "payment_required",
            error: "Free calls used up. Deposit USDC to keep analyzing.",
          };
        }
        return this.pay(url, options);
      }
      const data = await res.json().catch(() => null);
      return {
        success: res.ok && data?.success !== false,
        status: res.ok ? "paid" : "failed",
        data,
      };
    } catch (error: unknown) {
      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Request failed",
      };
    }
  }
}

export const nanopaymentService = new NanopaymentService();
export default nanopaymentService;