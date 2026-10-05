/**
 * liquidityRailService — listOpenWins.
 *
 * Pins the positional-array contract: viem returns multi-output reads as
 * arrays, and a regression here silently empties the lender order book.
 */

import { describe, it, expect, vi } from "vitest";

const winsStore = {
  // [hackathonId, builder, prizeAmount, declaredAt, settledAt, status]
  1: [1n, "0xBuilderOne", 5_000_000n, 1700000000n, 0n, 1],
  2: [1n, "0xBuilderTwo", 8_000_000n, 1700000001n, 0n, 1],
  3: [1n, "0xBuilderThree", 2_000_000n, 1700000002n, 0n, 2],
};

const loansStore = {
  // winId -> [winId, lender, builder, trancheProvider, principal, collateral,
  //           trancheSize, originationFee, dueAt, mode, status, incentives]
  1: [1n, "0xLender", "0xBuilderOne", "0x0", 0n, 0n, 0n, 0n, 0n, 0, 0, 0n],
  2: [2n, "0xLender", "0xBuilderTwo", "0x0", 100n, 110n, 0n, 5n, 0n, 0, 1, 0n],
  3: [3n, "0xLender", "0xBuilderThree", "0x0", 100n, 110n, 0n, 5n, 0n, 0, 2, 0n],
};

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    getContract: vi.fn(({ address }) => ({
      address,
      read: {
        wins: async ([id]: bigint[]) => winsStore[Number(id)],
        loans: async ([id]: bigint[]) => loansStore[Number(id)],
        getWinnerDeclarations: async () => [],
      },
    })),
  };
});

import liquidityRailService from "./liquidityRailService";

const ARC_TESTNET = 5042002;

const fakePublicClient = {
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

  it("degrades to empty when getLogs fails", async () => {
    const broken = { getLogs: async () => { throw new Error("rpc down"); } };
    await expect(liquidityRailService.listOpenWins(ARC_TESTNET, broken as any)).resolves.toEqual([]);
  });
});
