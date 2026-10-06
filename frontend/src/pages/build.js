/**
 * Build Page — unified Credit Profile + Dashboard for builders
 */

import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useWallet } from "@/stores/walletStore";
import { useBuilderCredit } from "@/stores/walletStore";
import { useUser } from "@/stores/authStore";
import { useApp } from "@/stores/profileStore";
import Link from "next/link";
import { useRouter } from "next/router";

import DeveloperDashboard from "@/components/DeveloperDashboard";
import BuilderProjectGrowth from "@/components/projects/BuilderProjectGrowth";
import CrossChainTransfer from "@/components/CrossChainTransfer";
import TransferHistory from "@/components/TransferHistory";
import Button from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import ScorePreviewCard from "@/components/common/ScorePreviewCard";
import SnsIdentityBadge from "@/components/common/SnsIdentityBadge";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import TabBar from "@/components/common/TabBar";
import PageHeader from "@/components/common/PageHeader";
import Card from "@/components/common/Card";
import CapitalStack from "@/components/sections/CapitalStack";
import WinnerHome from "@/components/winner/WinnerHome";
import BridgeLoanCard from "@/components/winner/BridgeLoanCard";
import WalletLinkBanner from "@/components/common/WalletLinkBanner";
import LinkWalletPrompt from "@/components/common/LinkWalletPrompt";
import useWinnerStatus from "@/hooks/useWinnerStatus";
import {
  CAPITAL_RAILS,
  getRailById,
  isRailIntegrated,
  RAIL_STATUS_LABELS,
  RAIL_STATUS_STYLES,
} from "@/config/capitalStack";

const BUILD_TABS = ["wins", "projects", "funding", "crosschain"];

