/**
 * LiquidityRailService — viem bindings for the bridge-loan rail.
 *
 * Lifecycle on-chain: anchorWin → proposeLoan → commitTranche? → acceptLoan →
 * repayLoan | defaultLoan. The payout market resolves via resolveMarket and
 * pays out via claimWinnings. Nothing here throws for "not deployed" on
 * reads; writes throw loudly, because silently doing nothing on a loan would
 * be worse than an error.
 *
 * Deliberately NOT registered in lib/chains/registry.ts: that registry has no
 * consumers and its two services have incompatible signatures, so extending it
 * would add indirection for nothing. EVM only — the rail is EVM-only.
 */

import { getContract, formatUnits, parseUnits, maxUint256, parseAbi, decodeEventLog } from 'viem';
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
import { NETWORK_CONFIGS } from '../lib/wallet/constants';

// constants/abis.js stores human-readable signatures; getContract needs them parsed.
const railAbi = parseAbi(LIQUIDITY_RAIL_ABI as unknown as string[]);
const erc20Abi = parseAbi(ERC20_ABI as unknown as string[]);
const registryAbi = parseAbi(HACKATHON_REGISTRY_ABI as unknown as string[]);

const USDC_DECIMALS = 6;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

export const LOAN_MODES = {
  OVERCOLLATERALIZED: 0,
  TRANCHE_BACKED: 1,
  HYBRID: 2,
} as const;

export const LOAN_STATUS = {
  NONE: 0,
  OPEN: 1,
  REPAID: 2,
  DEFAULTED: 3,
} as const;

export const PROPOSAL_STATUS = {
  NONE: 0,
  OPEN: 1,
  ACCEPTED: 2,
  CANCELLED: 3,
} as const;

export const MARKET_OUTCOME = {
  UNRESOLVED: 0,
  PAID: 1,
  UNPAID: 2,
} as const;

/**incentives bitfield flags a builder can commit to. */
export const INCENTIVES = {
  ROUTE_NEXT_PRIZE: 1 << 0,
  REPAY_EARLY: 1 << 1,
  NO_COMPETING_HACKATHON: 1 << 2,
} as const;

export interface RailCredibility {
  winsAnchored: number;
  winsPaid: number;
  winsUnpaid: number;
  loansTaken: number;
  loansRepaid: number;
  loansDefaulted: number;
  /** Share of anchored wins the organizer paid, per 10,000 resolved. */
  payoutRateBps: number;
  /** Share of loans repaid, per 10,000 resolved loans. */
  repaymentRateBps: number;
  /** Mean days from declared win to recorded payout. */
  averageDaysToPay: number;
}

