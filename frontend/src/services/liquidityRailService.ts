/**
 * LiquidityRailService — viem bindings for the bridge-loan rail.
 *
 * Replaces creditService. Mirrors its calling convention (chainId + clients
 * leading, USDC 6-decimals, try/catch defaults) so callers read the same way.
 *
 * Deliberately NOT registered in lib/chains/registry.ts: that registry has no
 * consumers and its two services have incompatible signatures, so extending it
 * would add indirection for nothing. EVM only — the rail is EVM-only.
 *
 * Every read degrades to a defined shape when the contract is not deployed on
 * a network. Nothing here throws for "not deployed"; writes throw loudly,
 * because silently doing nothing on a loan would be worse than an error.
 */

import { getContract, formatUnits, parseUnits, maxUint256 } from 'viem';
import type { PublicClient, WalletClient } from 'viem';

import {
  ERC20_ABI,
  HACKATHON_REGISTRY_ABI,
  LIQUIDITY_RAIL_ABI,
} from '../constants/abis';
import {
  LIQUIDITY_RAIL_ADDRESSES,
  USDC_ADDRESSES,
  HACKATHON_REGISTRY_ADDRESSES,
} from '../config/tokens';

// Human-readable ABI strings; viem's parseAbi can't express tuple syntax.
const railAbi = LIQUIDITY_RAIL_ABI as unknown as readonly any[];
const erc20Abi = ERC20_ABI as unknown as readonly any[];
const registryAbi = HACKATHON_REGISTRY_ABI as unknown as readonly any[];

const USDC_DECIMALS = 6;

export const LOAN_MODES = {
  OVERCOLLATERALIZED: 0,
  TRANCHE_BACKED: 1,
} as const;

export const LOAN_STATUS = {
  NONE: 0,
  OPEN: 1,
  REPAID: 2,
  DEFAULTED: 3,
} as const;

export const WIN_STATUS = {
  NONE: 0,
  DECLARED: 1,
  SETTLED: 2,
  DEFAULTED: 3,
} as const;

/**incentives bitfield flags a builder can commit to. */
export const INCENTIVES = {
  ROUTE_NEXT_PRIZE: 1 << 0,
  REPAY_EARLY: 1 << 1,
  NO_COMPETING_HACKATHON: 1 << 2,
} as const;

export interface RailCredibility {
  winsDeclared: number;
  loansTaken: number;
  winsSettledInFull: number;
  winsDefaulted: number;
  /** Wins settled in full, per 10,000 resolved wins. */
  coverageRateBps: number;
  /** Mean days from declared win to recorded payout. */
  averageDaysToPay: number;
}

export interface LoanPosition {
  winId: number;
  lender: string;
  builder: string;
  principal: string;
  collateral: string;
  trancheSize: string;
  originationFee: string;
  dueAt: number;
  mode: number;
  status: number;
}

export interface LoanTerms {
  principal: string;
  collateral?: string;
  trancheSize?: string;
  trancheProvider?: `0x${string}` | null;
  rateBps: number;
  durationDays: number;
  incentives?: number;
}

interface Contracts {
  rail: any;
  usdc: any;
  registry: any;
  railAddress: `0x${string}`;
}

const EMPTY_CREDIBILITY: RailCredibility = {
  winsDeclared: 0,
  loansTaken: 0,
  winsSettledInFull: 0,
  winsDefaulted: 0,
  coverageRateBps: 0,
  averageDaysToPay: 0,
};

class LiquidityRailService {
  getContracts(
    chainId: number | undefined,
    publicClient: PublicClient,
    walletClient?: WalletClient
  ): Contracts | null {
    if (!chainId) return null;
    const railAddress = (LIQUIDITY_RAIL_ADDRESSES as Record<number, string>)[
      chainId
    ] as `0x${string}`;
    const usdcAddress = (USDC_ADDRESSES as Record<number, string>)[
      chainId
    ] as `0x${string}`;
    const registryAddress = (HACKATHON_REGISTRY_ADDRESSES as Record<number, string>)[
      chainId
    ] as `0x${string}`;
    if (!railAddress || !usdcAddress || !registryAddress) {
      throw new Error(`Rail not supported on network ${chainId}`);
    }
    const client = walletClient
      ? { public: publicClient, wallet: walletClient }
      : { public: publicClient };
    return {
      rail: getContract({ address: railAddress, abi: railAbi, client }),
      usdc: getContract({ address: usdcAddress, abi: erc20Abi, client }),
      registry: getContract({ address: registryAddress, abi: registryAbi, client }),
      railAddress,
    };
  }

  /** True when this chain has a real deployment (tokens.js lists none otherwise). */
  isDeployed(chainId: number | undefined): boolean {
    if (!chainId) return false;
    return Boolean((LIQUIDITY_RAIL_ADDRESSES as Record<number, string>)[chainId]);
  }

