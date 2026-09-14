/**
 * PayoutVerifierService
 *
 * Verifies that USDC payouts to hackathon winners actually happened
 * by checking Circle API, EVM on-chain transactions, or Solana token transfers.
 *
 * Records attestations in Firestore that feed into the hackathon leaderboard
 * and project detail verification badges.
 */

import { realCircleService } from './RealCircleService';
import { TESTNET_CHAIN_INFO, TESTNET_USDC_ADDRESSES } from '../config/tokens';

// ── Types ──────────────────────────────────────────────────────────

export interface PayoutClaim {
  hackathonName: string;
  winnerAddress: string;
  expectedAmount: number;          // USDC amount expected (human units)
  payoutTxHash?: string;           // On-chain transaction hash
  circleTransferId?: string;       // Circle API transfer ID
  chainId?: string | number;       // EVM chain ID or 'sol-devnet' / 'sol'
}

export interface VerificationResult {
  verified: boolean;
  provider: 'circle' | 'evm' | 'solana' | 'manual' | 'genlayer';
  actualAmount: number | null;
  payoutTimestamp: string | null;
  payoutTxHash: string | null;
  senderAddress: string | null;
  confidence: 'high' | 'medium' | 'low';
  details: string;
}

export interface PayoutAttestation {
  id?: string;
  projectSlug: string;
  hackathonName: string;
  winnerAddress: string;
  expectedAmount: number;
  verification: VerificationResult;
  attestorType: 'agent' | 'admin';
  attestedAt: string;
  sourceTxHash?: string;
}

// ── EVM RPC helpers ───────────────────────────────────────────────

const ERC20_TRANSFER_EVENT_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/**
 * Get an RPC URL for a given chain ID, falling back to environment variable.
 */
function getRpcUrl(chainId: string | number): string | null {
  // Check env for custom RPC
  const envVar = `RPC_URL_${chainId}`;
  if (typeof process !== 'undefined' && process.env?.[envVar]) {
    return process.env[envVar]!;
  }

  // Fall back to known testnet config
  const chainInfo = TESTNET_CHAIN_INFO[chainId as keyof typeof TESTNET_CHAIN_INFO];
  return chainInfo?.rpcUrl || null;
}

/**
 * Parse a USDC Transfer event from a transaction receipt log.
 * Uses a minimal RPC call (no ethers dependency in the critical path).
 */
async function parseEVMTransferReceipt(
  txHash: string,
  chainId: string | number,
  expectedRecipient: string
): Promise<{ amount: bigint; sender: string; blockTime: number | null } | null> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) return null;

  const recipientLower = expectedRecipient.toLowerCase();

  try {
    // Get transaction receipt
    const receiptRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });

    if (!receiptRes.ok) return null;
    const receiptData = await receiptRes.json();
    const receipt = receiptData?.result;
    if (!receipt?.logs) return null;

    // Get block for timestamp
    let blockTime: number | null = null;
    if (receipt.blockNumber) {
      const blockRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_getBlockByNumber',
          params: [receipt.blockNumber, false],
        }),
      });
      if (blockRes.ok) {
        const blockData = await blockRes.json();
        if (blockData?.result?.timestamp) {
          blockTime = parseInt(blockData.result.timestamp, 16) * 1000;
        }
      }
    }

    // USDC address for this chain
    const usdcAddress = (TESTNET_USDC_ADDRESSES as Record<string, string>)[String(chainId)]?.toLowerCase();

    // Scan logs for USDC Transfer events to the recipient
    for (const log of receipt.logs) {
      // Check if this log is from the USDC contract
      if (usdcAddress && log.address?.toLowerCase() !== usdcAddress) continue;

      // Check topics: Transfer event has 3 topics (sig, from, to)
      if (log.topics?.[0] !== ERC20_TRANSFER_EVENT_SIG) continue;

      // Decode 'to' address from topic[2] (padded to 32 bytes)
      const toAddress = '0x' + log.topics[2]?.slice(26);
      if (toAddress?.toLowerCase() !== recipientLower) continue;

      // Decode amount from data (hex big-endian)
      const amountHex = log.data || '0x0';
      const amount = BigInt(amountHex);
      const sender = '0x' + log.topics[1]?.slice(26);

      return { amount, sender, blockTime };
    }

    return null;
  } catch (err) {
    console.warn('EVM receipt parsing failed:', err);
    return null;
  }
}

