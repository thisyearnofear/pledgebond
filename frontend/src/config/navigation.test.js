import { describe, it, expect } from "vitest";
import {
  PRIMARY_NAV,
  filterNavItems,
  agentsHref,
  exploreHref,
  normalizeBackTab,
  AGENTS_TAB,
} from "@/config/navigation";

describe("PRIMARY_NAV", () => {
  it("exposes four top-level items", () => {
    expect(PRIMARY_NAV).toHaveLength(4);
    expect(PRIMARY_NAV.map((item) => item.id)).toEqual([
      "explore",
      "leaderboard",
      "build",
      "back",
    ]);
  });
});

describe("filterNavItems", () => {
  it("hides build for backers", () => {
    const items = filterNavItems(PRIMARY_NAV, {
      currentUser: { uid: "u1" },
      userRole: "backer",
    });
    expect(items.map((i) => i.id)).toEqual(["explore", "leaderboard", "back"]);
  });

  it("hides build for guests", () => {
    const items = filterNavItems(PRIMARY_NAV, {
      currentUser: null,
      userRole: null,
    });
    expect(items.map((i) => i.id)).toEqual(["explore", "leaderboard", "back"]);
  });

  it("shows build for authenticated builders", () => {
    const items = filterNavItems(PRIMARY_NAV, {
      currentUser: { uid: "u1" },
      userRole: "builder",
    });
    expect(items.map((i) => i.id)).toEqual(["explore", "leaderboard", "build", "back"]);
  });
});

describe("agentsHref", () => {
  it("defaults to jury mode", () => {
    expect(agentsHref()).toBe(`/back?tab=${AGENTS_TAB}&mode=jury`);
    expect(agentsHref("jury")).toBe(`/back?tab=${AGENTS_TAB}&mode=jury`);
  });

  it("includes mode for agent tabs", () => {
    expect(agentsHref("analyze")).toBe(`/back?tab=${AGENTS_TAB}&mode=analyze`);
    expect(agentsHref("scout")).toBe(`/back?tab=${AGENTS_TAB}&mode=scout`);
    expect(agentsHref("compare")).toBe(`/back?tab=${AGENTS_TAB}&mode=compare`);
  });

  it("includes project id for deep links", () => {
    expect(agentsHref("analyze", "proj-1")).toBe(`/back?tab=${AGENTS_TAB}&mode=analyze&project=proj-1`);
    expect(agentsHref("scout", "proj-2")).toBe(
      `/back?tab=${AGENTS_TAB}&mode=scout&project=proj-2`,
    );
  });
});

describe("exploreHref", () => {
  it("builds explore URLs with optional ecosystem filter", () => {
    expect(exploreHref()).toBe("/explore");
    expect(exploreHref("all")).toBe("/explore");
    expect(exploreHref("base")).toBe("/explore?ecosystem=base");
  });
});

describe("normalizeBackTab", () => {
  it("maps legacy economy tab to agents", () => {
    expect(normalizeBackTab("economy")).toBe("agents");
  });

  it("passes through known tabs", () => {
    expect(normalizeBackTab("portfolio")).toBe("portfolio");
    expect(normalizeBackTab("agents")).toBe("agents");
  });
});
