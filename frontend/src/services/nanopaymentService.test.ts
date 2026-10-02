import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPay = vi.fn();
const mockGetBalances = vi.fn();
const mockDeposit = vi.fn();
const mockWithdraw = vi.fn();
const mockConstructor = vi.fn();

vi.mock('@circle-fin/x402-batching/client', () => {
  return {
    GatewayClient: class {
      getBalances = mockGetBalances;
      deposit = mockDeposit;
      withdraw = mockWithdraw;
      pay = mockPay;
      constructor(config: any) {
        mockConstructor(config);
      }
    },
  };
});

import { nanopaymentService } from './nanopaymentService';

describe('nanopaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes Arc config without throwing (defaults to testnet)', async () => {
    await expect(
      nanopaymentService.initialize({
        chain: 'arcTestnet',
        privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
      })
    ).resolves.toBeTruthy();
    expect(mockConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ chain: 'arcTestnet' })
    );
  });

  it('initializes with "arc" input and resolves via env toggle', async () => {
    await nanopaymentService.initialize({
      chain: 'arc',
      privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    });
    // NEXT_PUBLIC_ARC_NETWORK is unset in tests → testnet
    expect(mockConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ chain: 'arcTestnet' })
    );
  });

  it('returns payment_required for 402 responses', async () => {
    mockPay.mockResolvedValueOnce({
      status: 402,
    });

    await nanopaymentService.initialize({
      chain: 'arcTestnet',
      privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    });

    const result = await nanopaymentService.pay('/api/agent/scout');
    expect(result.success).toBe(false);
    expect(result.status).toBe('payment_required');
  });

  it('maps v3 pay result to PaymentResult with settlement tx', async () => {
    mockPay.mockResolvedValueOnce({
      status: 200,
      data: { ok: true },
      transaction: '0xabc123',
    });

    await nanopaymentService.initialize({
      chain: 'arcTestnet',
      privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    });

    const result = await nanopaymentService.pay('/api/agent/scout');
    expect(result.success).toBe(true);
    expect(result.status).toBe('paid');
    expect(result.txHash).toBe('0xabc123');
  });

  it('maps v3 getBalances to {available, locked}', async () => {
    mockGetBalances.mockResolvedValueOnce({
      wallet: { balance: 0n, formatted: '0' },
      gateway: {
        total: 12_000_000n,
        available: 10_000_000n,
        withdrawing: 0n,
        withdrawable: 2_000_000n,
        formattedTotal: '12',
        formattedAvailable: '10',
        formattedWithdrawing: '0',
        formattedWithdrawable: '2',
      },
    });

    await nanopaymentService.initialize({
      chain: 'arcTestnet',
      privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    });

    const balance = await nanopaymentService.getBalance();
    expect(balance.available).toBe('10000000');
    expect(balance.locked).toBe('2000000');
  });

  it('deposit passes decimal string and returns depositTxHash', async () => {
    mockDeposit.mockResolvedValueOnce({ depositTxHash: '0xdep' });

    await nanopaymentService.initialize({
      chain: 'arcTestnet',
      privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    });

    const result = await nanopaymentService.deposit(5);
    expect(mockDeposit).toHaveBeenCalledWith('5');
    expect(result.txHash).toBe('0xdep');
  });

  it('withdraw passes decimal string and returns mintTxHash', async () => {
    mockWithdraw.mockResolvedValueOnce({ mintTxHash: '0xwit' });

    await nanopaymentService.initialize({
      chain: 'arcTestnet',
      privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    });

    const result = await nanopaymentService.withdraw(2.5);
    expect(mockWithdraw).toHaveBeenCalledWith('2.5');
    expect(result.txHash).toBe('0xwit');
  });
});