// ── Solana RPC helpers ────────────────────────────────────────────

/**
 * Check a Solana transaction for USDC token transfers to the expected recipient.
 */
async function checkSolanaTransfer(
  signature: string,
  expectedRecipient: string
): Promise<{ amount: bigint; sender: string; blockTime: number | null } | null> {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const tx = data?.result;
    if (!tx?.meta?.postTokenBalances) return null;

    const blockTime = tx.blockTime ? tx.blockTime * 1000 : null;

    // Find the recipient's post-token balance to infer amount
    const recipientLower = expectedRecipient.toLowerCase();

    // Scan token balance changes
    const preBalances = tx.meta.preTokenBalances || [];
    const postBalances = tx.meta.postTokenBalances || [];

    // Find the USDC mint
    const usdcMint = process.env.SOLANA_USDC_MINT || '4zMMC9srtvSqzRLsS51uVtoQpYp5yFdC8PYy8Y79zNLX';
    const usdcMintLower = usdcMint.toLowerCase();

    const recipientPre = preBalances.find(
      (b: any) => b.owner?.toLowerCase() === recipientLower && b.mint?.toLowerCase() === usdcMintLower
    );

    const recipientPost = postBalances.find(
      (b: any) => b.owner?.toLowerCase() === recipientLower && b.mint?.toLowerCase() === usdcMintLower
    );

    if (recipientPre && recipientPost) {
      const preAmount = BigInt(recipientPre.uiTokenAmount?.amount || '0');
      const postAmount = BigInt(recipientPost.uiTokenAmount?.amount || '0');
      const diff = postAmount - preAmount;

      if (diff > 0) {
        // Find sender from the instructions
        const instructions = tx.transaction?.message?.instructions || [];
        const senderIx = instructions.find((ix: any) =>
          ix.parsed?.info?.destination?.toLowerCase() === recipientLower
        );
        const sender = senderIx?.parsed?.info?.source || 'unknown';

        return { amount: diff, sender, blockTime };
      }
    }

    return null;
  } catch (err) {
    console.warn('Solana transfer check failed:', err);
    return null;
  }
}

// ── Main Service ──────────────────────────────────────────────────

export class PayoutVerifierService {
  /**
   * Verify a payout using Circle API transfer status.
   */
  async verifyCircleTransfer(
    transferId: string,
    expectedRecipient: string,
    expectedAmount: number
  ): Promise<VerificationResult> {
    try {
      const response = await realCircleService.getTransactionStatus(transferId);
      const tx = response.data?.transaction || response.data;

      if (!tx) {
        return {
          verified: false,
          provider: 'circle',
          actualAmount: null,
          payoutTimestamp: null,
          payoutTxHash: transferId,
          senderAddress: null,
          confidence: 'low',
          details: 'Circle transfer not found or API unavailable.',
        };
      }

      const actualAmount = parseFloat(tx.amount?.amount || '0');
      const amountMatch = Math.abs(actualAmount - expectedAmount) < 0.01;
      const recipientMatch =
        tx.destinationAddress?.toLowerCase() === expectedRecipient.toLowerCase();

      const status = tx.status?.toLowerCase();
      const isComplete = status === 'complete' || status === 'paid';

      if (isComplete && amountMatch && recipientMatch) {
        return {
          verified: true,
          provider: 'circle',
          actualAmount,
          payoutTimestamp: tx.completeAt || tx.createDate || null,
          payoutTxHash: transferId,
          senderAddress: tx.sourceWalletId || null,
          confidence: 'high',
          details: `Circle transfer complete. ${actualAmount} USDC sent to ${expectedRecipient}.`,
        };
      }

      // Partial match
      const issues: string[] = [];
      if (!isComplete) issues.push(`Status: ${status}`);
      if (!amountMatch) issues.push(`Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`);
      if (!recipientMatch) issues.push('Recipient address mismatch');

      return {
        verified: false,
        provider: 'circle',
        actualAmount,
        payoutTimestamp: tx.completeAt || tx.createDate || null,
        payoutTxHash: transferId,
        senderAddress: tx.sourceWalletId || null,
        confidence: isComplete ? 'medium' : 'low',
        details: issues.join('; ') || 'Circle transfer verification failed.',
      };
    } catch (err: any) {
      return {
        verified: false,
        provider: 'circle',
        actualAmount: null,
        payoutTimestamp: null,
        payoutTxHash: transferId,
        senderAddress: null,
        confidence: 'low',
        details: `Circle API error: ${err.message}`,
      };
    }
  }

