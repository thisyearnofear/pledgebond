/**
 * Back Page — unified project marketplace + portfolio + agents hub
 */

import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useUser } from "@/stores/authStore";
import { normalizeBackTab } from "@/config/navigation";
import TabBar from "@/components/common/TabBar";
import PageHeader from "@/components/common/PageHeader";
import ErrorBoundary from "@/components/ErrorBoundary";
import DiscoverTab from "@/components/back/DiscoverTab";
import PortfolioTab from "@/components/back/PortfolioTab";
import AgentsTab from "@/components/back/AgentsTab";
import { useApp } from "@/stores/profileStore";
import { useOnboardingCoordinator } from "@/components/onboarding/OnboardingCoordinator";

export default function BackPage() {
  const router = useRouter();
  const { userRole, onboardingComplete } = useUser();
  const { surfacesBlocked } = useOnboardingCoordinator();
  const [tab, setTabState] = useState("discover");
  const [positionCount, setPositionCount] = useState(null);
  const [claimableCount, setClaimableCount] = useState(0);

  useEffect(() => {
    if (!router.isReady) return;
    const rawTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
    if (rawTab === "economy") {
      const query = { tab: "agents" };
      if (router.query.mode) query.mode = router.query.mode;
      router.replace({ pathname: "/back", query }, undefined, { shallow: true });
      return;
    }
    const normalized = normalizeBackTab(router.query.tab);
    // Explicit tab in URL always wins (deep links, sharable state).
    if (normalized && normalized !== tab) {
      setTabState(normalized);
    } else if (!normalized && tab !== "discover") {
      setTabState("discover");
    }
  }, [router.isReady, router.query.tab, tab]);

  // Adaptive landing: backers with positions land on their money, not Discover.
  // Count resolves async (chain read); tab only upgrades discover → portfolio,
  // never overrides an explicit tab or an in-progress navigation.
  useEffect(() => {
    if (!router.isReady || router.query.tab) return;
    if (positionCount == null || positionCount <= 0) return;
    if (tab !== "discover") return;
    setTab("portfolio");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, positionCount, tab]);

  const setTab = (t) => {
    setTabState(t);
    const query = t === "discover" ? {} : { tab: t };
    if (t === "agents") {
      query.mode = router.query.mode || "jury";
      if (router.query.project) query.project = router.query.project;
    }
    // Badge deep-link: a "★ claim" positions badge jumps straight to the
    // first matured-unclaimed position.
    if (t === "portfolio" && claimableCount > 0) query.focus = "claim";
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  const tabs = [
    { id: "discover", label: "Discover" },
    {
      id: "portfolio",
      label:
        claimableCount > 0
          ? `My Positions (${positionCount}) • ★ ${claimableCount} to claim`
          : positionCount > 0
            ? `My Positions (${positionCount})`
            : "My Positions",
    },
    { id: "agents", label: "Agents" },
  ];

  // PortfolioTab reports counts up so the tab badge + adaptive landing work
  // without a second chain read here.
  const handlePositions = (n, claimable = 0) => {
    if (typeof n === "number" && n !== positionCount) setPositionCount(n);
    if (typeof claimable === "number" && claimable !== claimableCount) setClaimableCount(claimable);
  };

  // Compact portfolio for experienced backers (fewer px per card).
  const { getAdaptiveSettings } = useApp();
  const compactPortfolio = getAdaptiveSettings().enableCompactMode;

  return (
    <ErrorBoundary name="BackPage" errorMessage="Failed to load. Please refresh.">
      <Head><title>Back | PledgeBond</title></Head>
      <div className="min-h-screen bg-surface-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <PageHeader
            title="Back Builders"
            subtitle="Discover projects to back, track your positions, and run AI agents."
          />

          <TabBar
            tabs={tabs}
            activeTab={tab}
            onChange={setTab}
            variant="pill"
            className="mb-6"
          />

          {tab === "discover" ? (
            <ErrorBoundary name="DiscoverTab" errorMessage="Failed to load projects. Please try again.">
              <DiscoverTab />
            </ErrorBoundary>
          ) : tab === "portfolio" ? (
            <ErrorBoundary name="PortfolioTab" errorMessage="Failed to load positions. Please try again.">
              <PortfolioTab setTab={setTab} onPositions={handlePositions} compact={compactPortfolio} />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary name="AgentsTab" errorMessage="Failed to load AI agents. Please try again.">
              <AgentsTab />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
