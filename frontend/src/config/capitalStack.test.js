import { describe, it, expect } from "vitest";
import {
  CAPITAL_RAILS,
  getRailById,
  getRailStatus,
  isRailAvailable,
  isRailIntegrated,
  RAIL_STATUS_LABELS,
  CAPITAL_STACK_ANCHOR_ID,
  CAPITAL_STACK_HREF,
} from "@/config/capitalStack";

describe("CAPITAL_RAILS", () => {
  it("defines two rails in progression order", () => {
    expect(CAPITAL_RAILS.map((r) => r.id)).toEqual(["loan", "market"]);
  });

  it("every rail has a display status label", () => {
    for (const rail of CAPITAL_RAILS) {
      expect(RAIL_STATUS_LABELS[rail.status]).toBeTruthy();
    }
  });
});

describe("getRailById", () => {
  it("returns rail metadata", () => {
    expect(getRailById("loan")?.title).toBe("Bridge Loan");
  });
});

describe("getRailStatus", () => {
  it("marks the wired loan rail live and the market coming soon", () => {
    expect(getRailStatus("loan")).toBe("live");
    // The rail has placeBet on-chain but no bettor UI wires it yet, so
    // calling the market "live" would overclaim a fundable instrument.
    expect(getRailStatus("market")).toBe("coming_soon");
  });
});

describe("isRailIntegrated", () => {
  it("returns false for coming soon rails", () => {
    expect(isRailIntegrated("loan")).toBe(true);
    expect(isRailIntegrated("market")).toBe(false);
  });

  it("treats beta as available", () => {
    expect(isRailAvailable("beta")).toBe(true);
    expect(isRailAvailable("coming_soon")).toBe(false);
  });
});

describe("capital stack deep links", () => {
  it("exposes a landing anchor href", () => {
    expect(CAPITAL_STACK_ANCHOR_ID).toBe("capital-stack");
    expect(CAPITAL_STACK_HREF).toBe("/#capital-stack");
  });
});