  /**
   * Verify a payout using on-chain EVM transaction logs.
   */
  async verifyOnChainTransfer(
    txHash: string,
    chainId: string | number,
    expectedRecipient: string,
    expectedAmount: number
  ): Promise<VerificationResult> {
    try {
      const parsed = await parseEVMTransferReceipt(txHash, chainId, expectedRecipient);

      if (!parsed) {
        return {
          verified: false,
          provider: 'evm',
          actualAmount: null,
          payoutTimestamp: null,
          payoutTxHash: txHash,
          senderAddress: null,
          confidence: 'low',
          details: 'No USDC Transfer event found for this recipient in the transaction.',
        };
      }

      // USDC has 6 decimals
      const actualAmount = Number(parsed.amount) / 1_000_000;
      const amountMatch = Math.abs(actualAmount - expectedAmount) < 0.01;

      if (amountMatch) {
        return {
          verified: true,
          provider: 'evm',
          actualAmount,
          payoutTimestamp: parsed.blockTime ? new Date(parsed.blockTime).toISOString() : null,
          payoutTxHash: txHash,
          senderAddress: parsed.sender,
          confidence: 'high',
          details: `On-chain USDC transfer confirmed. ${actualAmount} USDC sent to ${expectedRecipient}.`,
        };
      }

      return {
        verified: false,
        provider: 'evm',
        actualAmount,
        payoutTimestamp: parsed.blockTime ? new Date(parsed.blockTime).toISOString() : null,
        payoutTxHash: txHash,
        senderAddress: parsed.sender,
        confidence: 'medium',
        details: `Amount mismatch: expected ${expectedAmount}, on-chain shows ${actualAmount} USDC.`,
      };
    } catch (err: any) {
      return {
        verified: false,
        provider: 'evm',
        actualAmount: null,
        payoutTimestamp: null,
        payoutTxHash: txHash,
        senderAddress: null,
        confidence: 'low',
        details: `On-chain verification failed: ${err.message}`,
      };
    }
  }

  /**
   * Verify a payout via Solana token transfer.
   */
  async verifySolanaTransfer(
    signature: string,
    expectedRecipient: string,
    expectedAmount: number
  ): Promise<VerificationResult> {
    try {
      const parsed = await checkSolanaTransfer(signature, expectedRecipient);

      if (!parsed) {
        return {
          verified: false,
          provider: 'solana',
          actualAmount: null,
          payoutTimestamp: null,
          payoutTxHash: signature,
          senderAddress: null,
          confidence: 'low',
          details: 'No USDC transfer found for this recipient in the Solana transaction.',
        };
      }

      // Solana USDC has 6 decimals
      const actualAmount = Number(parsed.amount) / 1_000_000;
      const amountMatch = Math.abs(actualAmount - expectedAmount) < 0.01;

      if (amountMatch) {
        return {
          verified: true,
          provider: 'solana',
          actualAmount,
          payoutTimestamp: parsed.blockTime ? new Date(parsed.blockTime).toISOString() : null,
          payoutTxHash: signature,
          senderAddress: parsed.sender,
          confidence: 'high',
          details: `Solana USDC transfer confirmed. ${actualAmount} USDC sent to ${expectedRecipient}.`,
        };
      }

      return {
        verified: false,
        provider: 'solana',
        actualAmount,
        payoutTimestamp: parsed.blockTime ? new Date(parsed.blockTime).toISOString() : null,
        payoutTxHash: signature,
        senderAddress: parsed.sender,
        confidence: 'medium',
        details: `Amount mismatch: expected ${expectedAmount}, on-chain shows ${actualAmount} USDC.`,
      };
    } catch (err: any) {
      return {
        verified: false,
        provider: 'solana',
        actualAmount: null,
        payoutTimestamp: null,
        payoutTxHash: signature,
        senderAddress: null,
        confidence: 'low',
        details: `Solana verification failed: ${err.message}`,
      };
    }
  }

