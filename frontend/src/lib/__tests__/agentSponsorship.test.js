/**
 * Tests for lib/agentSponsorship — free-first agent call budget.
 *
 * The library sponsors nothing unless AGENT_SPONSOR_GLOBAL_CAP bounds total
 * spend (fail-closed), and decrements run inside a Firestore transaction.
 * The mock below provides both so the real code path is exercised.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** @type {Record<string, any>} */
let sponsorshipDocs = {};
/** @type {any} */
let globalDoc;

function state(name, id) {
  return name === "agentSponsorshipGlobal"
    ? {
        read: () => globalDoc,
        write: (data) => {
          globalDoc = { ...(globalDoc || {}), ...data };
        },
      }
    : {
        read: () => sponsorshipDocs[id],
        write: (data) => {
          sponsorshipDocs[id] = { ...(sponsorshipDocs[id] || {}), ...data };
        },
      };
}

function snap(data) {
  return { exists: data !== undefined, data: () => data };
}

vi.mock("@/lib/firebase/serverOnly", () => ({
  db: {
    collection: (name) => ({
      doc: (id) => {
        const s = state(name, id);
        return {
          _s: s,
          get: async () => snap(s.read()),
          set: async (data) => s.write(data),
        };
      },
    }),
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => snap(ref._s.read()),
        set: (ref, data) => ref._s.write(data),
      }),
  },
}));

async function loadLib() {
  return import("@/lib/agentSponsorship");
}

describe("agentSponsorship", () => {
  beforeEach(() => {
    sponsorshipDocs = {};
    globalDoc = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.AGENT_SPONSOR_GLOBAL_CAP;
  });

  describe("getSponsorshipStatus", () => {
    it("grants the default budget to a new authenticated user", async () => {
      const { getSponsorshipStatus } = await loadLib();
      const status = await getSponsorshipStatus({ uid: "user-1", ip: "1.2.3.4" });
      expect(status.eligible).toBe(true);
      expect(status.callsRemaining).toBe(3);
      expect(status.key).toBe("uid:user-1");
    });

    it("grants exactly one sponsored call to anonymous callers", async () => {
      const { getSponsorshipStatus } = await loadLib();
      const status = await getSponsorshipStatus({ uid: null, ip: "5.6.7.8" });
      expect(status.eligible).toBe(true);
      expect(status.callsRemaining).toBe(1);
      expect(status.key).toBe("ip:5.6.7.8");
    });

    it("reports ineligible when the budget is spent", async () => {
      sponsorshipDocs["uid:user-1"] = { callsRemaining: 0, callsUsed: 3 };
      const { getSponsorshipStatus } = await loadLib();
      const status = await getSponsorshipStatus({ uid: "user-1", ip: null });
      expect(status.eligible).toBe(false);
      expect(status.callsRemaining).toBe(0);
    });
  });

  describe("consumeSponsoredCall", () => {
    it("decrements the budget and persists the usage", async () => {
      process.env.AGENT_SPONSOR_GLOBAL_CAP = "10";
      const { consumeSponsoredCall } = await loadLib();
      const result = await consumeSponsoredCall({ uid: "user-1", ip: null });
      expect(result).toEqual({ sponsored: true, callsRemaining: 2 });
      expect(sponsorshipDocs["uid:user-1"].callsRemaining).toBe(2);
      expect(sponsorshipDocs["uid:user-1"].callsUsed).toBe(1);
      expect(globalDoc.callsUsed).toBe(1);
    });

    it("returns null when the budget is exhausted", async () => {
      process.env.AGENT_SPONSOR_GLOBAL_CAP = "10";
      sponsorshipDocs["uid:user-1"] = { callsRemaining: 0, callsUsed: 3 };
      const { consumeSponsoredCall } = await loadLib();
      const result = await consumeSponsoredCall({ uid: "user-1", ip: null });
      expect(result).toBeNull();
    });

    it("anonymous callers consume their single call and become ineligible", async () => {
      process.env.AGENT_SPONSOR_GLOBAL_CAP = "10";
      const { consumeSponsoredCall } = await loadLib();
      const first = await consumeSponsoredCall({ uid: null, ip: "9.9.9.9" });
      expect(first.sponsored).toBe(true);
      const second = await consumeSponsoredCall({ uid: null, ip: "9.9.9.9" });
      expect(second).toBeNull();
    });

    it("sponsors nothing without a global cap (fail closed)", async () => {
      const { consumeSponsoredCall } = await loadLib();
      const result = await consumeSponsoredCall({ uid: "user-1", ip: null });
      expect(result).toBeNull();
    });
  });
});
