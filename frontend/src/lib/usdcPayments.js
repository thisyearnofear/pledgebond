/**
 * USDC Payment Service
 * Thin wrapper around RealCircleService for backward compatibility.
 * Delegates all Circle API calls to the W3S-based RealCircleService.
 *
 * The old @circle-fin/circle-sdk dependency has been removed.
 */

import { realCircleService } from '../services/RealCircleService';
// Re-export client-safe formatters so existing server-side callers that
// already import usdcPayments keep working. Client components should
// import these from @/lib/format instead to avoid pulling the
// server-only RealCircleService chain into the browser bundle.
export { formatUSDC } from './format';

export class USDCPaymentService {
  constructor() {
    this.environment = process.env.CIRCLE_ENVIRONMENT || 'sandbox';
  }

  /**
   * Create a wallet for a user
   */
  async createWallet(userId) {
    const result = await realCircleService.createWallet({
      name: `POS Dashboard wallet for user ${userId}`,
      description: `Wallet for user ${userId}`,
      userId,
    });
    return result.data;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(walletId) {
    const result = await realCircleService.getWalletBalances(walletId);
    return result.data;
  }

  /**
   * Transfer USDC to a recipient
   */
  async transferUSDC(sourceWalletId, destinationAddress, amount) {
    const result = await realCircleService.createTransaction({
      walletId: sourceWalletId,
      amount: amount.toString(),
      destinationAddress,
    });
    return result.data;
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(transferId) {
    const result = await realCircleService.getTransactionStatus(transferId);
    return result.data;
  }

  /**
   * Get funding history for a developer from Firestore.
   */
  async getFundingHistory(developerAddress) {
    try {
      const { db } = await import('@/lib/firebase/serverOnly');
      const snap = await db
        .collection('PayoutLogs')
        .where('testerId', '==', developerAddress)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch {
      return [];
    }
  }

  /**
   * Check if Circle API is properly configured
   */
  isConfigured() {
    return realCircleService.isWalletConfigured();
  }

  /**
   * Get current environment
   */
  getEnvironment() {
    return this.environment;
  }

  /**
   * Validate wallet address format
   */
  validateWalletAddress(address) {
    if (!address || typeof address !== 'string') {
      return false;
    }
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get supported chains for current environment
   */
  getSupportedChains() {
    if (this.environment === 'sandbox') {
      return [
        { id: 'ARC', name: 'Arc Testnet', testnet: true },
        { id: 'ETH-SEPOLIA', name: 'Ethereum Sepolia', testnet: true },
        { id: 'MATIC-MUMBAI', name: 'Polygon Mumbai', testnet: true },
      ];
    } else {
      return [
        { id: 'ARC', name: 'Arc', testnet: false },
        { id: 'ETH', name: 'Ethereum Mainnet', testnet: false },
        { id: 'MATIC', name: 'Polygon Mainnet', testnet: false },
      ];
    }
  }

  /**
   * Transfer USDC with custom reason/description.
   * The source wallet must be a server-controlled wallet; callers may not
   * choose which platform wallet is debited.
   */
  async transferUSDCWithReason(sourceWalletId, destinationAddress, amount, reason = 'Platform disbursement', meta = {}) {
    if (!realCircleService.isServerControlledWallet(sourceWalletId)) {
      throw new Error('Refusing to spend from a non-server-controlled wallet');
    }
    const result = await realCircleService.createTransaction({
      walletId: sourceWalletId,
      amount: amount.toString(),
      destinationAddress,
      metadata: { reason },
    });

    // Every outbound transfer gets a ledger row so total platform
    // disbursement is answerable at any time.
    await realCircleService.recordDisbursement({
      circleTxId: result.data?.id || result.data?.transaction?.id,
      amount: amount.toString(),
      reason,
      destinationAddress,
      ...meta,
    });

    return result.data;
  }
}

// Export singleton instance
export const usdcPaymentService = new USDCPaymentService();

export default USDCPaymentService;