  /**
   * Record a payout attestation in Firestore.
   */
  async recordAttestation(
    attestation: PayoutAttestation
  ): Promise<string | null> {
    try {
      // Dynamic import for server-only Firestore
      const { db } = await import('@/lib/firebase/serverOnly');

      const docRef = await db.collection('payoutAttestations').add({
        ...attestation,
        createdAt: new Date().toISOString(),
      });

      return docRef.id;
    } catch (err) {
      console.warn('Failed to record attestation:', err);
      return null;
    }
  }

  /**
   * Get all attestations for a project (for display on the detail page).
   */
  async getAttestationsForProject(projectSlug: string): Promise<PayoutAttestation[]> {
    try {
      const { db } = await import('@/lib/firebase/serverOnly');
      const snap = await db
        .collection('payoutAttestations')
        .where('projectSlug', '==', projectSlug)
        .orderBy('createdAt', 'desc')
        .get();

      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayoutAttestation));
    } catch (err) {
      console.warn('Failed to fetch attestations:', err);
      return [];
    }
  }

  /**
   * Unified verify method that dispatches based on available evidence.
   */
  async verify(claim: PayoutClaim): Promise<{ result: VerificationResult; attestationId?: string }> {
    let result: VerificationResult;

    // 1. If Circle transfer ID is provided, use Circle verification
    if (claim.circleTransferId) {
      result = await this.verifyCircleTransfer(
        claim.circleTransferId,
        claim.winnerAddress,
        claim.expectedAmount
      );
    }
    // 2. If EVM tx hash and chain ID are provided, use on-chain verification
    else if (claim.payoutTxHash && claim.chainId && claim.chainId !== 'sol-devnet' && claim.chainId !== 'sol') {
      result = await this.verifyOnChainTransfer(
        claim.payoutTxHash,
        claim.chainId,
        claim.winnerAddress,
        claim.expectedAmount
      );
    }
    // 3. If Solana signature is provided
    else if (claim.payoutTxHash && (claim.chainId === 'sol-devnet' || claim.chainId === 'sol')) {
      result = await this.verifySolanaTransfer(
        claim.payoutTxHash,
        claim.winnerAddress,
        claim.expectedAmount
      );
    }
    // 4. No verifiable evidence
    else {
      result = {
        verified: false,
        provider: 'manual',
        actualAmount: null,
        payoutTimestamp: null,
        payoutTxHash: null,
        senderAddress: null,
        confidence: 'low',
        details: 'No payout transaction hash or Circle transfer ID provided. Mark as paid manually.',
      };
    }

    // Record attestation
    const attestationId = await this.recordAttestation({
      projectSlug: claim.hackathonName.toLowerCase().replace(/\s+/g, '-'),
      hackathonName: claim.hackathonName,
      winnerAddress: claim.winnerAddress,
      expectedAmount: claim.expectedAmount,
      verification: result,
      attestorType: 'agent',
      attestedAt: new Date().toISOString(),
      sourceTxHash: claim.payoutTxHash || claim.circleTransferId,
    });

    return { result, attestationId: attestationId || undefined };
  }
}

// Export singleton
export const payoutVerifierService = new PayoutVerifierService();
export default payoutVerifierService;
