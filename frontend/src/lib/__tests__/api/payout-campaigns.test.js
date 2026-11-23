/**
 * API Route Tests — payout campaigns (sponsor-side payout router)
 * Covers: auth, validation, status machine, recipient view, route lifecycle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory Firestore stand-in
const store = new Map();
const docsOf = (name) =>
  [...store.entries()]
    .filter(([k]) => k.startsWith(`${name}/`))
    .map(([k, v]) => ({ id: k.slice(name.length + 1), data: () => v }));

function applyUpdate(current, update) {
  const next = { ...current };
  for (const [key, value] of Object.entries(update)) {
    if (key.includes(".")) {
      const [head, ...rest] = key.split(".");
      let node = { ...(next[head] || {}) };
      next[head] = node;
      const lastKey = rest.pop();
      for (const part of rest) {
        node[part] = { ...(node[part] || {}) };
        node = node[part];
      }
      node[lastKey] = value;
    } else {
      next[key] = value;
    }
  }
  return next;
}

vi.mock("@/lib/firebase/serverOnly", () => ({
  db: {
    collection: vi.fn((name) => ({
      doc: vi.fn((id) => ({
        get: vi.fn(async () => {
          const data = store.get(`${name}/${id}`);
          return { exists: Boolean(data), id, data: () => data };
        }),
        set: vi.fn(async (d, opts) => {
          store.set(
            `${name}/${id}`,
            opts?.merge ? { ...(store.get(`${name}/${id}`) || {}), ...d } : d
          );
        }),
        update: vi.fn(async (d) => {
          store.set(`${name}/${id}`, applyUpdate(store.get(`${name}/${id}`) || {}, d));
        }),
      })),
      add: vi.fn(async (d) => {
        const id = `auto_${Math.random().toString(36).slice(2, 10)}`;
        store.set(`${name}/${id}`, d);
        return { id };
      }),
      where: vi.fn((field, _op, val) => ({
        limit: vi.fn(() => ({
          get: vi.fn(async () => ({ docs: docsOf(name).filter((d) => d.data()[field] === val) })),
        })),
        get: vi.fn(async () => ({ docs: docsOf(name).filter((d) => d.data()[field] === val) })),
      })),
      limit: vi.fn(() => ({
        get: vi.fn(async () => ({ docs: docsOf(name) })),
      })),
    })),
  },
  auth: {
    verifyIdToken: vi.fn(async (token) => {
      if (token === "bad") throw new Error("invalid token");
      return { uid: token };
    }),
  },
}));

vi.mock("@/services/MultiHopperService", () => ({
  isConfigured: vi.fn(() => true),
  createRoute: vi.fn(async ({ campaignId }) => ({
    provider: "multihopper",
    integrationId: "mock-integration",
    routeId: `mh_mock_${campaignId}`,
    routeType: "multi_send",
    status: "submitted",
    createdAt: new Date().toISOString(),
    mock: true,
  })),
  getRouteStatus: vi.fn(async (_route, recipients) => ({
    status: "settled",
    transfers: recipients.map((r) => ({
      wallet: r.wallet,
      amount: r.amount,
      status: "settled",
      signature: `sig_${r.wallet.slice(0, 6)}`,
    })),
    signatures: recipients.map((r) => `sig_${r.wallet.slice(0, 6)}`),
  })),
}));

function mockRes() {
  const res = {};
  res.setHeader = vi.fn(() => res);
  res.getHeader = vi.fn(() => undefined);
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

const authedReq = (overrides = {}) => ({
  method: "GET",
  query: {},
  body: {},
  headers: { authorization: "Bearer sponsor-1" },
  ...overrides,
});

const WALLET_A = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const WALLET_B = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

async function seedCampaign(overrides = {}) {
  const id = `camp_${Math.random().toString(36).slice(2, 8)}`;
  store.set(`payoutCampaigns/${id}`, {
    title: "HackXY winners",
    asset: "USDC",
    recipients: [
      { wallet: WALLET_A, amount: 250 },
      { wallet: WALLET_B, amount: 150 },
    ],
    totalAmount: 400,
    recipientCount: 2,
    evidenceUrl: "https://example.com/winners",
    businessPurpose: "Prize distribution for HackXY 2026 winners",
    sponsorUid: "sponsor-1",
    sponsorName: "sponsor",
    status: "draft",
    route: null,
    settlement: { transfers: [], settledCount: 0, settledAmount: 0, settledAt: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });
  return id;
}

beforeEach(() => {
  store.clear();
});

describe("POST /api/payout-campaigns", () => {
  it("rejects unauthenticated requests", async () => {
    const { default: handler } = await import("../../../pages/api/payout-campaigns/index");
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects invalid bodies", async () => {
    const { default: handler } = await import("../../../pages/api/payout-campaigns/index");
    const res = mockRes();
    await handler(authedReq({ method: "POST", body: { title: "x" } }), res);
    expect(res.statusCode).toBe(400);
  });

  it("creates a draft campaign", async () => {
    const { default: handler } = await import("../../../pages/api/payout-campaigns/index");
    const res = mockRes();
    await handler(
      authedReq({
        method: "POST",
        body: {
          title: "HackXY winners",
          asset: "USDC",
          recipients: [{ wallet: WALLET_A, amount: 250 }],
          businessPurpose: "Prize distribution",
        },
      }),
      res
    );
    expect(res.statusCode).toBe(201);
    const doc = store.get(`payoutCampaigns/${res.body.campaignId}`);
    expect(doc.status).toBe("draft");
    expect(doc.sponsorUid).toBe("sponsor-1");
  });
});

describe("GET /api/payout-campaigns/[id]", () => {
  it("returns sanitized recipient view for a recipient wallet", async () => {
    const id = await seedCampaign({ status: "routing" });
    const { default: handler } = await import("../../../pages/api/payout-campaigns/[id]");
    const res = mockRes();
    await handler(
      { method: "GET", query: { id, wallet: WALLET_A }, headers: {}, body: {} },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.campaign.recipient.amount).toBe(250);
    expect(res.body.campaign.recipients).toBeUndefined();
    expect(res.body.campaign.sponsorUid).toBeUndefined();
  });

  it("404s the recipient view for a non-recipient wallet", async () => {
    const id = await seedCampaign();
    const { default: handler } = await import("../../../pages/api/payout-campaigns/[id]");
    const res = mockRes();
    await handler(
      { method: "GET", query: { id, wallet: "11111111111111111111111111111111" }, headers: {}, body: {} },
      res
    );
    expect(res.statusCode).toBe(404);
  });

  it("blocks a non-sponsor from the full view", async () => {
    const id = await seedCampaign();
    const { default: handler } = await import("../../../pages/api/payout-campaigns/[id]");
    const res = mockRes();
    await handler(
      { method: "GET", query: { id }, headers: { authorization: "Bearer someone-else" }, body: {} },
      res
    );
    expect(res.statusCode).toBe(403);
  });
});

describe("PUT /api/payout-campaigns/[id] transitions", () => {
  it("moves draft → awaiting_funding on submit", async () => {
    const id = await seedCampaign();
    const { default: handler } = await import("../../../pages/api/payout-campaigns/[id]");
    const res = mockRes();
    await handler(authedReq({ method: "PUT", query: { id }, body: { action: "submit" } }), res);
    expect(res.statusCode).toBe(200);
    expect(store.get(`payoutCampaigns/${id}`).status).toBe("awaiting_funding");
  });

  it("approves when the automatic rule passes (evidence + purpose)", async () => {
    const id = await seedCampaign({ status: "awaiting_funding" });
    const { default: handler } = await import("../../../pages/api/payout-campaigns/[id]");
    const res = mockRes();
    await handler(authedReq({ method: "PUT", query: { id }, body: { action: "approve" } }), res);
    expect(res.statusCode).toBe(200);
    expect(store.get(`payoutCampaigns/${id}`).status).toBe("approved");
  });

  it("rejects approval without evidence/purpose", async () => {
    const id = await seedCampaign({ status: "awaiting_funding", evidenceUrl: null, businessPurpose: "" });
    const { default: handler } = await import("../../../pages/api/payout-campaigns/[id]");
    const res = mockRes();
    await handler(authedReq({ method: "PUT", query: { id }, body: { action: "approve" } }), res);
    expect(res.statusCode).toBe(422);
  });

  it("rejects illegal transitions", async () => {
    const id = await seedCampaign({ status: "draft" });
    const { default: handler } = await import("../../../pages/api/payout-campaigns/[id]");
    const res = mockRes();
    await handler(authedReq({ method: "PUT", query: { id }, body: { action: "approve" } }), res);
    expect(res.statusCode).toBe(409);
  });
});

describe("POST+GET /api/payout-campaigns/[id]/route", () => {
  it("creates a route for an approved campaign and reconciles to settled", async () => {
    const id = await seedCampaign({ status: "approved" });
    const { default: handler } = await import("../../../pages/api/payout-campaigns/[id]/route");

    const createRes = mockRes();
    await handler(authedReq({ method: "POST", query: { id } }), createRes);
    expect(createRes.statusCode).toBe(200);
    expect(store.get(`payoutCampaigns/${id}`).status).toBe("routing");
    expect(store.get(`payoutCampaigns/${id}`).route.routeId).toBe(`mh_mock_${id}`);

    const getRes = mockRes();
    await handler(authedReq({ method: "GET", query: { id } }), getRes);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.status).toBe("settled");
    expect(getRes.body.settlement.settledCount).toBe(2);
  });

  it("refuses to route a non-approved campaign", async () => {
    const id = await seedCampaign({ status: "draft" });
    const { default: handler } = await import("../../../pages/api/payout-campaigns/[id]/route");
    const res = mockRes();
    await handler(authedReq({ method: "POST", query: { id } }), res);
    expect(res.statusCode).toBe(409);
  });
});
