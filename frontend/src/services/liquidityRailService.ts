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

import { getContract, formatUnits, parseUnits, maxUint256, parseAbiItem, parseAbi, decodeEventLog } from 'viem';
import type { PublicClient, WalletClient } from 'viem';

import {
  ERC20_ABI,
  HACKATHON_REGISTRY_ABI,
  LIQUIDITY_RAIL_ABI,
} from '../constants/abis';
import {
  LIQUIDITY_RAIL_ADDRESSES,
  LIQUIDITY_RAIL_START_BLOCKS,
  USDC_ADDRESSES,
  HACKATHON_REGISTRY_ADDRESSES,
} from '../config/tokens';

// constants/abis.js stores human-readable signatures; getContract needs them parsed.
const railAbi = parseAbi(LIQUIDITY_RAIL_ABI as unknown as string[]);
const erc20Abi = parseAbi(ERC20_ABI as unknown as string[]);
const registryAbi = parseAbi(HACKATHON_REGISTRY_ABI as unknown as string[]);

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

export interface DeclaredWin {
  winId: number;
  hackathonId: number;
  builder: string;
  projectName: string;
  prizeAmount: string;
  declaredAt: number;
}

export interface WinHistoryRecord {
  winId: number;
  projectName: string;
  builder: string;
  prizeAmount: string;
  declaredAt: number;
  txHash: string;
  /** WinStatus: 1 DECLARED, 2 SETTLED, 3 DEFAULTED. */
  winStatus: number;
  /** LoanStatus: 0 none, 1 open, 2 repaid, 3 defaulted. */
  loanStatus: number;
  principal: string | null;
  lender: string | null;
  dueAt: number | null;
  daysToPay: number | null;
  betsCount: number;
  betPool: string | null;
  /** BetOutcome: 0 unresolved, 1 PAID, 2 UNPAID. */
  betOutcome: number;
}

