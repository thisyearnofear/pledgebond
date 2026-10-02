/**
 * Tests for lib/agentSponsorship — free-first agent call budget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Firestore mock: agentSponsorships doc get/set captured on a plain object.
 */
/** @type {Record<string, any>} */
let sponsorshipDocs = {};

vi.mock("@/lib/firebase/serverOnly", () => ({
  db: {
    collection: vi.fn((name) => {
      /** @type {any} */
      const q = {};
      q.doc = vi.fn((id) => ({
        get: vi.fn(() =>
          Promise.resolve({
            exists: sponsorshipDocs[id] !== undefined,
            data: () => sponsorshipDocs[id],
          }),
        ),
        set: vi.fn((data, opts) => {
          const key = id;
          sponsorshipDocs[key] = sponsorshipDocs[key]
            ? { ...sponsorshipDocs[key], ...data }
            : data;
          return Promise.resolve();
        }),
      }));
      return q;
    }),
  },
}));

async function loadLib() {
  return import("@/lib/agentSponsorship");
}

describe("agentSponsorship", () => {
  beforeEach(() => {
    sponsorshipDocs = {};
    vi.clearAllMocks();
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
      const { consumeSponsoredCall } = await loadLib();
      const result = await consumeSponsoredCall({ uid: "user-1", ip: null });
      expect(result).toEqual({ sponsored: true, callsRemaining: 2 });
      expect(sponsorshipDocs["uid:user-1"].callsRemaining).toBe(2);
      expect(sponsorshipDocs["uid:user-1"].callsUsed).toBe(1);
    });

    it("returns null when the budget is exhausted", async () => {
      sponsorshipDocs["uid:user-1"] = { callsRemaining: 0, callsUsed: 3 };
      const { consumeSponsoredCall } = await loadLib();
      const result = await consumeSponsoredCall({ uid: "user-1", ip: null });
      expect(result).toBeNull();
    });

    it("anonymous callers consume their single call and become ineligible", async () => {
      const { consumeSponsoredCall } = await loadLib();
      const first = await consumeSponsoredCall({ uid: null, ip: "9.9.9.9" });
      expect(first.sponsored).toBe(true);

      sponsorshipDocs["ip:9.9.9.9"] = { callsRemaining: 0, callsUsed: 1 };
      const second = await consumeSponsoredCall({ uid: null, ip: "9.9.9.9" });
      expect(second).toBeNull();
    });
  });
});
