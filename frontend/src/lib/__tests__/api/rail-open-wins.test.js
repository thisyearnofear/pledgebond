/**
 * /api/rail/open-wins — cached server-side read of the lender order book.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const listOpenWins = vi.fn();

vi.mock("@/services/liquidityRailService", () => ({
  liquidityRailService: {
    listOpenWins: (...args) => listOpenWins(...args),
  },
}));

function fakeReq(query = {}) {
  return { method: "GET", query };
}

function fakeRes() {
  const res = {
    statusCode: 0,
    body: null,
    headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
  return res;
}

async function loadHandler() {
  vi.resetModules();
  const mod = await import("../../../pages/api/rail/open-wins");
  return mod.default;
}

describe("GET /api/rail/open-wins", () => {
  beforeEach(() => {
    listOpenWins.mockReset();
    delete globalThis.__pledgebondOpenWins;
  });

  it("returns wins from the rail service", async () => {
    listOpenWins.mockResolvedValue([{ winId: 4, projectName: "Probe B" }]);
    const handler = await loadHandler();
    const res = fakeRes();
    await handler(fakeReq({ chainId: "5042002" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.wins).toHaveLength(1);
    expect(res.body.wins[0].winId).toBe(4);
  });

  it("rejects non-GET", async () => {
    const handler = await loadHandler();
    const res = fakeRes();
    await handler({ method: "POST", query: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("400s for a chain with no RPC", async () => {
    const handler = await loadHandler();
    const res = fakeRes();
    await handler(fakeReq({ chainId: "999999" }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.wins).toEqual([]);
  });

  it("502s with an empty list when the rail read throws", async () => {
    listOpenWins.mockRejectedValue(new Error("rate limited"));
    const handler = await loadHandler();
    const res = fakeRes();
    await handler(fakeReq({ chainId: "5042002" }), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.wins).toEqual([]);
    expect(res.body.error).toContain("rate limited");
  });
});
