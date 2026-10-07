/**
 * liquidityRailService — listOpenWins + listWinHistory + placeBet.
 *
 * Listings are view-read-driven (win ids are a dense counter probed until an
 * empty struct), pinned here against the positional-array contract: viem
 * returns multi-output reads as arrays, and a regression silently empties the
 * lender order book. Events only enrich rows with explorer tx links — the
 * tests assert listings survive a dead event source entirely.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { encodeEventTopics, encodeAbiParameters, parseAbi } from "viem";
import { LIQUIDITY_RAIL_ABI } from "../constants/abis";

const ARC_TESTNET = 5042002;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const BUILDER_1 = "0x1111111111111111111111111111111111111111";
const BUILDER_2 = "0x2222222222222222222222222222222222222222";
const BUILDER_3 = "0x3333333333333333333333333333333333333333";
const BETTOR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BETTOR_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const winsStore = {
  // [hackathonId, builder, prizeAmount, declaredAt, settledAt, status]
  1: [1n, "0xBuilderOne", 5_000_000n, 1700000000n, 0n, 1],
  2: [1n, "0xBuilderTwo", 8_000_000n, 1700000001n, 0n, 1],
  3: [1n, "0xBuilderThree", 2_000_000n, 1700000002n, 1700259202n, 2],
};
const winZero = [0n, ZERO_ADDR, 0n, 0n, 0n, 0n];

const loansStore = {
  // winId -> [winId, lender, builder, trancheProvider, principal, collateral,
  //           trancheSize, originationFee, dueAt, mode, status, incentives]
  1: [1n, "0xLender", "0xBuilderOne", "0x0", 0n, 0n, 0n, 0n, 0n, 0, 0, 0n],
  2: [2n, "0xLender", "0xBuilderTwo", "0x0", 100n, 110n, 0n, 5n, 0n, 0, 1, 0n],
  3: [3n, "0xLender", "0xBuilderThree", "0x0", 100n, 110n, 0n, 5n, 0n, 0, 2, 0n],
};
const loanZero = [0n, ZERO_ADDR, ZERO_ADDR, ZERO_ADDR, 0n, 0n, 0n, 0n, 0n, 0, 0, 0n];

const betOutcomeStore = { 1: 0n, 2: 0n, 3: 1n };

// bets(winId, i) -> [bettor, amount, expectsPayment, claimed]; out-of-range
// indexes revert, which is how the service counts a market.
const betMembers = {
  3: [
    [BETTOR_A, 50_000n, true, false],
    [BETTOR_B, 50_000n, false, false],
  ],
};

// registry.getWinnerDeclarations: [winner, projectName, prize, declaredAt, paidAt, txHashString]
const declarations = [
  ["0xBuilderOne", "Alpha", 5_000_000n, 1700000000n, 0n, ""],
  ["0xBuilderTwo", "Beta", 8_000_000n, 1700000001n, 0n, ""],
  ["0xBuilderThree", "Gamma", 2_000_000n, 1700000002n, 1700259202n, ""],
];

const betWrites: any[] = [];
const approveWrites: any[] = [];
let allowanceValue = 0n;

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    getContract: vi.fn(({ address }) => {
      const isUsdc = address === (USDC_ADDRESSES as Record<number, string>)[ARC_TESTNET];
      return {
        address,
        read: {
          wins: async ([id]: bigint[]) => winsStore[Number(id)] ?? winZero,
          loans: async ([id]: bigint[]) => loansStore[Number(id)] ?? loanZero,
          betOutcome: async ([id]: bigint[]) => betOutcomeStore[Number(id)] ?? 0n,
          bets: async ([id, idx]: bigint[]) => {
            const bet = betMembers[Number(id)]?.[Number(idx)];
            if (!bet) throw new Error("execution reverted: index out of range");
            return bet;
          },
          getWinnerDeclarations: async () => declarations,
          allowance: async () => allowanceValue,
        },
        write: isUsdc
          ? {
              approve: async (args: any[]) => {
                approveWrites.push(args);
                return "0xapprovetx";
              },
            }
          : {
              placeBet: async (args: any[]) => {
                betWrites.push(args);
                return "0xbettx";
              },
            },
      };
    }),
  };
});

import liquidityRailService from "./liquidityRailService";
import { USDC_ADDRESSES, LIQUIDITY_RAIL_ADDRESSES } from "../config/tokens";

// Log enrichment is explorer-first; keep tests off the real arc.io API so the
// RPC-fallback expectations below stay meaningful.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("explorer disabled in tests"); }));
});

const railAbi = parseAbi(LIQUIDITY_RAIL_ABI as unknown as string[]);
const evLog = (eventName: string, args: any) => {
  const item = railAbi.find((i: any) => i.type === "event" && i.name === eventName) as any;
  const topics = encodeEventTopics({ abi: railAbi as any, eventName, args } as any);
  const nonIndexed = item.inputs.filter((i: any) => !i.indexed);
  const data = encodeAbiParameters(nonIndexed, nonIndexed.map((i: any) => args[i.name]));
  return { data, topics, transactionHash: "0xdeadbeef" };
};
const winLog = (winId: bigint, builder: string, projectName: string, prizeAmount: bigint, declaredAt: bigint) =>
  evLog("WinDeclared", { winId, hackathonId: 1n, builder, projectName, prizeAmount, declaredAt });

const declaredLogs = [
  winLog(1n, BUILDER_1, "Alpha", 5_000_000n, 1700000000n),
  winLog(2n, BUILDER_2, "Beta", 8_000_000n, 1700000001n),
  winLog(3n, BUILDER_3, "Gamma", 2_000_000n, 1700000002n),
];

describe("listOpenWins", () => {
  it("returns only DECLARED wins with no loan, named from the registry", async () => {
    const wins = await liquidityRailService.listOpenWins(ARC_TESTNET, {} as any);
    expect(wins.map((w) => w.winId)).toEqual([1]);
    expect(wins[0].projectName).toBe("Alpha");
    expect(wins[0].prizeAmount).toBe("5");
  });

  it("never consults event logs — the RPC log cap cannot empty the book", async () => {
    const getLogs = vi.fn(async () => []);
    await liquidityRailService.listOpenWins(
      ARC_TESTNET, { getBlockNumber: async () => 1n, getLogs } as any
    );
    expect(getLogs).not.toHaveBeenCalled();
  });

  it("survives an outright RPC failure on every path", async () => {
    const broken = { getBlockNumber: async () => { throw new Error("rpc down"); }, getLogs: async () => { throw new Error("rpc down"); } };
    // Contract reads are mocked at getContract level, so the dense probe
    // still terminates on the zero struct and the listing holds.
    const wins = await liquidityRailService.listOpenWins(ARC_TESTNET, broken as any);
    expect(wins.map((w) => w.winId)).toEqual([1]);
  });
});

describe("listWinHistory", () => {
  it("returns every declared win with its real outcome, newest first", async () => {
    const rows = await liquidityRailService.listWinHistory(ARC_TESTNET, {} as any);
    expect(rows.map((r) => r.winId)).toEqual([3, 2, 1]);

    const settled = rows[0];
    expect(settled.winStatus).toBe(2);
    expect(settled.loanStatus).toBe(2);
    expect(settled.projectName).toBe("Gamma");
    expect(settled.daysToPay).toBe(3);
    expect(settled.betsCount).toBe(2);
    expect(settled.betPool).toBe("0.1");
    expect(settled.betOutcome).toBe(1);
    expect(settled.settledAt).toBe(1700259202);
    expect(settled.collateral).toBe("0.00011");
    expect(settled.originationFee).toBe("0.000005");

    const active = rows[1];
    expect(active.winStatus).toBe(1);
    expect(active.loanStatus).toBe(1);
    expect(active.principal).toBe("0.0001");
    expect(active.collateral).toBe("0.00011");
    expect(active.settledAt).toBeNull();
    expect(active.betsCount).toBe(0);
    expect(active.betPool).toBeNull();

    const awaiting = rows[2];
    expect(awaiting.loanStatus).toBe(0);
    expect(awaiting.principal).toBeNull();
    expect(awaiting.collateral).toBeNull();
    expect(awaiting.daysToPay).toBeNull();
  });

  it("enriches rows with explorer tx links without ever touching the RPC", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ result: declaredLogs }) })));
    const getLogs = vi.fn();
    const rows = await liquidityRailService.listWinHistory(
      ARC_TESTNET, { getBlockNumber: async () => 1n, getLogs } as any
    );
    expect(getLogs).not.toHaveBeenCalled();
    expect(rows.map((r) => r.winId)).toEqual([3, 2, 1]);
    expect(rows[0].txHash).toBe("0xdeadbeef");
  });

  it("still lists the full history when the event source is dead", async () => {
    const broken = { getBlockNumber: async () => { throw new Error("rpc down"); }, getLogs: async () => { throw new Error("rate limited"); } };
    const rows = await liquidityRailService.listWinHistory(ARC_TESTNET, broken as any);
    expect(rows.map((r) => r.winId)).toEqual([3, 2, 1]);
    expect(rows[0].txHash).toBe("");
    expect(rows[0].betPool).toBe("0.1");
  });
});

describe("placeBet", () => {
  const walletClient = {
    account: { address: "0x9999999999999999999999999999999999999999" },
  };
  const receiptClient = {
    waitForTransactionReceipt: async ({ hash }: { hash: string }) => ({ hash, status: "success" }),
  };

  it("approves USDC then sends the 6-decimal stake positionally", async () => {
    allowanceValue = 0n;
    betWrites.length = 0;
    approveWrites.length = 0;
    await liquidityRailService.placeBet(
      ARC_TESTNET, receiptClient as any, walletClient as any, 3, "0.05", true
    );
    expect(approveWrites).toHaveLength(1);
    expect(approveWrites[0][0]).toBe(LIQUIDITY_RAIL_ADDRESSES[ARC_TESTNET]);
    expect(betWrites).toHaveLength(1);
    expect(betWrites[0]).toEqual([3n, 50_000n, true]);
  });

  it("skips the approval when the allowance already covers the stake", async () => {
    allowanceValue = 1_000_000n;
    betWrites.length = 0;
    approveWrites.length = 0;
    await liquidityRailService.placeBet(
      ARC_TESTNET, receiptClient as any, walletClient as any, 7, "1", false
    );
    expect(approveWrites).toHaveLength(0);
    expect(betWrites[0]).toEqual([7n, 1_000_000n, false]);
  });

  it("refuses a zero stake before touching the chain", async () => {
    betWrites.length = 0;
    await expect(
      liquidityRailService.placeBet(ARC_TESTNET, receiptClient as any, walletClient as any, 3, "0", true)
    ).rejects.toThrow(/greater than zero/);
    expect(betWrites).toHaveLength(0);
  });
});
