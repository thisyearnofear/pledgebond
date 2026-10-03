/**
 * Tests for USDC Payment Service
 *
 * Phase 0 focus: the service must never disburse platform capital and must
 * refuse to spend from a wallet the caller chooses. The credit-scoring
 * funding model was removed; these tests lock in that it cannot return.
 */

import { USDCPaymentService, formatUSDC } from '../usdcPayments';
import { vi } from 'vitest';

// RealCircleService pulls in server-only Circle SDK + node:crypto, which the
// jsdom environment cannot resolve. Mock at the module boundary.
vi.mock('../../services/RealCircleService', () => ({
  realCircleService: {
    isServerControlledWallet: (walletId) =>
      ['wallet-payout-server', 'wallet-agent-server'].includes(walletId),
    getServerControlledWallets: () => [
      'wallet-payout-server',
      'wallet-agent-server',
    ],
    createTransaction: vi.fn(),
    recordDisbursement: vi.fn(async () => 'pb_test'),
    reconcilePayouts: vi.fn(async () => ({ checked: 0, completed: 0, failed: 0 })),
    getTransactionStatus: vi.fn(),
    getWalletBalances: vi.fn(),
    createWallet: vi.fn(),
    isWalletConfigured: () => false,
  },
}));

const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    CIRCLE_API_KEY: undefined,
    CIRCLE_ENVIRONMENT: 'sandbox',
    CIRCLE_PAYOUT_WALLET_ID: 'wallet-payout-server',
    CIRCLE_AGENT_WALLET_ID: 'wallet-agent-server',
    CIRCLE_PLATFORM_WALLET_ID: 'wallet-platform-legacy',
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('USDCPaymentService', () => {
  let service;

  beforeEach(() => {
    service = new USDCPaymentService();
  });

  describe('platform funding removal', () => {
    test('does not expose executeFundingTransfer', () => {
      expect(service.executeFundingTransfer).toBeUndefined();
    });

    test('does not expose a platform-wallet getter', () => {
      expect(service.getPlatformWallet).toBeUndefined();
    });

    test('does not expose credit-based funding helpers', () => {
      expect(service.calculateFundingAmount).toBeUndefined();
      expect(service.getFundingEligibility).toBeUndefined();
      expect(service.processDeveloperFunding).toBeUndefined();
    });
  });

  describe('server-controlled wallet enforcement', () => {
    test('refuses to spend from a wallet the caller supplied', async () => {
      await expect(
        service.transferUSDCWithReason(
          'wallet-someone-elses',
          '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
          '100',
          'test'
        )
      ).rejects.toThrow('Refusing to spend from a non-server-controlled wallet');
    });

    test('refuses the legacy platform wallet', async () => {
      // CIRCLE_PLATFORM_WALLET_ID is deliberately NOT in the allowlist.
      await expect(
        service.transferUSDCWithReason(
          'wallet-platform-legacy',
          '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
          '5000',
          'developer funding'
        )
      ).rejects.toThrow('Refusing to spend from a non-server-controlled wallet');
    });

    test('rejects an empty wallet id', async () => {
      await expect(
        service.transferUSDCWithReason(
          '',
          '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
          '100',
          'test'
        )
      ).rejects.toThrow('Refusing to spend from a non-server-controlled wallet');
    });

    test('records a disbursement row for every successful transfer', async () => {
      const { realCircleService } = await import('../../services/RealCircleService');
      realCircleService.createTransaction.mockResolvedValueOnce({
        data: { id: 'circle-tx-1' },
      });

      await service.transferUSDCWithReason(
        'wallet-payout-server',
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        '250',
        'tester_reward:demo',
        { projectSlug: 'demo' }
      );

      expect(realCircleService.recordDisbursement).toHaveBeenCalledWith(
        expect.objectContaining({
          circleTxId: 'circle-tx-1',
          amount: '250',
          reason: 'tester_reward:demo',
          projectSlug: 'demo',
        })
      );
    });

    test('records nothing when the transfer is refused', async () => {
      const { realCircleService } = await import('../../services/RealCircleService');
      realCircleService.recordDisbursement.mockClear();

      await expect(
        service.transferUSDCWithReason(
          'wallet-not-ours',
          '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
          '250',
          'tester_reward:demo'
        )
      ).rejects.toThrow();

      expect(realCircleService.recordDisbursement).not.toHaveBeenCalled();
    });
  });

  describe('validateWalletAddress', () => {
    test('validates correct Ethereum addresses', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
      expect(service.validateWalletAddress(validAddress)).toBe(true);
    });

    test('rejects invalid addresses', () => {
      expect(service.validateWalletAddress('invalid')).toBe(false);
      expect(service.validateWalletAddress('')).toBe(false);
      expect(service.validateWalletAddress(null)).toBe(false);
      expect(service.validateWalletAddress('0x123')).toBe(false);
    });
  });

  describe('configuration', () => {
    test('detects when API is not configured', () => {
      expect(service.isConfigured()).toBe(false);
    });

    test('returns correct environment', () => {
      expect(service.getEnvironment()).toBe('sandbox');
    });
  });
});

describe('Helper Functions', () => {
  describe('formatUSDC', () => {
    test('formats amounts correctly', () => {
      expect(formatUSDC(1000)).toBe('$1,000.00');
      expect(formatUSDC(1234.56)).toBe('$1,234.56');
      expect(formatUSDC(0)).toBe('$0.00');
    });
  });
});
