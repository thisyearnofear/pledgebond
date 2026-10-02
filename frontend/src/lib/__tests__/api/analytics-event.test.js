/**
 * API tests for /api/analytics/event — funnel event persistence contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable Firestore mock (see agent-routes.test.js fakeQuery pattern).
// A single shared funnelEvents collection mock so tests can inspect the
// exact `add` calls the handler made.
/** @type {any} */
let funnelEventsColl = null;
const makeColl = () => {
  /** @type {any} */
  const q = {};
  q.orderBy = vi.fn(() => q);
  q.where = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.get = vi.fn(() => Promise.resolve({ docs: [], size: 0, empty: true }));
  q.add = vi.fn(() => Promise.resolve({ id: "test-doc-id" }));
  q.doc = vi.fn(() => ({
    get: vi.fn(() => Promise.resolve({ exists: false, id: "x", data: () => ({}) })),
    set: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve()),
  }));
  return q;
};

vi.mock("@/lib/firebase/serverOnly", () => ({
  db: {
    collection: vi.fn((name) => {
      if (name === "funnelEvents") {
        if (!funnelEventsColl) funnelEventsColl = makeColl();
        return funnelEventsColl;
      }
      return makeColl();
    }),
  },
}));

function makeRes() {
  const res = { status: vi.fn(() => res), json: vi.fn() };
  return res;
}

async function loadHandler() {
  const mod = await import("../../../pages/api/analytics/event.js");
  return mod.default;
}

describe("POST /api/analytics/event", () => {
  beforeEach(() => {
    funnelEventsColl = null;
    vi.clearAllMocks();
  });

  it("returns 405 for GET", async () => {
    const handler = await loadHandler();
    const res = makeRes();
    await handler({ method: "GET", body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns 400 when event name is missing", async () => {
    const handler = await loadHandler();
    const res = makeRes();
    await handler({ method: "POST", body: { properties: {} } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("accepts non-funnel events without persisting", async () => {
    const handler = await loadHandler();
    const res = makeRes();
    await handler(
      { method: "POST", body: { event: "badge_viewed", properties: { page: "x" }, timestamp: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 400 for a funnel_step with an unknown funnel", async () => {
    const handler = await loadHandler();
    const res = makeRes();
    await handler(
      {
        method: "POST",
        body: { event: "funnel_step", properties: { funnel: "sketchy", step: "x" } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for a funnel_step with a missing step", async () => {
    const handler = await loadHandler();
    const res = makeRes();
    await handler(
      {
        method: "POST",
        body: { event: "funnel_step", properties: { funnel: "login" } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("persists a valid funnel_step to funnelEvents", async () => {
    const handler = await loadHandler();
    const res = makeRes();
    await handler(
      {
        method: "POST",
        body: {
          event: "funnel_step",
          properties: { funnel: "login", step: "role_selected", funnelId: "abc", role: "builder" },
          timestamp: Date.now(),
          url: "https://pledgebond.com/login",
        },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const { db } = await import("@/lib/firebase/serverOnly");
    const coll = db.collection("funnelEvents");
    expect(coll.add).toHaveBeenCalled();
    const written = coll.add.mock.calls[0][0];
    expect(written.funnel).toBe("login");
    expect(written.step).toBe("role_selected");
    expect(written.funnelId).toBe("abc");
    expect(written.role).toBe("builder");
    expect(written.url).toBe("https://pledgebond.com/login");
    expect(written.serverTimestamp).toBeTypeOf("string");
  });

  it("drops non-allowlisted property keys before persisting", async () => {
    const handler = await loadHandler();
    const res = makeRes();
    await handler(
      {
        method: "POST",
        body: {
          event: "funnel_step",
          properties: {
            funnel: "backing",
            step: "tx_confirmed",
            projectId: "proj-1",
            secret: "should-not-persist",
          },
        },
      },
      res,
    );
    const { db } = await import("@/lib/firebase/serverOnly");
    const written = db.collection("funnelEvents").add.mock.calls[0][0];
    expect(written.projectId).toBe("proj-1");
    expect(written).not.toHaveProperty("secret");
  });

  it("still returns 200 when Firestore write fails", async () => {
    const handler = await loadHandler();
    const { db } = await import("@/lib/firebase/serverOnly");
    db.collection("funnelEvents").add.mockImplementationOnce(() =>
      Promise.reject(new Error("firestore down")),
    );
    const res = makeRes();
    await handler(
      {
        method: "POST",
        body: { event: "funnel_step", properties: { funnel: "login", step: "role_selected" } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(db.collection).toHaveBeenCalledWith("funnelEvents");
  });
});
