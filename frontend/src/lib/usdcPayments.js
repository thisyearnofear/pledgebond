/**
 * USDC Payment Service
 * Thin wrapper around RealCircleService for backward compatibility.
 * Delegates all Circle API calls to the W3S-based RealCircleService.
 *
 * The old @circle-fin/circle-sdk dependency has been removed.
 */

import { realCircleService, calculateFundingAmount } from '../services/RealCircleService';
import { getFundingTier } from './format';
// Re-export client-safe formatters so existing server-side callers that
// already import usdcPayments keep working. Client components should
// import these from @/lib/format instead to avoid pulling the
// server-only RealCircleService chain into the browser bundle.
export { formatUSDC, getFundingTier } from './format';

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
   * Process developer funding based on credit score.
   * Returns a result object (does not throw on eligibility failure).
   */
  async processDeveloperFunding(developerAddress, creditScore, creditData = {}) {
    if (creditScore < 400) {
      throw new Error('Credit score too low for funding eligibility');
    }

    const fundingAmount = this.calculateFundingAmount(creditScore);
    const fundingReason = `Developer funding - Credit Score: ${creditScore}, Amount: $${fundingAmount}`;

    const transfer = await this.executeFundingTransfer(
      developerAddress,
      fundingAmount,
      fundingReason
    );

    return {
      success: true,
      transfer,
      amount: fundingAmount,
      creditScore,
      developerAddress,
      environment: this.environment,
      message: 'Funding transfer completed successfully'
    };
  }

  /**
   * Calculate funding amount based on credit score.
   * Delegates to the standalone pure function from RealCircleService.
   */
  calculateFundingAmount(creditScore) {
    return calculateFundingAmount(creditScore);
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
   * Get funding eligibility info
   */
  getFundingEligibility(creditScore) {
    const amount = this.calculateFundingAmount(creditScore);
    const tier = getFundingTier(creditScore);

    return {
      eligible: creditScore >= 400,
      amount,
      tier,
      creditScore,
      requirements: creditScore < 400 ? [
        'Credit score must be at least 400',
        'Complete credit profile verification',
        'Link GitHub account with active repositories'
      ] : [],
      benefits: amount > 0 ? [
        `Up to $${amount} in USDC funding`,
        'No upfront collateral required',
        'Flexible repayment terms',
        'Build credit history through successful projects'
      ] : []
    };
  }

  /**
   * Estimate transaction fees
   */
  estimateTransactionFees(chain = 'ETH-SEPOLIA', amount = 0) {
    const baseFees = {
      'ETH': { gas: 0.005, platform: 0.01 },
      'ETH-SEPOLIA': { gas: 0.001, platform: 0.005 },
      'MATIC': { gas: 0.001, platform: 0.005 },
      'MATIC-MUMBAI': { gas: 0.0005, platform: 0.002 }
    };

    const fees = baseFees[chain] || baseFees['ETH-SEPOLIA'];
    const totalFees = fees.gas + fees.platform;

    return {
      gasEstimate: fees.gas,
      platformFee: fees.platform,
      totalFees,
      netAmount: Math.max(0, amount - totalFees),
      chain,
      currency: 'USD'
    };
  }

  /**
   * Transfer USDC with custom reason/description
   */
  async transferUSDCWithReason(sourceWalletId, destinationAddress, amount, reason = 'Developer funding') {
    const result = await realCircleService.createTransaction({
      walletId: sourceWalletId,
      amount: amount.toString(),
      destinationAddress,
      metadata: { reason },
    });
    return result.data;
  }

  /**
   * Get platform wallet for funding operations
   */
  async getPlatformWallet() {
    const walletId = process.env.CIRCLE_PLATFORM_WALLET_ID;
    if (!walletId) {
      throw new Error('Circle platform wallet ID not configured. Please set CIRCLE_PLATFORM_WALLET_ID environment variable.');
    }
    const result = await realCircleService.getWalletById(walletId);
    return result.data;
  }

  /**
   * Execute actual funding transfer to developer
   */
  async executeFundingTransfer(developerAddress, amount, reason = 'Developer funding based on credit score') {
    const platformWallet = await this.getPlatformWallet();
    return await this.transferUSDCWithReason(
      platformWallet.id || platformWallet.wallet?.id,
      developerAddress,
      amount,
      reason
    );
  }
}

// Export singleton instance
export const usdcPaymentService = new USDCPaymentService();

export default USDCPaymentService;
