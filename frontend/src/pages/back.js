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
import Modal from "@/components/common/Modal";
import ErrorBoundary from "@/components/ErrorBoundary";
import DiscoverTab from "@/components/back/DiscoverTab";
import PortfolioTab from "@/components/back/PortfolioTab";
import AgentsTab from "@/components/back/AgentsTab";
import { PrivacyOnboarding, PrivacyBadge } from "@/components/common/PrivacyShield";
import { isPrivacyDismissed, markPrivacyDismissed, isBannerDismissed } from "@/lib/onboarding/storage";
import { useOnboardingCoordinator } from "@/components/onboarding/OnboardingCoordinator";

export default function BackPage() {
  const router = useRouter();
  const { userRole, onboardingComplete } = useUser();
  const { surfacesBlocked } = useOnboardingCoordinator();
  const [tab, setTabState] = useState("discover");
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (surfacesBlocked) return;
    if (userRole !== "backer") return;
    if (isPrivacyDismissed()) return;
    if (onboardingComplete && !isBannerDismissed()) return;
    setShowPrivacy(true);
  }, [userRole, surfacesBlocked, onboardingComplete]);

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
    if (normalized && normalized !== tab) {
      setTabState(normalized);
    } else if (!normalized && tab !== "discover") {
      setTabState("discover");
    }
  }, [router.isReady, router.query.tab, tab]);

  const setTab = (t) => {
    setTabState(t);
    const query = t === "discover" ? {} : { tab: t };
    if (t === "agents") {
      query.mode = router.query.mode || "jury";
      if (router.query.project) query.project = router.query.project;
    }
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  const dismissPrivacy = () => {
    setShowPrivacy(false);
    markPrivacyDismissed();
  };

  const tabs = [
    { id: "discover", label: "Discover" },
    { id: "portfolio", label: "My Positions" },
    { id: "agents", label: "Agents" },
  ];

  return (
    <ErrorBoundary name="BackPage" errorMessage="Failed to load. Please refresh.">
      <Head><title>Back | PledgeBond</title></Head>
      <div className="min-h-screen bg-surface-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Modal
            isOpen={showPrivacy}
            onClose={dismissPrivacy}
            showCloseButton={false}
            size="md"
            className="p-0 overflow-hidden"
          >
            <PrivacyOnboarding onDismiss={dismissPrivacy} />
          </Modal>

          <PageHeader
            title="Back Builders"
            subtitle="Discover projects to back, track your positions, and run AI agents."
            actions={<PrivacyBadge />}
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
              <PortfolioTab setTab={setTab} />
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
