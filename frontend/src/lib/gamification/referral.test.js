import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateReferralCode,
  buildReferralUrl,
  storeReferralCode,
  getStoredReferralCode,
  clearStoredReferralCode,
  storeShareAttribution,
  getStoredShareAttribution,
  clearStoredShareAttribution,
  setSharerCode,
  getSharerCode,
  REFERRAL_BONUS_XP,
} from "./referral";

describe("referral", () => {
  describe("generateReferralCode", () => {
    it("generates a code from a username", () => {
      const code = generateReferralCode("alice");
      expect(code).toMatch(/^ref_[a-z0-9]+$/);
    });

    it("generates the same code for the same input", () => {
      expect(generateReferralCode("alice")).toBe(generateReferralCode("alice"));
    });

    it("generates different codes for different inputs", () => {
      expect(generateReferralCode("alice")).not.toBe(generateReferralCode("bob"));
    });

    it("handles case-insensitivity", () => {
      expect(generateReferralCode("Alice")).toBe(generateReferralCode("alice"));
    });

    it("returns null for empty input", () => {
      expect(generateReferralCode("")).toBeNull();
      expect(generateReferralCode(null)).toBeNull();
    });
  });

  describe("buildReferralUrl", () => {
    it("builds a URL with the referral code", () => {
      const url = buildReferralUrl("alice", "https://example.com");
      expect(url).toMatch(/^https:\/\/example\.com\/ref\/ref_[a-z0-9]+$/);
    });

    it("returns null for empty identifier", () => {
      expect(buildReferralUrl("", "https://example.com")).toBeNull();
    });
  });

  describe("localStorage referral storage", () => {
    let store;

    beforeEach(() => {
      // The vitest setup mocks localStorage with vi.fn() — we need a real
      // in-memory store for these tests.
      store = {};
      vi.mocked(localStorage.getItem).mockImplementation((key) => store[key] ?? null);
      vi.mocked(localStorage.setItem).mockImplementation((key, value) => { store[key] = String(value); });
      vi.mocked(localStorage.removeItem).mockImplementation((key) => { delete store[key]; });
      vi.mocked(localStorage.clear).mockImplementation(() => { store = {}; });
    });

    it("stores and retrieves a referral code", () => {
      storeReferralCode("ref_abc123");
      expect(getStoredReferralCode()).toBe("ref_abc123");
    });

    it("does not overwrite an existing code (first-touch wins)", () => {
      storeReferralCode("ref_first");
      storeReferralCode("ref_second");
      expect(getStoredReferralCode()).toBe("ref_first");
    });

    it("clears the stored code", () => {
      storeReferralCode("ref_abc");
      clearStoredReferralCode();
      expect(getStoredReferralCode()).toBeNull();
    });

    it("returns null when no code is stored", () => {
      expect(getStoredReferralCode()).toBeNull();
    });
  });

  describe("share attribution storage", () => {
    let store;

    beforeEach(() => {
      store = {};
      vi.mocked(localStorage.getItem).mockImplementation((key) => store[key] ?? null);
      vi.mocked(localStorage.setItem).mockImplementation((key, value) => { store[key] = String(value); });
      vi.mocked(localStorage.removeItem).mockImplementation((key) => { delete store[key]; });
      vi.mocked(localStorage.clear).mockImplementation(() => { store = {}; });
    });

    it("stores and retrieves share attribution", () => {
      storeShareAttribution({ code: "ref_abc", variant: "1", ref: "hackathon-2" });
      expect(getStoredShareAttribution()).toEqual({
        code: "ref_abc",
        variant: "1",
        ref: "hackathon-2",
      });
    });

    it("does not overwrite existing attribution (first-touch wins)", () => {
      storeShareAttribution({ code: "ref_first", variant: "0", ref: "builder-1" });
      storeShareAttribution({ code: "ref_second", variant: "2", ref: "project-3" });
      expect(getStoredShareAttribution().code).toBe("ref_first");
    });

    it("normalizes missing variant and ref to null", () => {
      storeShareAttribution({ code: "ref_abc" });
      expect(getStoredShareAttribution()).toEqual({ code: "ref_abc", variant: null, ref: null });
    });

    it("ignores attribution without a code", () => {
      storeShareAttribution({ variant: "1" });
      storeShareAttribution(null);
      expect(getStoredShareAttribution()).toBeNull();
    });

    it("clears the stored attribution", () => {
      storeShareAttribution({ code: "ref_abc" });
      clearStoredShareAttribution();
      expect(getStoredShareAttribution()).toBeNull();
    });
  });

  describe("sharer code", () => {
    it("round-trips through set/get", () => {
      setSharerCode("ref_abc");
      expect(getSharerCode()).toBe("ref_abc");
      setSharerCode(null);
      expect(getSharerCode()).toBeNull();
    });
  });

  describe("REFERRAL_BONUS_XP", () => {
    it("is a positive number", () => {
      expect(REFERRAL_BONUS_XP).toBeGreaterThan(0);
    });
  });
});