export interface LoanPosition {
  winId: number;
  proposalId: number;
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

export interface LoanProposalView {
  proposalId: number;
  winId: number;
  lender: string;
  principal: string;
  collateral: string;
  trancheSize: string;
  trancheProvider: string;
  trancheCommitted: boolean;
  feeBps: number;
  durationDays: number;
  incentives: number;
  status: number;
}

export interface LoanTerms {
  principal: string;
  /** Collateral the BUILDER must post at accept. */
  collateral?: string;
  trancheSize?: string;
  trancheProvider?: `0x${string}` | null;
  feeBps: number;
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
  winsAnchored: 0,
  winsPaid: 0,
  winsUnpaid: 0,
  loansTaken: 0,
  loansRepaid: 0,
  loansDefaulted: 0,
  payoutRateBps: 0,
  repaymentRateBps: 0,
  averageDaysToPay: 0,
};

export interface DeclaredWin {
  winId: number;
  hackathonId: number;
  declarationIndex: number;
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
  /** True once the registry records paidAt on the bound declaration. */
  paid: boolean;
  /** LoanStatus: 0 none, 1 open, 2 repaid, 3 defaulted. */
  loanStatus: number;
  principal: string | null;
  lender: string | null;
  dueAt: number | null;
  collateral: string | null;
  originationFee: string | null;
  daysToPay: number | null;
  /** Unix seconds the organizer payout was recorded, null while unpaid. */
  paidAt: number | null;
  betPool: string | null;
  /** MarketOutcome: 0 unresolved, 1 PAID, 2 UNPAID. */
  marketOutcome: number;
}

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
  ): Promise<{ maxLoanSize: bigint; maxFeeBps: bigint; maxLoanDuration: bigint; marketResolutionWindow: bigint } | null> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return null;
      const [maxLoanSize, maxFeeBps, maxLoanDuration, marketResolutionWindow] =
        await Promise.all([
          contracts.rail.read.maxLoanSize(),
          contracts.rail.read.maxFeeBps(),
          contracts.rail.read.maxLoanDuration(),
          contracts.rail.read.marketResolutionWindow(),
        ]);
      return { maxLoanSize, maxFeeBps, maxLoanDuration, marketResolutionWindow };
    } catch {
      return null;
    }
  }

  async getWin(
    chainId: number,
    publicClient: PublicClient,
    winId: number
  ): Promise<{ hackathonId: number; declarationIndex: number; builder: string; prizeAmount: string; declaredAt: number; resolutionDeadline: number } | null> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return null;
      const win = await contracts.rail.read.wins([BigInt(winId)]);
      // viem returns multi-output reads as positional arrays.
      const [hackathonId, declarationIndex, builder, prizeAmount, declaredAt, resolutionDeadline] =
        win as any[];
      if (!win || builder === ZERO_ADDR) return null;
      return {
        hackathonId: Number(hackathonId),
        declarationIndex: Number(declarationIndex),
        builder,
        prizeAmount: formatUnits(prizeAmount, USDC_DECIMALS),
        declaredAt: Number(declaredAt),
        resolutionDeadline: Number(resolutionDeadline),
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
        proposalId,
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
        proposalId: Number(proposalId),
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

  async getProposal(
    chainId: number,
    publicClient: PublicClient,
    proposalId: number
  ): Promise<LoanProposalView | null> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return null;
      const p = await contracts.rail.read.proposals([BigInt(proposalId)]);
      const [
        winId,
        lender,
        principal,
        collateral,
        trancheSize,
        trancheProvider,
        trancheCommitted,
        feeBps,
        durationDays,
        incentives,
        status,
      ] = p as any[];
      if (!p || Number(status) === PROPOSAL_STATUS.NONE) return null;
      return {
        proposalId,
        winId: Number(winId),
        lender,
        principal: formatUnits(principal, USDC_DECIMALS),
        collateral: formatUnits(collateral, USDC_DECIMALS),
        trancheSize: formatUnits(trancheSize, USDC_DECIMALS),
        trancheProvider,
        trancheCommitted: Boolean(trancheCommitted),
        feeBps: Number(feeBps),
        durationDays: Number(durationDays),
        incentives: Number(incentives),
        status: Number(status),
      };
    } catch {
      return null;
    }
  }

  /** Open proposals on a win — the offers a builder can accept. */
  async listOpenProposals(
    chainId: number,
    publicClient: PublicClient,
    winId: number
  ): Promise<LoanProposalView[]> {
    const contracts = this.getContracts(chainId, publicClient);
    if (!contracts) return [];
    try {
      const count = Number(await contracts.rail.read.proposalCount());
      const out: LoanProposalView[] = [];
      for (let i = 1; i <= count; i++) {
        const p = await this.getProposal(chainId, publicClient, i);
        if (p && p.winId === winId && p.status === PROPOSAL_STATUS.OPEN) {
          out.push(p);
        }
      }
      return out.sort((a, b) => b.proposalId - a.proposalId);
    } catch {
      return [];
    }
  }

  /** Anchored win ids for a builder, cheapest possible read. */
  async getBuilderWins(
    chainId: number,
    publicClient: PublicClient,
    builder: string
  ): Promise<number[]> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return [];
      const ids = await contracts.rail.read.builderWins([builder as `0x${string}`]);
      return (ids as bigint[]).map(Number);
    } catch {
      return [];
    }
  }

  /** Market state for a win: pools plus resolution outcome. */
  async getMarket(
    chainId: number,
    publicClient: PublicClient,
    winId: number,
    bettor?: string
  ): Promise<{ paidPool: string; unpaidPool: string; outcome: number; resolvedAt: number; myPaidStake: string; myUnpaidStake: string } | null> {
    try {
      const contracts = this.getContracts(chainId, publicClient);
      if (!contracts) return null;
      const m = await contracts.rail.read.markets([BigInt(winId)]);
      const [paidPool, unpaidPool, outcome, resolvedAt] = m as any[];
      let myPaidStake = 0n;
      let myUnpaidStake = 0n;
      if (bettor) {
        [myPaidStake, myUnpaidStake] = (await Promise.all([
          contracts.rail.read.paidStakes([BigInt(winId), bettor as `0x${string}`]),
          contracts.rail.read.unpaidStakes([BigInt(winId), bettor as `0x${string}`]),
        ])) as bigint[];
      }
      return {
        paidPool: formatUnits(paidPool, USDC_DECIMALS),
        unpaidPool: formatUnits(unpaidPool, USDC_DECIMALS),
        outcome: Number(outcome),
        resolvedAt: Number(resolvedAt),
        myPaidStake: formatUnits(myPaidStake, USDC_DECIMALS),
        myUnpaidStake: formatUnits(myUnpaidStake, USDC_DECIMALS),
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
      const [history, payoutRateBps, repaymentRateBps, averageDaysToPay] =
        await Promise.all([
          contracts.rail.read.builderHistory([builder as `0x${string}`]),
          contracts.rail.read.payoutRateBps([builder as `0x${string}`]),
          contracts.rail.read.repaymentRateBps([builder as `0x${string}`]),
          contracts.rail.read.averageDaysToPay([builder as `0x${string}`]),
        ]);
      const [
        winsAnchored,
        winsPaid,
        winsUnpaid,
        loansTaken,
        loansRepaid,
        loansDefaulted,
      ] = history as any[];
      return {
        winsAnchored: Number(winsAnchored),
        winsPaid: Number(winsPaid),
        winsUnpaid: Number(winsUnpaid),
        loansTaken: Number(loansTaken),
        loansRepaid: Number(loansRepaid),
        loansDefaulted: Number(loansDefaulted),
        payoutRateBps: Number(payoutRateBps),
        repaymentRateBps: Number(repaymentRateBps),
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
   * Every rail log since deployment, normalized to { data, topics,
   * transactionHash }. Arc's public RPC caps eth_getLogs ranges hard and
   * rate-limits chunked walks (the chain outruns a 20k-block lookback within
   * days), so the Blockscout-style explorer answers for the whole deployment
   * range in one request; the chunked head-walk stays only as a fallback when
   * the explorer is down.
   */
  private async _collectRailLogs(
    railAddress: string,
    chainId: number,
    publicClient: PublicClient,
    startBlock: number
  ): Promise<{ data: string; topics: string[]; transactionHash: string }[]> {
    const explorer = (NETWORK_CONFIGS as Record<number, { blockExplorerUrls?: string[] }>)?.[
      chainId
    ]?.blockExplorerUrls?.[0];
    if (explorer) {
      // The explorer API rate-limits bursts (HTTP 429); one paced retry
      // covers a blip, and the RPC window below covers a hard outage.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const url =
            `${explorer.replace(/\/+$/, '')}/api?module=logs&action=getLogs` +
            `&address=${railAddress}&fromBlock=${startBlock}&toBlock=latest`;
          const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
          const body: any = res.ok ? await res.json() : null;
          if (Array.isArray(body?.result)) {
            return body.result.map((l: any) => ({
              data: l.data,
              topics: (l.topics ?? l.extraData ?? []) as string[],
              transactionHash: l.transactionHash,
            }));
          }
          if (res.status !== 429) break;
          await new Promise((r) => setTimeout(r, 2_500));
        } catch {
          // Explorer unavailable — fall through to the RPC scan.
          break;
        }
      }
    }
    const logs: { data: string; topics: string[]; transactionHash: string }[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const CHUNK = 2000n;
    const MAX_CHUNKS = 10;
    try {
      const head = await publicClient.getBlockNumber();
      const start = BigInt(startBlock);
      let from = head;
      for (let scanned = 0; scanned < MAX_CHUNKS && from >= start; scanned++) {
        const chunkFrom = from - CHUNK + 1n < start ? start : from - CHUNK + 1n;
        const chunk = await publicClient.getLogs({
          address: railAddress as `0x${string}`,
          fromBlock: chunkFrom,
          toBlock: from,
        });
        for (const log of chunk as any[]) {
          logs.push({ data: log.data, topics: log.topics, transactionHash: log.transactionHash });
        }
        if (chunkFrom === start) break;
        from = chunkFrom - 1n;
        await sleep(150);
      }
    } catch {
      // Partial scan still returns what was found.
    }
    return logs;
  }

  /**
   * winCount is a public counter, so listings read wins(1..winCount) directly.
   * Reads are still batched with pacing because Arc's public RPC rate-limits
   * bursts, and the first batch is retried once to ride out a blip.
   */
  private async _readWins(
    contracts: Contracts
  ): Promise<{ winId: number; win: any[] }[]> {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let count = 0;
    try {
      count = Number(await contracts.rail.read.winCount());
    } catch {
      return [];
    }
    if (count <= 0) return [];
    const found: { winId: number; win: any[] }[] = [];
    const readWin = async (id: bigint): Promise<any[] | null> => {
      try {
        return (await contracts.rail.read.wins([id])) as any[];
      } catch {
        return null;
      }
    };
    for (let i = 1; i <= count; i += 4) {
      const batch = await Promise.all(
        [0, 1, 2, 3]
          .map((off) => i + off)
          .filter((id) => id <= count)
          .map(async (id) => ({ id, win: await readWin(BigInt(id)) }))
      );
      for (const { id, win } of batch) {
        if (win && win[2] !== ZERO_ADDR) found.push({ winId: id, win });
      }
      await sleep(120);
    }
    return found;
  }

  /**
   * Declarations fetched once per hackathon. Each win is bound to a specific
   * declarationIndex, so names and paidAt resolve exactly — no fuzzy
   * matching on builder+prize like the old free-form declareWin needed.
   */
  private async _declarations(
    contracts: Contracts,
    entries: { winId: number; win: any[] }[]
  ): Promise<Map<number, any[]>> {
    const byHack = new Map<number, any[]>();
    const hackathonIds = [...new Set(entries.map((e) => Number(e.win[0])))];
    for (const hid of hackathonIds) {
      try {
        byHack.set(
          hid,
          ((await contracts.registry.read.getWinnerDeclarations([BigInt(hid)])) as any[]) || []
        );
      } catch {
        byHack.set(hid, []);
      }
    }
    return byHack;
  }

  /** Declaration for a win, from the pre-fetched per-hackathon map. */
  private _declFor(win: any[], byHack: Map<number, any[]>): any | null {
    return byHack.get(Number(win[0]))?.[Number(win[1])] ?? null;
  }

  /** Best-effort winId -> anchor-tx map from events; never breaks a listing. */
  private async _txHashByWin(
    contracts: Contracts,
    chainId: number,
    publicClient: PublicClient,
    startBlock: number
  ): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const rawLogs = await this._collectRailLogs(
      contracts.railAddress, chainId, publicClient, startBlock
    );
    for (const log of rawLogs) {
      try {
        const decoded = decodeEventLog({
          abi: railAbi,
          data: log.data as `0x${string}`,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        });
        if (decoded.eventName === 'WinAnchored') {
          const winId = Number((decoded.args as any).winId);
          if (!map.has(winId)) map.set(winId, log.transactionHash);
        }
      } catch {
        // not a rail event we model
      }
    }
    return map;
  }

  /**
   * Anchored wins that are unfunded and unpaid — the lender's order book.
   * See /api/rail/open-wins for the server cache.
   */
  async listOpenWins(
    chainId: number,
    publicClient: PublicClient
  ): Promise<DeclaredWin[]> {
    const contracts = this.getContracts(chainId, publicClient);
    if (!contracts) return [];
    const entries = await this._readWins(contracts);
    const decls = await this._declarations(contracts, entries);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const open: DeclaredWin[] = [];
    for (const { winId, win } of entries) {
      const decl = this._declFor(win, decls);
      // An already-paid prize is not bridgeable.
      if (decl && Number(decl.paidAt ?? decl[4]) > 0) continue;
      let loan: any[];
      try {
        loan = (await contracts.rail.read.loans([BigInt(winId)])) as any[];
      } catch {
        continue;
      }
      if (Number(loan[11]) !== LOAN_STATUS.NONE) continue;
      open.push({
        winId,
        hackathonId: Number(win[0]),
        declarationIndex: Number(win[1]),
        builder: win[2],
        projectName: String(decl?.projectName ?? decl?.[1] ?? ''),
        prizeAmount: formatUnits(win[3], USDC_DECIMALS),
        declaredAt: Number(win[4]),
      });
      await sleep(80);
    }
    return open.sort((a, b) => b.winId - a.winId).slice(0, 50);
  }

  /**
   * Every anchored win and what actually happened to it — the rail's public
   * track record, read for the lender discovery panel. Loan and market state
   * come from views; events only supply the explorer tx links and degrade to
   * null when unavailable.
   */
  async listWinHistory(
    chainId: number,
    publicClient: PublicClient
  ): Promise<WinHistoryRecord[]> {
    const contracts = this.getContracts(chainId, publicClient);
    const startBlock = (LIQUIDITY_RAIL_START_BLOCKS as Record<number, number>)[chainId];
    if (!contracts || startBlock === undefined) return [];
    const entries = await this._readWins(contracts);
    const decls = await this._declarations(contracts, entries);
    const txByWin = startBlock !== undefined
      ? await this._txHashByWin(contracts, chainId, publicClient, startBlock)
      : new Map<number, string>();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const rows: WinHistoryRecord[] = [];
    for (const { winId, win } of entries) {
      try {
        const [loan, market] = (await Promise.all([
          contracts.rail.read.loans([BigInt(winId)]),
          contracts.rail.read.markets([BigInt(winId)]),
        ])) as [any[], any[]];
        const decl = this._declFor(win, decls);
        const paidAt = Number(decl?.paidAt ?? decl?.[4] ?? 0);
        const loanStatus = Number(loan[11]);
        const marketOutcome = Number(market[2]);
        const pool = BigInt(market[0]) + BigInt(market[1]);
        rows.push({
          winId,
          projectName: String(decl?.projectName ?? decl?.[1] ?? ''),
          builder: win[2],
          prizeAmount: formatUnits(win[3], USDC_DECIMALS),
          declaredAt: Number(win[4]),
          txHash: txByWin.get(winId) ?? '',
          paid: paidAt > 0,
          loanStatus,
          principal:
            loanStatus !== LOAN_STATUS.NONE
              ? formatUnits(loan[5], USDC_DECIMALS)
              : null,
          lender: loanStatus !== LOAN_STATUS.NONE ? loan[2] : null,
          dueAt: loanStatus !== LOAN_STATUS.NONE ? Number(loan[9]) : null,
          collateral:
            loanStatus !== LOAN_STATUS.NONE
              ? formatUnits(loan[6], USDC_DECIMALS)
              : null,
          originationFee:
            loanStatus !== LOAN_STATUS.NONE
              ? formatUnits(loan[8], USDC_DECIMALS)
              : null,
          daysToPay:
            paidAt > 0
              ? Math.max(0, Math.round((paidAt - Number(win[4])) / 86400))
              : null,
          paidAt: paidAt > 0 ? paidAt : null,
          betPool: pool > 0n ? formatUnits(pool, USDC_DECIMALS) : null,
          marketOutcome,
        });
        await sleep(100);
      } catch {
        continue;
      }
    }
    return rows.sort((a, b) => b.winId - a.winId).slice(0, 30);
  }

  // ── Writes ──────────────────────────────────────────────────────────────
  // These throw rather than resolving empty. Silently no-op'ing a loan
  // request would leave a builder thinking they had drawn when they hadn't.

  /**
   * Anchors a registry declaration on the rail. The builder address and prize
   * come from the host's declaration — this call just indexes attested truth.
   */
  async anchorWin(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    args: { hackathonId: number; declarationIndex: number }
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.anchorWin([
      BigInt(args.hackathonId),
      BigInt(args.declarationIndex),
    ] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  /**
   * Lender offers funded terms against an anchored win. Nothing moves yet —
   * the builder pulls collateral and receives principal at acceptLoan.
   * `collateral` is required FROM THE BUILDER; `trancheSize` requires a
   * named third-party provider who must commitTranche before accept.
   */
  async proposeLoan(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    winId: number,
    terms: LoanTerms
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');

    const principal = parseUnits(terms.principal, USDC_DECIMALS);
    const collateral = terms.collateral
      ? parseUnits(terms.collateral, USDC_DECIMALS)
      : 0n;
    const trancheSize = terms.trancheSize
      ? parseUnits(terms.trancheSize, USDC_DECIMALS)
      : 0n;
    const trancheProvider =
      (terms.trancheProvider as `0x${string}`) || ZERO_ADDR;

    const hash = await contracts.rail.write.proposeLoan([
      BigInt(winId),
      principal,
      collateral,
      trancheSize,
      trancheProvider,
      BigInt(terms.feeBps),
      BigInt(terms.durationDays),
      BigInt(terms.incentives ?? 0),
    ] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  /** First-loss provider escrows their tranche for a proposal. */
  async commitTranche(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    proposalId: number,
    amount: string
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    await this._ensureAllowance(
      publicClient,
      contracts,
      walletClient.account!.address,
      parseUnits(amount, USDC_DECIMALS)
    );
    const hash = await contracts.rail.write.commitTranche([BigInt(proposalId)] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async withdrawTranche(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    proposalId: number
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.withdrawTranche([BigInt(proposalId)] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async cancelProposal(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    proposalId: number
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.cancelProposal([BigInt(proposalId)] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  /**
   * Builder accepts a proposal: posts their own collateral (approval handled
   * here) and receives principal net of the fee in the same transaction.
   */
  async acceptLoan(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    proposalId: number,
    collateralRequired: string
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const collateral = collateralRequired
      ? parseUnits(collateralRequired, USDC_DECIMALS)
      : 0n;
    await this._ensureAllowance(
      publicClient,
      contracts,
      walletClient.account!.address,
      collateral
    );
    const hash = await contracts.rail.write.acceptLoan([BigInt(proposalId)] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  /**
   * Repays an open loan at par. Caller needs USDC covering principal and an
   * approval — usually the builder once the prize lands.
   */
  async repayLoan(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    winId: number,
    principal: string
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    await this._ensureAllowance(
      publicClient,
      contracts,
      walletClient.account!.address,
      parseUnits(principal, USDC_DECIMALS)
    );
    const hash = await contracts.rail.write.repayLoan([BigInt(winId)] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async defaultLoan(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    winId: number
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.defaultLoan([BigInt(winId)] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  /**
   * Bets go against a declared win's payout market. `expectsPayment: true`
   * backs the organizer paying; false backs them not paying. Stake comes out
   * of the connected wallet only — bettor capital is structurally fenced off
   * from lending.
   */
  async placeBet(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    winId: number,
    amount: string,
    expectsPayment: boolean
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');

    const account = walletClient.account!.address;
    const stake = parseUnits(amount, USDC_DECIMALS);
    if (stake <= 0n) throw new Error('Bet amount must be greater than zero.');
    await this._ensureAllowance(publicClient, contracts, account, stake);

    const hash = await contracts.rail.write.placeBet([
      BigInt(winId),
      stake,
      expectsPayment,
    ] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  /**
   * Permissionless market resolution — callable by anyone once the registry
   * records the payout (PAID) or the resolution window elapses (UNPAID).
   */
  async resolveMarket(
    chainId: number,
    publicClient: PublicClient,
    walletClient?: WalletClient,
    winId?: number
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.resolveMarket([BigInt(winId!)] as any);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async claimWinnings(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    winId: number
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.claimWinnings([BigInt(winId)] as any);
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
