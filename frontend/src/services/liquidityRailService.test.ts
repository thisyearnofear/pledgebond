/**
 * liquidityRailService — listOpenWins + listWinHistory.
 *
 * Pins the positional-array contract: viem returns multi-output reads as
 * arrays, and a regression here silently empties the lender order book.
 * History logs are encoded through the real ABI so the decode path and the
 * ABI additions (betOutcome, BetPlaced) are both pinned.
 */

import { describe, it, expect, vi } from "vitest";
import { encodeEventTopics, encodeAbiParameters, parseAbi } from "viem";
import { LIQUIDITY_RAIL_ABI } from "../constants/abis";

const winsStore = {
  // [hackathonId, builder, prizeAmount, declaredAt, settledAt, status]
  1: [1n, "0xBuilderOne", 5_000_000n, 1700000000n, 0n, 1],
  2: [1n, "0xBuilderTwo", 8_000_000n, 1700000001n, 0n, 1],
  3: [1n, "0xBuilderThree", 2_000_000n, 1700000002n, 1700259202n, 2],
};

const loansStore = {
  // winId -> [winId, lender, builder, trancheProvider, principal, collateral,
  //           trancheSize, originationFee, dueAt, mode, status, incentives]
  1: [1n, "0xLender", "0xBuilderOne", "0x0", 0n, 0n, 0n, 0n, 0n, 0, 0, 0n],
  2: [2n, "0xLender", "0xBuilderTwo", "0x0", 100n, 110n, 0n, 5n, 0n, 0, 1, 0n],
  3: [3n, "0xLender", "0xBuilderThree", "0x0", 100n, 110n, 0n, 5n, 0n, 0, 2, 0n],
};

const betOutcomeStore = { 1: 0n, 2: 0n, 3: 1n };

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    getContract: vi.fn(({ address }) => ({
      address,
      read: {
        wins: async ([id]: bigint[]) => winsStore[Number(id)],
        loans: async ([id]: bigint[]) => loansStore[Number(id)],
        betOutcome: async ([id]: bigint[]) => betOutcomeStore[Number(id)] ?? 0n,
        getWinnerDeclarations: async () => [],
      },
    })),
  };
});

import liquidityRailService from "./liquidityRailService";

const ARC_TESTNET = 5042002;

const fakePublicClient = {
  getBlockNumber: vi.fn(async () => 65669500n),
  getLogs: vi.fn(async () => [
    { args: { winId: 1n, hackathonId: 1n, builder: "0xBuilderOne", projectName: "Alpha", prizeAmount: 5_000_000n, declaredAt: 1700000000n } },
    { args: { winId: 2n, hackathonId: 1n, builder: "0xBuilderTwo", projectName: "Beta", prizeAmount: 8_000_000n, declaredAt: 1700000001n } },
    { args: { winId: 3n, hackathonId: 1n, builder: "0xBuilderThree", projectName: "Gamma", prizeAmount: 2_000_000n, declaredAt: 1700000002n } },
  ]),
};

describe("listOpenWins", () => {
  it("returns only DECLARED wins with no loan", async () => {
    const wins = await liquidityRailService.listOpenWins(ARC_TESTNET, fakePublicClient as any);
    expect(wins.map((w) => w.winId)).toEqual([1]);
    expect(wins[0].projectName).toBe("Alpha");
    expect(wins[0].prizeAmount).toBe("5");
  });

  it("scans the deployment range in RPC-safe chunks", async () => {
    fakePublicClient.getLogs.mockClear();
    await liquidityRailService.listOpenWins(ARC_TESTNET, fakePublicClient as any);
    const calls = fakePublicClient.getLogs.mock.calls as any[];
    expect(calls.length).toBeGreaterThan(1);
    for (const [params] of calls) {
      expect(Number(params.toBlock - params.fromBlock)).toBeLessThanOrEqual(2000);
    }
  });

  it("degrades to empty when getLogs fails", async () => {
    const broken = { getLogs: async () => { throw new Error("rpc down"); } };
    await expect(liquidityRailService.listOpenWins(ARC_TESTNET, broken as any)).resolves.toEqual([]);
  });
});

describe("listWinHistory", () => {
  const railAbi = parseAbi(LIQUIDITY_RAIL_ABI as unknown as string[]);
  const BUILDER_1 = "0x1111111111111111111111111111111111111111";
  const BUILDER_2 = "0x2222222222222222222222222222222222222222";
  const BUILDER_3 = "0x3333333333333333333333333333333333333333";
  const BETTOR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const BETTOR_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const evLog = (eventName: string, args: any) => {
    const item = railAbi.find((i: any) => i.type === "event" && i.name === eventName) as any;
    const topics = encodeEventTopics({ abi: railAbi as any, eventName, args } as any);
    const nonIndexed = item.inputs.filter((i: any) => !i.indexed);
    const data = encodeAbiParameters(nonIndexed, nonIndexed.map((i: any) => args[i.name]));
    return { data, topics, transactionHash: "0xdeadbeef" };
  };
  const historyLogs = [
    evLog("WinDeclared", { winId: 1n, hackathonId: 1n, builder: BUILDER_1, projectName: "Alpha", prizeAmount: 5_000_000n, declaredAt: 1700000000n }),
    evLog("WinDeclared", { winId: 2n, hackathonId: 1n, builder: BUILDER_2, projectName: "Beta", prizeAmount: 8_000_000n, declaredAt: 1700000001n }),
    evLog("WinDeclared", { winId: 3n, hackathonId: 1n, builder: BUILDER_3, projectName: "Gamma", prizeAmount: 2_000_000n, declaredAt: 1700000002n }),
    evLog("BetPlaced", { winId: 3n, bettor: BETTOR_A, amount: 50_000n, expectsPayment: true }),
    evLog("BetPlaced", { winId: 3n, bettor: BETTOR_B, amount: 50_000n, expectsPayment: false }),
  ];

  const historyClient = () => {
    let served = false;
    return {
      getBlockNumber: async () => 65669500n,
      getLogs: async () => {
        if (served) return [];
        served = true;
        return historyLogs;
      },
    };
  };

  it("returns every declared win with its real outcome, newest first", async () => {
    const rows = await liquidityRailService.listWinHistory(ARC_TESTNET, historyClient() as any);
    expect(rows.map((r) => r.winId)).toEqual([3, 2, 1]);

    const settled = rows[0];
    expect(settled.winStatus).toBe(2);
    expect(settled.loanStatus).toBe(2);
    expect(settled.daysToPay).toBe(3);
    expect(settled.betsCount).toBe(2);
    expect(settled.betPool).toBe("0.1");
    expect(settled.betOutcome).toBe(1);
    expect(settled.txHash).toBe("0xdeadbeef");

    const active = rows[1];
    expect(active.winStatus).toBe(1);
    expect(active.loanStatus).toBe(1);
    expect(active.principal).toBe("0.0001");
    expect(active.betsCount).toBe(0);
    expect(active.betPool).toBeNull();

    const awaiting = rows[2];
    expect(awaiting.loanStatus).toBe(0);
    expect(awaiting.principal).toBeNull();
    expect(awaiting.daysToPay).toBeNull();
  });

  it("degrades to empty when the scan fails outright", async () => {
    const broken = { getBlockNumber: async () => { throw new Error("rpc down"); }, getLogs: async () => [] };
    await expect(liquidityRailService.listWinHistory(ARC_TESTNET, broken as any)).resolves.toEqual([]);
  });
});