  async getBounds(
    chainId: number,
    publicClient: PublicClient
  ): Promise<{ maxLoanSize: bigint; maxRateBps: bigint; maxLoanDuration: bigint } | null> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return null;
      const [maxLoanSize, maxRateBps, maxLoanDuration] = await Promise.all([
        contracts.rail.read.maxLoanSize(),
        contracts.rail.read.maxRateBps(),
        contracts.rail.read.maxLoanDuration(),
      ]);
      return { maxLoanSize, maxRateBps, maxLoanDuration };
    } catch {
      return null;
    }
  }

  async getWin(
    chainId: number,
    publicClient: PublicClient,
    winId: number
  ): Promise<{ builder: string; prizeAmount: string; declaredAt: number; status: number } | null> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return null;
      const win = await contracts.rail.read.wins([BigInt(winId)]);
      if (!win || win.builder === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      return {
        builder: win.builder,
        prizeAmount: formatUnits(win.prizeAmount, USDC_DECIMALS),
        declaredAt: Number(win.declaredAt),
        status: Number(win.status),
      };
    } catch {
      return null;
    }
  }

  async getLoan(
    chainId: number,
    publicClient: PublicClient,
    winId: number
  ): Promise<LoanPosition | null> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return null;
      const loan = await contracts.rail.read.loans([BigInt(winId)]);
      if (!loan || Number(loan.status) === LOAN_STATUS.NONE) return null;
      return {
        winId: Number(loan.winId),
        lender: loan.lender,
        builder: loan.builder,
        principal: formatUnits(loan.principal, USDC_DECIMALS),
        collateral: formatUnits(loan.collateral, USDC_DECIMALS),
        trancheSize: formatUnits(loan.trancheSize, USDC_DECIMALS),
        originationFee: formatUnits(loan.originationFee, USDC_DECIMALS),
        dueAt: Number(loan.dueAt),
        mode: Number(loan.mode),
        status: Number(loan.status),
      };
    } catch {
      return null;
    }
  }

  async getBuilderCredibility(
    chainId: number,
    publicClient: PublicClient,
    builder: string
  ): Promise<RailCredibility> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return { ...EMPTY_CREDIBILITY };
      const [history, coverageRateBps, averageDaysToPay] = await Promise.all([
        contracts.rail.read.builderHistory([builder as `0x${string}`]),
        contracts.rail.read.coverageRateBps([builder as `0x${string}`]),
        contracts.rail.read.averageDaysToPay([builder as `0x${string}`]),
      ]);
      return {
        winsDeclared: Number(history.winsDeclared),
        loansTaken: Number(history.loansTaken),
        winsSettledInFull: Number(history.winsSettledInFull),
        winsDefaulted: Number(history.winsDefaulted),
        coverageRateBps: Number(coverageRateBps),
        averageDaysToPay: Number(averageDaysToPay),
      };
    } catch {
      return { ...EMPTY_CREDIBILITY };
    }
  }

  /** True when the registry has recorded a payout for this builder. */
  async isPayoutRecorded(
    chainId: number,
    publicClient: PublicClient,
    hackathonId: number,
    winner: string
  ): Promise<boolean> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return false;
      const declarations = await contracts.registry.read.getWinnerDeclarations([
        BigInt(hackathonId),
      ]);
      return (declarations as any[]).some(
        (d) => d.winner?.toLowerCase() === winner.toLowerCase() && Number(d.paidAt) > 0
      );
    } catch {
      return false;
    }
  }

  // ── Writes ──────────────────────────────────────────────────────────────
  // These throw rather than resolving empty. Silently no-op'ing a loan
  // request would leave a builder thinking they had drawn when they hadn't.

  async declareWin(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    args: { hackathonId: number; builder: string; projectName: string; prizeAmount: string }
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.declareWin([
      BigInt(args.hackathonId),
      args.builder as `0x${string}`,
      args.projectName,
      parseUnits(args.prizeAmount, USDC_DECIMALS),
    ] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  /**
   * Overcollateralized: pass `collateral` >= principal.
   * Tranche-backed: pass `trancheSize` >= principal and a third-party
   * `trancheProvider` (never the lender — self-funded protection is not
   * protection).
   */
  async openLoan(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    winId: number,
    terms: LoanTerms
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');

    const account = walletClient.account!.address;
    const principal = parseUnits(terms.principal, USDC_DECIMALS);
    const collateral = terms.collateral
      ? parseUnits(terms.collateral, USDC_DECIMALS)
      : 0n;
    const trancheSize = terms.trancheSize
      ? parseUnits(terms.trancheSize, USDC_DECIMALS)
      : 0n;
    const trancheProvider =
      (terms.trancheProvider as `0x${string}`) ||
      '0x0000000000000000000000000000000000000000';

    // Collateral or tranche is escrowed; principal flows straight through.
    const escrowed = collateral > 0n ? collateral : trancheSize;
    const from = collateral > 0n ? account : trancheProvider;
    await this._ensureAllowance(publicClient, contracts, from, escrowed);

    const hash = await contracts.rail.write.openLoan([
      BigInt(winId),
      principal,
      collateral,
      trancheSize,
      trancheProvider,
      BigInt(terms.rateBps),
      BigInt(terms.durationDays),
      BigInt(terms.incentives ?? 0),
    ] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async settleLoan(chainId: number, publicClient: PublicClient, winId: number) {
    const contracts = this.getContracts(chainId, publicClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.settleLoan([BigInt(winId)] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async defaultLoan(chainId: number, publicClient: PublicClient, winId: number) {
    const contracts = this.getContracts(chainId, publicClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.defaultLoan([BigInt(winId)] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  private async _ensureAllowance(
    publicClient: PublicClient,
    contracts: Contracts,
    owner: string,
    amount: bigint
  ) {
    if (amount <= 0n) return;
    const allowance = (await contracts.usdc.read.allowance([
      owner as `0x${string}`,
      contracts.railAddress,
    ])) as bigint;
    if (allowance >= amount) return;
    // Approval must be sent by `owner`; only works for the connected wallet.
    if (contracts.usdc.write) {
      const approveTx = await contracts.usdc.write.approve([
        contracts.railAddress,
        maxUint256,
      ] as any);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
  }
}

export const liquidityRailService = new LiquidityRailService();
export default liquidityRailService;