const WIN_DECLARED_EVENT = parseAbiItem(
  'event WinDeclared(uint256 indexed winId, uint256 indexed hackathonId, address indexed builder, string projectName, uint256 prizeAmount, uint256 declaredAt)'
);

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
      // viem returns multi-output reads as positional arrays.
      const [, builder, prizeAmount, declaredAt, , status] = win as any[];
      if (!win || builder === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      return {
        builder,
        prizeAmount: formatUnits(prizeAmount, USDC_DECIMALS),
        declaredAt: Number(declaredAt),
        status: Number(status),
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
      const [
        loanWinId,
        lender,
        builder,
        ,
        principal,
        collateral,
        trancheSize,
        originationFee,
        dueAt,
        mode,
        status,
      ] = loan as any[];
      if (!loan || Number(status) === LOAN_STATUS.NONE) return null;
      return {
        winId: Number(loanWinId),
        lender,
        builder,
        principal: formatUnits(principal, USDC_DECIMALS),
        collateral: formatUnits(collateral, USDC_DECIMALS),
        trancheSize: formatUnits(trancheSize, USDC_DECIMALS),
        originationFee: formatUnits(originationFee, USDC_DECIMALS),
        dueAt: Number(dueAt),
        mode: Number(mode),
        status: Number(status),
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
      const [
        winsDeclared,
        loansTaken,
        ,
        winsSettledInFull,
        winsDefaulted,
      ] = history as any[];
      return {
        winsDeclared: Number(winsDeclared),
        loansTaken: Number(loansTaken),
        winsSettledInFull: Number(winsSettledInFull),
        winsDefaulted: Number(winsDefaulted),
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
        (d) => d[0]?.toLowerCase() === winner.toLowerCase() && Number(d[4]) > 0
      );
    } catch {
      return false;
    }
  }

  /**
   * Declared wins on-chain that no one has funded yet — the lender's order
   * book. Sourced from WinDeclared events (the rail has no enumerable
   * index). Arc's public RPC rate-limits bursts, so the scan is sequential:
   * fixed-size chunks walking back from the head, capped at the deployment
   * start block or 10 chunks (20k blocks), whichever comes first, and the 50
   * most recent wins. Unfunded wins older than the cap are a cold-listing
   * concern, not a correctness one — see /api/rail/open-wins for the cache.
   */
  async listOpenWins(
    chainId: number,
    publicClient: PublicClient
  ): Promise<DeclaredWin[]> {
    const contracts = this.getContracts(chainId, publicClient);
    const startBlock = (LIQUIDITY_RAIL_START_BLOCKS as Record<number, number>)[chainId];
    if (!contracts || startBlock === undefined) return [];
    const CHUNK = 2000n;
    const MAX_CHUNKS = 10;
    const logs: any[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      const head = await publicClient.getBlockNumber();
      const start = BigInt(startBlock);
      let from = head;
      for (let scanned = 0; scanned < MAX_CHUNKS && from >= start; scanned++) {
        const chunkFrom = from - CHUNK + 1n < start ? start : from - CHUNK + 1n;
        const chunk = await publicClient.getLogs({
          address: contracts.railAddress,
          event: WIN_DECLARED_EVENT as any,
          fromBlock: chunkFrom,
          toBlock: from,
        });
        logs.push(...(chunk as any[]));
        if (chunkFrom === start) break;
        from = chunkFrom - 1n;
        await sleep(150);
      }
    } catch {
      if (logs.length === 0) return [];
      // Partial scan still lists what was found; fresher wins dominate.
    }
    const byId = new Map<number, (typeof logs)[number]>();
    for (const log of logs) {
      const winId = Number(log.args.winId);
      if (!byId.has(winId)) byId.set(winId, log);
    }
    const ids = [...byId.keys()].sort((a, b) => b - a).slice(0, 50);
    const readOne = async (winId: number): Promise<DeclaredWin | null> => {
      const log = byId.get(winId)!;
      try {
        const [win, loan] = await Promise.all([
          contracts.rail.read.wins([BigInt(winId)]),
          contracts.rail.read.loans([BigInt(winId)]),
        ]);
        if (
          Number((win as any[])[5]) !== WIN_STATUS.DECLARED ||
          Number((loan as any[])[10]) !== LOAN_STATUS.NONE
        ) {
          return null;
        }
        return {
          winId,
          hackathonId: Number((log.args as any).hackathonId),
          builder: (log.args as any).builder,
          projectName: (log.args as any).projectName,
          prizeAmount: formatUnits((log.args as any).prizeAmount, USDC_DECIMALS),
          declaredAt: Number((log.args as any).declaredAt),
        } as DeclaredWin;
      } catch {
        return null;
      }
    };
    // Small sequential batches; the public RPC rate-limits parallel bursts.
    const wins: DeclaredWin[] = [];
    for (let i = 0; i < ids.length; i += 5) {
      const batch = await Promise.all(ids.slice(i, i + 5).map(readOne));
      wins.push(...batch.filter(Boolean) as DeclaredWin[]);
      if (i + 5 < ids.length) await sleep(150);
    }
    return wins.sort((a, b) => b.winId - a.winId);
  }

  /**
   * Every declared win and what actually happened to it — the rail's public
   * track record, read for the lender discover panel. Same event scan as
   * listOpenWins but unfiltered (one getLogs per chunk decodes WinDeclared
   * and BetPlaced locally), then wins/loans/betOutcome per win. The bet pool
   * comes from BetPlaced sums so resolving market size costs zero extra reads.
   */
  async listWinHistory(
    chainId: number,
    publicClient: PublicClient
  ): Promise<WinHistoryRecord[]> {
    const contracts = this.getContracts(chainId, publicClient);
    const startBlock = (LIQUIDITY_RAIL_START_BLOCKS as Record<number, number>)[chainId];
    if (!contracts || startBlock === undefined) return [];
    const CHUNK = 2000n;
    const MAX_CHUNKS = 10;
    const declared = new Map<
      number,
      { projectName: string; builder: string; prizeAmount: bigint; declaredAt: bigint; txHash: string }
    >();
    const betSums = new Map<number, { count: number; pool: bigint }>();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      const head = await publicClient.getBlockNumber();
      const start = BigInt(startBlock);
      let from = head;
      for (let scanned = 0; scanned < MAX_CHUNKS && from >= start; scanned++) {
        const chunkFrom = from - CHUNK + 1n < start ? start : from - CHUNK + 1n;
        const logs = await publicClient.getLogs({
          address: contracts.railAddress,
          fromBlock: chunkFrom,
          toBlock: from,
        });
        for (const log of logs as any[]) {
          let decoded: any;
          try {
            decoded = decodeEventLog({
              abi: railAbi,
              data: log.data,
              topics: log.topics,
            });
          } catch {
            continue; // not a rail event we model
          }
          if (decoded.eventName === "WinDeclared") {
            const winId = Number(decoded.args.winId);
            if (!declared.has(winId)) {
              declared.set(winId, {
                projectName: decoded.args.projectName,
                builder: decoded.args.builder,
                prizeAmount: decoded.args.prizeAmount,
                declaredAt: decoded.args.declaredAt,
                txHash: log.transactionHash,
              });
            }
          } else if (decoded.eventName === "BetPlaced") {
            const winId = Number(decoded.args.winId);
            const prev = betSums.get(winId) || { count: 0, pool: 0n };
            betSums.set(winId, {
              count: prev.count + 1,
              pool: prev.pool + decoded.args.amount,
            });
          }
        }
        if (chunkFrom === start) break;
        from = chunkFrom - 1n;
        await sleep(150);
      }
    } catch {
      if (declared.size === 0) return [];
    }
    const ids = [...declared.keys()].sort((a, b) => b - a).slice(0, 30);
    const readOne = async (winId: number): Promise<WinHistoryRecord | null> => {
      const d = declared.get(winId)!;
      try {
        const [win, loan, outcome] = await Promise.all([
          contracts.rail.read.wins([BigInt(winId)]),
          contracts.rail.read.loans([BigInt(winId)]),
          contracts.rail.read.betOutcome([BigInt(winId)]),
        ]);
        const winStatus = Number((win as any[])[5]);
        const settledAt = Number((win as any[])[4]);
        const loanStatus = Number((loan as any[])[10]);
        const bets = betSums.get(winId);
        return {
          winId,
          projectName: d.projectName,
          builder: d.builder,
          prizeAmount: formatUnits(d.prizeAmount, USDC_DECIMALS),
          declaredAt: Number(d.declaredAt),
          txHash: d.txHash,
          winStatus,
          loanStatus,
          principal:
            loanStatus !== LOAN_STATUS.NONE
              ? formatUnits((loan as any[])[4], USDC_DECIMALS)
              : null,
          lender: loanStatus !== LOAN_STATUS.NONE ? (loan as any[])[1] : null,
          dueAt: loanStatus !== LOAN_STATUS.NONE ? Number((loan as any[])[8]) : null,
          daysToPay:
            winStatus === WIN_STATUS.SETTLED
              ? Math.max(0, Math.round((settledAt - Number(d.declaredAt)) / 86400))
              : null,
          betsCount: bets?.count ?? 0,
          betPool: bets ? formatUnits(bets.pool, USDC_DECIMALS) : null,
          betOutcome: Number(outcome),
        };
      } catch {
        return null;
      }
    };
    const rows: WinHistoryRecord[] = [];
    for (let i = 0; i < ids.length; i += 4) {
      const batch = await Promise.all(ids.slice(i, i + 4).map(readOne));
      rows.push(...batch.filter(Boolean) as WinHistoryRecord[]);
      if (i + 4 < ids.length) await sleep(150);
    }
    return rows.sort((a, b) => b.winId - a.winId);
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