export default function BuildPage() {
  const { userRole, currentUser } = useUser();
  const router = useRouter();
  const wallet = useWallet();
  const builderCredit = useBuilderCredit();
  const [activeTab, setActiveTab] = useState("wins");
  const ref = router.query.ref;

  const isPayoutReferral = ref === "payouts";

  useEffect(() => {
    if (!router.isReady) return;
    const raw = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
    if (raw && BUILD_TABS.includes(raw) && raw !== activeTab) {
      setActiveTab(raw);
    }
  }, [router.isReady, router.query.tab, activeTab]);

  const setTab = (t) => {
    setActiveTab(t);
    const query = { ...router.query };
    if (t === "wins") {
      delete query.tab;
      // Badge deep-link: "Wins • pending/claim" jumps straight to the
      // exact action card inside the winner desk.
      if (winsBadge && winsBadge !== "Wins") query.focus = "claim";
    } else {
      query.tab = t;
    }
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  const {
    connected,
    loading: metaMaskLoading,
    activeChainFamily,
    setActiveChainFamily,
    solanaConnected,
    disconnectSolana,
    solanaAddress
  } = wallet;
  const { creditProfile, developerProjects, projectDetails, contractLoading, usdcBalance } = builderCredit;

  // ── All hooks before any early return (Rules of Hooks) ────────────────
  // Wins attention: pending claim or unverified win state drives the tab badge.
  // useWinnerStatus is cached (5 min) so this adds no new fetch.
  const { pendingClaim, isVerified } = useWinnerStatus();
  const winsBadge = pendingClaim ? "Wins • pending" : !isVerified && developerProjects?.length > 0 ? "Wins • claim" : "Wins";

  // Compact mode: experienced builders get tighter grids (fewer px per card).
  // Beginners keep the roomy default.
  const { getAdaptiveSettings } = useApp();
  const compactMode = getAdaptiveSettings().enableCompactMode;

  // Rail detection — which capital rail is this builder on?
  const doesHaveProjects = Array.isArray(developerProjects) && developerProjects.length > 0;
  const bagsRail = getRailById("bags");
  const hasBagsToken = false; // user-level: Bags SDK not wired yet
  const bagsIntegrated = isRailIntegrated("bags");
  // useWinnerStatus().isVerified is the source of truth. Scanning
  // developerProjects[].hackathons[] here missed verified wins whose project
  // shape didn't match, which hid the win desk entirely.
  const hasHackathonWins = Boolean(isVerified);

  // Auto-detect connected wallet — if Solana is connected and EVM isn't,
  // default to Solana without requiring the user to click the toggle
  useEffect(() => {
    if (solanaConnected && !connected && activeChainFamily !== 'solana') {
      setActiveChainFamily('solana');
    } else if (connected && !solanaConnected && activeChainFamily !== 'evm') {
      setActiveChainFamily('evm');
    }
  }, [solanaConnected, connected, activeChainFamily, setActiveChainFamily]);

  // Backers should be on /back, not /build
  useEffect(() => {
    if (userRole === 'backer') {
      router.replace('/back');
    }
  }, [userRole, router]);

  // Adaptive landing: builders with projects but no explicit tab skip the
  // Wins desk and land where the work is. Explicit ?tab= always wins.
  useEffect(() => {
    if (!router.isReady || router.query.tab) return;
    if (activeTab !== "wins") return;
    if (developerProjects?.length > 0) setTab("projects");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, developerProjects]);

  if (userRole === 'backer') {
    return null; // Redirecting
  }

  const isActuallyConnected = activeChainFamily === 'solana' ? solanaConnected : connected;
  const anyWalletConnected = connected || solanaConnected;

  const loading = metaMaskLoading || contractLoading;

  if (!isActuallyConnected) {
    return (
      <>
        <Head><title>Build | PledgeBond</title></Head>
        <div className="py-12 max-w-3xl mx-auto px-4 space-y-8">
          {currentUser && (
            <ErrorBoundary name="WinnerHome" errorMessage="Failed to load winner desk.">
              <WinnerHome />
            </ErrorBoundary>
          )}

          <div className="text-center space-y-6">
          <PageHeader
            align="center"
            title={isPayoutReferral ? "Get Paid Today, Not in 67 Days" : "Connect wallet for your win desk"}
            subtitle={
              isPayoutReferral
                ? "You won. The organizer hasn't paid yet. PledgeBond advances USDC against that prize so you can keep building — you set the rate and repay when they pay."
                : currentUser
                  ? "Your win desk above works without a wallet. Connect to manage bridge loans, funding requests, and cross-chain tools."
                  : `Connect your ${activeChainFamily === "solana" ? "Solana" : "EVM"} wallet to view your bridge loans, request funding, and manage projects.`
            }
            icon={
              isPayoutReferral ? (
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-500 shadow-lg shadow-indigo-200/50">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              ) : (
                <ShieldCheckIcon className={`w-16 h-16 ${activeChainFamily === "solana" ? "text-purple-500 dark:text-purple-400" : "text-blue-500 dark:text-blue-400"}`} />
              )
            }
          />
          <div className="flex justify-center">
            <div className="inline-flex p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setActiveChainFamily("evm")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeChainFamily === "evm"
                    ? "bg-surface text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
                }`}
              >
                EVM (Metamask)
              </button>
              <button
                onClick={() => setActiveChainFamily("solana")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeChainFamily === "solana"
                    ? "bg-surface text-purple-600 dark:text-purple-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
                }`}
              >
                Solana
              </button>
            </div>
          </div>
          <div>
            {isPayoutReferral ? (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/login?mode=signup">
                  <Button variant="primary" size="md">Get Funded Now</Button>
                </Link>
                <span className="text-sm text-text-tertiary">or preview your builder track record below</span>
              </div>
            ) : (
              <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                Use your browser wallet extension to connect{activeChainFamily === 'solana' ? ' Solana' : ''}.
              </div>
            )}
          </div>

          <div className={isPayoutReferral ? "" : "border-t border-default pt-8"}>
            <h2 className="text-lg font-semibold text-primary mb-2">
              {isPayoutReferral ? "📊 Your Builder Track Record" : "🔍 Preview Your Track Record"}
            </h2>
            <p className="text-sm text-secondary mb-4">
              {isPayoutReferral
                ? "Enter your GitHub username to see the public record lenders read alongside your win claim — no wallet or login required."
                : "Enter your GitHub username to see your public shipping stats — no login required."}
            </p>
            <ScorePreviewCard />
          </div>

          {!isPayoutReferral && !currentUser && (
            <CapitalStack variant="compact" showHeader className="text-left" />
          )}
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="large" /></div>;
  }

  const tabs = [
    { id: "wins", label: winsBadge },
    { id: "projects", label: doesHaveProjects ? `Projects (${developerProjects.length})` : "Projects" },
    { id: "funding", label: "Get a Loan" },
    { id: "crosschain", label: "Cross-Chain" },
  ];

  return (
    <>
      <Head><title>Build | PledgeBond</title></Head>
      <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Deferred-wallet awareness banner: GitHub-only builders see this
            until they link a wallet or dismiss it. */}
        {currentUser && !anyWalletConnected && <WalletLinkBanner />}
        <PageHeader
          title="Builder Hub"
          subtitle="Your declared wins, your loans, and what you get paid for them."
        />
        {/* Rail progression indicator — demoted visually; still available for funding context */}
        {activeTab !== "wins" && (
        <div className="mb-6">
          <div className="flex items-center gap-3 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium flex-wrap">
              {CAPITAL_RAILS.map((rail, index) => (
                <React.Fragment key={rail.id}>
                  {index > 0 && (
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${
                      (rail.id === "bags" && hasBagsToken) ||
                      (rail.id === "loan" && hasHackathonWins)
                        ? "bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    <span>{rail.emoji} {rail.eyebrow}: {rail.shortTitle}</span>
                    <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${RAIL_STATUS_STYLES[rail.status]}`}>
                      {RAIL_STATUS_LABELS[rail.status]}
                    </span>
                  </span>
                </React.Fragment>
              ))}
            </div>
            <div className="flex-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              {!doesHaveProjects && !hasHackathonWins && (
                <span>
                  Declare a hackathon win to unlock <strong>The loan</strong> — paid in hours
                  against money you have already won.
                </span>
              )}
              {doesHaveProjects && !hasHackathonWins && (
                <span>
                  Win something, then declare it here. Once your win is on-chain you can draw
                  against it instead of waiting for the organizer.
                </span>
              )}
              {hasHackathonWins && (
                <span>
                  Your win is declared. Draw a <strong>bridge loan</strong> against the unpaid
                  prize and repay when it lands.
                </span>
              )}
            </div>
          </div>
        </div>
        )}

        {activeChainFamily === 'solana' && solanaConnected && solanaAddress && (
          <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 dark:text-purple-200">
            Connected builder identity:{" "}
            <SnsIdentityBadge
              address={solanaAddress}
              chainFamily="solana"
              showFallback={true}
              showLoading={true}
              className="text-sm"
            />
          </div>
        )}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={setTab} className="mb-6" />

        {activeTab === "wins" && (
          <ErrorBoundary name="WinsTab" errorMessage="Failed to load winner desk.">
            <WinnerHome />
          </ErrorBoundary>
        )}

        {activeTab === "projects" && (
          <ErrorBoundary name="ProjectsTab" errorMessage="Failed to load projects.">
            <div className={compactMode ? "space-y-5" : "space-y-8"}>
              <BuilderProjectGrowth />
              <div className={`border-t border-slate-200 ${compactMode ? "pt-5" : "pt-8"}`}>
                <DeveloperDashboard />
              </div>
              {/* Bags — Rail 1: launch a project token on Solana */}
              {bagsRail && (
              <div className="border-t border-slate-200 pt-8">
                <Card className="p-6 border-t-4 border-t-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-surface">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">{bagsRail.eyebrow}</span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 dark:text-purple-300 rounded-full">{bagsRail.tag}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${RAIL_STATUS_STYLES[bagsRail.status]}`}>
                          {RAIL_STATUS_LABELS[bagsRail.status]}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-primary">Launch a Bags Token</h3>
                      <p className="text-sm text-secondary mt-1 max-w-xl">
                        {bagsIntegrated
                          ? "Don't have a prize pipeline yet? Launch a project token on Solana via Bags. Community buys in, you earn fee-share yield from trading volume."
                          : "Bags token launch is coming soon. For now, declare a hackathon win to draw a bridge loan."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!bagsIntegrated}
                      className="flex-shrink-0 border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white disabled:opacity-50"
                      onClick={() => bagsIntegrated && window.open('https://bags.gg', '_blank')}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      {bagsIntegrated ? "Launch on Bags" : "Coming soon"}
                    </Button>
                  </div>
                </Card>
              </div>
              )}
            </div>
          </ErrorBoundary>
        )}

        {activeTab === "funding" && (
          <ErrorBoundary name="FundingTab" errorMessage="Failed to load funding interface.">
            {!anyWalletConnected ? (
              <LinkWalletPrompt reason="request funding" />
            ) : (
              <div className="space-y-6">
                <BridgeLoanCard />
              </div>
            )}
          </ErrorBoundary>
        )}

        {activeTab === "crosschain" && (
          <ErrorBoundary name="CrossChainTab" errorMessage="Failed to load cross-chain tools.">
            {!anyWalletConnected ? (
              <LinkWalletPrompt reason="use cross-chain transfers" />
            ) : (
              <div className="space-y-8">
                <CrossChainTransfer />
                <TransferHistory />
              </div>
            )}
          </ErrorBoundary>
        )}
      </div>
    </>
  );
}
