/**
 * Real Circle API Service
 * Uses @circle-fin/developer-controlled-wallets for W3S API
 */

import crypto from "crypto";
import {
  initiateDeveloperControlledWalletsClient,
  type CircleDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import { db } from "@/lib/firebase/serverOnly";
import {
  TESTNET_USDC_ADDRESSES,
  MAINNET_USDC_ADDRESSES,
  USDC_ADDRESSES,
  ARC_CHAIN_ID,
  ARC_CIRCLE_BLOCKCHAIN,
  BUILDER_CREDIT_CORE_ADDRESSES,
} from "../config/tokens";
import { calculateFundingAmount as sharedCalculateFundingAmount } from "../lib/funding/calculateFundingAmount";

const PLACEHOLDER_CONTRACT = "0x7890123456789012345678901234567890123456";

/**
 * Build the contract allowlist from runtime sources:
 *   - BUILDER_CREDIT_ARC_ADDRESS / BUILDER_CREDIT_CONTRACT_ADDRESS env vars
 *   - Real (non-placeholder) entries in BUILDER_CREDIT_CORE_ADDRESSES
 *   - All known USDC token contracts (needed for approve() calls)
 *   - Optional comma-separated CIRCLE_ALLOWED_CONTRACTS env override
 *
 * Built lazily (per-call) so tests and runtime env changes are picked up.
 */
function buildAllowedContractAddresses(): Set<string> {
  const allowed = new Set<string>();

  const envContracts = [
    process.env.BUILDER_CREDIT_ARC_ADDRESS,
    process.env.BUILDER_CREDIT_CONTRACT_ADDRESS,
    ...(process.env.CIRCLE_ALLOWED_CONTRACTS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];

  for (const addr of envContracts) {
    if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
      allowed.add(addr.toLowerCase());
    }
  }

  for (const addr of Object.values(BUILDER_CREDIT_CORE_ADDRESSES) as string[]) {
    if (addr && addr.toLowerCase() !== PLACEHOLDER_CONTRACT.toLowerCase()) {
      allowed.add(addr.toLowerCase());
    }
  }

  for (const addr of Object.values(TESTNET_USDC_ADDRESSES) as string[]) {
    if (typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
      allowed.add(addr.toLowerCase());
    }
  }
  for (const addr of Object.values(MAINNET_USDC_ADDRESSES) as string[]) {
    if (typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
      allowed.add(addr.toLowerCase());
    }
  }

  return allowed;
}

// Function selector allowlist:
//   0x095ea7b3 = approve(address,uint256)        — ERC-20
//   0xa9059cbb = transfer(address,uint256)       — ERC-20
//   0x23b872dd = transferFrom(address,address,uint256) — ERC-20
//   keccak256("backProject(uint256,uint256,uint256)")[0:4]
const KNOWN_FUNCTION_SELECTORS = new Set<string>([
  "0x095ea7b3",
  "0xa9059cbb",
  "0x23b872dd",
  "0x3a2b68f9",
]);

type FeeLevel = "LOW" | "MEDIUM" | "HIGH";

interface WalletConfig {
  name?: string;
  description?: string;
  userId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

interface TransactionConfig {
  walletId: string;
  blockchain?: string;
  tokenId?: string;
  amount?: string;
  destinationAddress: string;
  feeLevel?: FeeLevel;
  metadata?: Record<string, any>;
  contractAddress?: string;
  calldata?: string;
  idempotencyKey?: string;
}

interface FundingResult {
  success: boolean;
  walletId: string;
  fundingAmount: number;
  creditScore: number;
  message: string;
}

interface CircleResponse<T = any> {
  success: boolean;
  data: T;
}

interface IdempotencyRecord {
  key: string;
  action: string;
  scope: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  payload?: Record<string, any>;
  circleTxId?: string;
  createdAt: string;
  updatedAt?: string;
}

class RealCircleService {
  private client: CircleDeveloperControlledWalletsClient | null = null;
  private readonly environment: string;
  private readonly apiKey: string | undefined;
  private readonly walletSetId: string | undefined;
  private readonly entitySecret: string | undefined;

  constructor() {
    this.environment = process.env.CIRCLE_ENVIRONMENT || "sandbox";
    this.apiKey = process.env.CIRCLE_API_KEY;
    this.walletSetId = process.env.CIRCLE_WALLET_SET_ID;
    this.entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    this.initialize();
  }

  private initialize(): void {
    if (!this.apiKey || !this.entitySecret) {
      console.warn("Circle API key or entity secret not configured");
      return;
    }

    this.client = initiateDeveloperControlledWalletsClient({
      apiKey: this.apiKey,
      entitySecret: this.entitySecret,
    });
  }

  isClientConfigured(): boolean {
    return !!(this.client && this.apiKey && this.entitySecret);
  }

  isWalletConfigured(): boolean {
    return this.isClientConfigured() && !!this.walletSetId;
  }

  isConfigured(): boolean {
    return this.isWalletConfigured();
  }

  generateIdempotencyKey(prefix = "tx", fingerprint?: string): string {
    if (fingerprint) {
      const hash = crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 24);
      return `${prefix}-${hash}`;
    }
    return `${prefix}-${crypto.randomUUID()}`;
  }

  validateWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address || "");
  }

  private async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    try {
      const snap = await db.collection("circleIdempotency").doc(key).get();
      return snap.exists ? (snap.data() as IdempotencyRecord) : null;
    } catch {
      return null;
    }
  }

  private async reserveIdempotencyKey(
    key: string,
    action: string,
    scope: string,
    payload: Record<string, any>
  ): Promise<IdempotencyRecord | null> {
    const existing = await this.getIdempotencyRecord(key);
    if (existing) return existing;

    const record: IdempotencyRecord = {
      key,
      action,
      scope,
      status: "pending",
      payload,
      createdAt: new Date().toISOString(),
    };

    await db.collection("circleIdempotency").doc(key).set(record);
    return null;
  }

  private async updateIdempotency(
    key: string,
    updates: Partial<IdempotencyRecord>
  ): Promise<void> {
    await db.collection("circleIdempotency").doc(key).set(
      {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  private validateContractCall(contractAddress: string, calldata: string): void {
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      throw new Error("Invalid contract address");
    }
    if (!calldata || !/^0x[a-fA-F0-9]+$/.test(calldata) || calldata.length < 10) {
      throw new Error("Invalid calldata");
    }

    const allowedContracts = buildAllowedContractAddresses();
    const normalizedAddress = contractAddress.toLowerCase();
    if (!allowedContracts.has(normalizedAddress)) {
      throw new Error(
        `Contract address ${normalizedAddress} is not in the Circle allowlist`
      );
    }

    const selector = calldata.slice(0, 10).toLowerCase();
    if (!KNOWN_FUNCTION_SELECTORS.has(selector)) {
      throw new Error(
        `Contract calldata selector ${selector} is not allowlisted`
      );
    }
  }

  async createWallet(config: WalletConfig = {}): Promise<CircleResponse> {
    if (!this.isWalletConfigured()) {
      throw new Error("Circle API not properly configured");
    }

    const fingerprint = JSON.stringify({
      userId: config.userId || null,
      name: config.name || null,
      description: config.description || null,
    });
    const idempotencyKey = config.idempotencyKey || this.generateIdempotencyKey("wallet", fingerprint);
    const existing = await this.reserveIdempotencyKey(idempotencyKey, "createWallet", "wallet", config);
    if (existing?.circleTxId && existing.status !== "failed") {
      return { success: true, data: { wallets: [{ id: existing.circleTxId }] } };
    }

    try {
      const response = await this.client!.createWallets({
        idempotencyKey,
        walletSetId: this.walletSetId!,
        blockchains: ["ETH", "MATIC-AMOY", "BASE-SEPOLIA", "ARB-SEPOLIA", ARC_CIRCLE_BLOCKCHAIN] as any,
        count: 1,
      });

      await this.updateIdempotency(idempotencyKey, {
        status: "submitted",
        circleTxId: response.data?.wallets?.[0]?.id,
      });

      return { success: true, data: response.data };
    } catch (error: any) {
      await this.updateIdempotency(idempotencyKey, { status: "failed" });
      throw new Error(`Wallet creation failed: ${error.message}`);
    }
  }

  async getWallets(walletSetId: string | null = null): Promise<CircleResponse> {
    if (!this.isWalletConfigured()) {
      throw new Error("Circle API not properly configured");
    }

    try {
      const response = await this.client!.listWallets({
        walletSetId: walletSetId || this.walletSetId,
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      throw new Error(`Get wallets failed: ${error.message}`);
    }
  }

  async getWalletById(walletId: string): Promise<CircleResponse> {
    if (!this.isClientConfigured()) {
      throw new Error("Circle API client not properly configured");
    }

    try {
      const response = await this.client!.getWallet({ id: walletId });
      return { success: true, data: response.data };
    } catch (error: any) {
      throw new Error(`Get wallet failed: ${error.message}`);
    }
  }

  async getWalletBalances(walletId: string): Promise<CircleResponse> {
    if (!this.isClientConfigured()) {
      throw new Error("Circle API client not properly configured");
    }

    try {
      const response = await this.client!.getWalletTokenBalance({ walletId });
      return { success: true, data: response.data };
    } catch (error: any) {
      throw new Error(`Get wallet balances failed: ${error.message}`);
    }
  }

  async createTransaction(config: TransactionConfig): Promise<CircleResponse> {
    if (!this.isClientConfigured()) {
      throw new Error("Circle API client not properly configured");
    }

    const feeLevel = config.feeLevel || "HIGH";
    const fingerprint = JSON.stringify({
      walletId: config.walletId,
      tokenId: config.tokenId || null,
      destinationAddress: config.destinationAddress,
      amount: config.amount || null,
      feeLevel,
      contractAddress: config.contractAddress || null,
      calldata: config.calldata || null,
    });
    const idempotencyKey = config.idempotencyKey || this.generateIdempotencyKey(config.contractAddress ? "ctx" : "tx", fingerprint);
    const existing = await this.reserveIdempotencyKey(
      idempotencyKey,
      config.contractAddress ? "contractExecution" : "transfer",
      config.contractAddress ? "contract" : "transfer",
      config
    );

    if (existing?.circleTxId && existing.status !== "failed") {
      return { success: true, data: { id: existing.circleTxId } };
    }

    try {
      if (config.contractAddress && config.calldata) {
        this.validateContractCall(config.contractAddress, config.calldata);

        const response = await this.client!.createContractExecutionTransaction({
          idempotencyKey,
          walletId: config.walletId,
          contractAddress: config.contractAddress,
          callData: config.calldata,
          feeLevel: feeLevel as any,
        });

        await this.updateIdempotency(idempotencyKey, {
          status: "submitted",
          circleTxId: response.data?.id || response.data?.transaction?.id,
        });

        return { success: true, data: response.data };
      }

      if (!config.amount) {
        throw new Error("amount is required for transfer transactions");
      }

      const response = await this.client!.createTransaction({
        idempotencyKey,
        walletId: config.walletId,
        tokenId:
          config.tokenId ||
          (USDC_ADDRESSES as Record<number, string>)[ARC_CHAIN_ID],
        destinationAddress: config.destinationAddress,
        amount: [config.amount],
        fee: { feeLevel },
      });

      await this.updateIdempotency(idempotencyKey, {
        status: "submitted",
        circleTxId: response.data?.id || response.data?.transaction?.id,
      });

      return { success: true, data: response.data };
    } catch (error: any) {
      await this.updateIdempotency(idempotencyKey, { status: "failed" });
      throw new Error(`Transaction creation failed: ${error.message}`);
    }
  }

  async getTransactionStatus(transactionId: string): Promise<CircleResponse> {
    if (!this.isClientConfigured()) {
      throw new Error("Circle API client not properly configured");
    }

    try {
      const response = await this.client!.getTransaction({ id: transactionId });
      return { success: true, data: response.data };
    } catch (error: any) {
      throw new Error(`Get transaction status failed: ${error.message}`);
    }
  }

  getConfig(): { success: boolean; data: { walletSetId: string; environment: string; configured: boolean; clientConfigured: boolean } } {
    return {
      success: true,
      data: {
        walletSetId: this.walletSetId || "",
        environment: this.environment,
        configured: this.isWalletConfigured(),
        clientConfigured: this.isClientConfigured(),
      },
    };
  }

  async ping(): Promise<CircleResponse> {
    if (!this.isWalletConfigured()) {
      throw new Error("Circle API not properly configured");
    }

    try {
      const response = await this.client!.listWallets({
        walletSetId: this.walletSetId!,
      });
      return { success: true, data: { message: "OK", wallets: response.data } };
    } catch (error: any) {
      throw new Error(`Ping failed: ${error.message}`);
    }
  }

  async processDeveloperFunding(
    developerAddress: string,
    creditScore: number,
    metadata: Record<string, any> = {}
  ): Promise<FundingResult> {
    if (!this.isWalletConfigured()) {
      throw new Error("Circle API not configured for wallet operations");
    }

    const fundingAmount = this.calculateFundingAmount(creditScore);
    if (fundingAmount <= 0) {
      throw new Error("Not eligible for funding");
    }

    const wallet = await this.createWallet({
      name: `Developer Wallet - ${metadata.githubUsername || "Unknown"}`,
      description: `Funding wallet for developer ${developerAddress}`,
      userId: developerAddress,
      metadata: { creditScore, developerAddress, ...metadata },
    });

    return {
      success: true,
      walletId: wallet.data.wallets[0].id,
      fundingAmount,
      creditScore,
      message: "Wallet created successfully. Funding will be processed separately.",
    };
  }

  calculateFundingAmount(creditScore: number): number {
    return sharedCalculateFundingAmount(creditScore);
  }
}

export { calculateFundingAmount } from "../lib/funding/calculateFundingAmount";

// Export singleton instance
export const realCircleService = new RealCircleService();
export default realCircleService;
