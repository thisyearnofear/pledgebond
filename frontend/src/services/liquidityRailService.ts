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
   * Win ids are a dense counter from 1 (Solidity Counters), and unset wins
   * read back as the zero struct — so listings probe wins(1), wins(2), …
   * until the first empty id. This is the only enumeration source that is
   * immune to the Arc RPC's eth_getLogs range cap and the explorer's
   * multi-hundred-thousand-block indexing lag; events stay as optional
   * enrichment (tx links) below.
   */
  private async _probeWins(
    contracts: Contracts
  ): Promise<{ winId: number; win: any[] }[]> {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const ZERO_BUILDER = '0x0000000000000000000000000000000000000000';
    const MAX_WINS = 200;
    const found: { winId: number; win: any[] }[] = [];
    const readWin = async (id: bigint): Promise<any[] | null> => {
      try {
        return (await contracts.rail.read.wins([id])) as any[];
      } catch {
        return null;
      }
    };
    // A total failure on the very first batch is the public RPC's rate
    // limiter, not an empty rail — one paced retry clears most blips.
    let first = await Promise.all([1n, 2n, 3n, 4n].map(readWin));
    if (first.every((w) => w === null)) {
      await sleep(700);
      first = await Promise.all([1n, 2n, 3n, 4n].map(readWin));
    }
    outer: for (let i = 1n; i <= BigInt(MAX_WINS); i += 4n) {
      const batch =
        i === 1n
          ? first.map((win, off) => ({ id: 1n + BigInt(off), win }))
          : await Promise.all(
              [0n, 1n, 2n, 3n].map(async (off) => {
                const id = i + off;
                return { id, win: await readWin(id) };
              })
            );
      for (const { id, win } of batch) {
        if (!win) break outer;
        if (
          Number(win[5]) === 0 &&
          String(win[1]).toLowerCase() === ZERO_BUILDER
        ) {
          break outer;
        }
        found.push({ winId: Number(id), win });
      }
      await sleep(120);
    }
    return found;
  }

  /**
   * Project names live in the WinDeclared event and in the registry — the
   * win struct itself has none. The registry's declaration list is a view,
   * so names resolve without touching logs: match (hackathonId, builder).
   */
  private async _projectNames(
    contracts: Contracts,
    entries: { winId: number; win: any[] }[]
  ): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    const byHack = new Map<number, any[]>();
    const hackathonIds = [...new Set(entries.map((e) => Number(e.win[0])))];
    for (const hid of hackathonIds) {
      try {
        byHack.set(hid, ((await contracts.registry.read.getWinnerDeclarations([BigInt(hid)])) as any[]) || []);
      } catch {
        byHack.set(hid, []);
      }
    }
    for (const { winId, win } of entries) {
      const decls = byHack.get(Number(win[0])) || [];
      const builder = String(win[1]).toLowerCase();
      const prize = BigInt(win[2]);
      const declaredAt = Number(win[3]);
      let best: { name: string; drift: number } | null = null;
      for (const d of decls) {
        const winner = String((d as any).winner ?? (d as any)[0]).toLowerCase();
        if (winner !== builder) continue;
        const dPrize = BigInt((d as any).prizeAmount ?? (d as any)[2]);
        const drift = Math.abs(Number((d as any).declaredAt ?? (d as any)[3]) - declaredAt);
        if (dPrize === prize && drift <= 120 && (!best || drift < best.drift)) {
          best = { name: String((d as any).projectName ?? (d as any)[1]), drift };
        }
      }
      names.set(winId, best ? best.name : '');
    }
    return names;
  }

  /** Best-effort winId -> declare-tx map from events; never breaks a listing. */
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
        if (decoded.eventName === 'WinDeclared') {
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
   * Declared wins on-chain that no one has funded yet — the lender's order
   * book, from view reads only (see _probeWins). See /api/rail/open-wins
   * for the server cache.
   */
  async listOpenWins(
    chainId: number,
    publicClient: PublicClient
  ): Promise<DeclaredWin[]> {
    const contracts = this.getContracts(chainId, publicClient);
    if (!contracts) return [];
    const entries = await this._probeWins(contracts);
    const names = await this._projectNames(contracts, entries);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const open: DeclaredWin[] = [];
    for (const { winId, win } of entries) {
      if (Number(win[5]) !== WIN_STATUS.DECLARED) continue;
      let loan: any[];
      try {
        loan = (await contracts.rail.read.loans([BigInt(winId)])) as any[];
      } catch {
        continue;
      }
      if (Number(loan[10]) !== LOAN_STATUS.NONE) continue;
      open.push({
        winId,
        hackathonId: Number(win[0]),
        builder: win[1],
        projectName: names.get(winId) || '',
        prizeAmount: formatUnits(win[2], USDC_DECIMALS),
        declaredAt: Number(win[3]),
      });
      await sleep(80);
    }
    return open.sort((a, b) => b.winId - a.winId).slice(0, 50);
  }

  /**
   * Every declared win and what actually happened to it — the rail's public
   * track record, read for the lender discover panel. Enumeration and bet
   * totals come from views (wins/loans/betOutcome/bets); events only supply
   * the explorer tx links and degrade to null when unavailable.
   */
  async listWinHistory(
    chainId: number,
    publicClient: PublicClient
  ): Promise<WinHistoryRecord[]> {
    const contracts = this.getContracts(chainId, publicClient);
    const startBlock = (LIQUIDITY_RAIL_START_BLOCKS as Record<number, number>)[chainId];
    if (!contracts || startBlock === undefined) return [];
    const entries = await this._probeWins(contracts);
    const names = await this._projectNames(contracts, entries);
    const txByWin = startBlock !== undefined
      ? await this._txHashByWin(contracts, chainId, publicClient, startBlock)
      : new Map<number, string>();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const rows: WinHistoryRecord[] = [];
    for (const { winId, win } of entries) {
      try {
        const [loan, outcome] = (await Promise.all([
          contracts.rail.read.loans([BigInt(winId)]),
          contracts.rail.read.betOutcome([BigInt(winId)]),
        ])) as [any[], any];
        // Public mapping-to-struct-array getters have no length form
        // (Solidity limitation), so bets are probed index-wise until the
        // out-of-range revert.
        let betsCount = 0;
        let pool = 0n;
        for (;;) {
          try {
            const bet = (await contracts.rail.read.bets([BigInt(winId), BigInt(betsCount)])) as any[];
            pool += bet[1];
            betsCount++;
          } catch {
            break;
          }
          if (betsCount >= 50) break;
        }
        const winStatus = Number(win[5]);
        const loanStatus = Number((loan as any[])[10]);
        rows.push({
          winId,
          projectName: names.get(winId) || '',
          builder: win[1],
          prizeAmount: formatUnits(win[2], USDC_DECIMALS),
          declaredAt: Number(win[3]),
          txHash: txByWin.get(winId) ?? '',
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
              ? Math.max(0, Math.round((Number(win[4]) - Number(win[3])) / 86400))
              : null,
          betsCount,
          betPool: betsCount > 0 ? formatUnits(pool, USDC_DECIMALS) : null,
          betOutcome: Number(outcome),
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

  async claimBet(
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient,
    winId: number
  ) {
    const contracts = this.getContracts(chainId, publicClient, walletClient);
    if (!contracts) throw new Error('Rail contracts not found');
    const hash = await contracts.rail.write.claimBet([BigInt(winId)] as any);
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