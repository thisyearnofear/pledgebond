/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AGENTS_TAB } from "@/config/navigation";

const replace = vi.fn();

vi.mock("next/head", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    replace,
    query: { ids: "a,b" },
  }),
}));

vi.mock("@/components/common/LoadingStates", () => ({
  LoadingSpinner: () => <div data-testid="loading" />,
}));

describe("legacy AI route redirects", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("redirects /analyze to Back Agents analyze mode", async () => {
    const AnalyzeRedirectPage = (await import("@/pages/analyze")).default;
    render(<AnalyzeRedirectPage />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(`/back?tab=${AGENTS_TAB}&mode=analyze`);
    });
  });

  it("redirects /scout to Back Agents scout mode", async () => {
    const ScoutRedirectPage = (await import("@/pages/scout")).default;
    render(<ScoutRedirectPage />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(`/back?tab=${AGENTS_TAB}&mode=scout`);
    });
  });

  it("redirects /compare and preserves ids query", async () => {
    const CompareRedirectPage = (await import("@/pages/compare")).default;
    render(<CompareRedirectPage />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        `/back?tab=${AGENTS_TAB}&mode=compare&ids=a%2Cb`,
      );
    });
  });
});
