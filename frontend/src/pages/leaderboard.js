/**
 * Leaderboard Page — Torque-powered rankings
 *
 * Orchestration only. Each tab and the OG card resolution are delegated
 * to extracted components in `@/components/leaderboard` and the
 * `useLeaderboardOG` hook.
 */

import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { TrophyIcon } from "@heroicons/react/24/outline";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import PageHeader from "@/components/common/PageHeader";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useLeaderboardOG } from "@/hooks/useLeaderboardOG";
import { useUser } from "@/stores/authStore";
import { trackEvent } from "@/lib/analytics";
import {
  generateReferralCode,
  setSharerCode,
  storeReferralCode,
  storeShareAttribution,
} from "@/lib/gamification/referral";
import {
  TABS,
  TAB_EXPLAINERS,
  EmptyState,
  FastestPayoutHero,
  HackathonLeaderboardList,
  LeaderboardList,
  ProofBuildersList,
  ProvenProjectsList,
} from "@/components/leaderboard";

const EMPTY_ENTRIES = { builders: [], proofBuilders: [], projects: [], lenders: [], hackathons: [] };

// `?ref=` prefixes map to the tab that owns the entry — shared links
// auto-switch tabs so the highlighted entry is actually rendered.
const REF_TO_TAB = {
  "proof-builder": "proof-builders",
  project: "projects",
  hackathon: "hackathons",
  builder: "builders",
  backer: "lenders",
};

function refTargetTab(ref) {
  if (typeof ref !== "string") return null;
  const type = Object.keys(REF_TO_TAB).find((k) => ref.startsWith(`${k}-`));
  return type ? REF_TO_TAB[type] : null;
}

export default function LeaderboardPage() {
  const router = useRouter();
  // "backers" was the pre-rail tab id; old shared links keep working.
  const rawTab = router.query.tab === "backers" ? "lenders" : router.query.tab;
  const tab = rawTab || "hackathons";
  const setTab = (t) => {
    router.replace(
      { pathname: router.pathname, query: t === "hackathons" ? {} : { tab: t } },
      undefined,
      { shallow: true },
    );
  };
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState(EMPTY_ENTRIES);

  useEffect(() => {
    if (router.query.tab === "backers" && router.isReady) {
      router.replace(
        { pathname: router.pathname, query: { tab: "lenders" } },
        undefined,
        { shallow: true },
      );
    }
  }, [router.query.tab, router.isReady]);

  useEffect(() => {
    let cancelled = false;

    async function loadTorque() {
      // Only gates the builders/lenders tabs; hackathon tabs render from the
      // second fetch so a slow/failing Torque call can't blank the page.
      const needsTorque = tab === "builders" || tab === "lenders";
      if (needsTorque) setLoading(true);
      try {
        const res = await fetch("/api/torque/leaderboard");
        if (!res.ok) throw new Error("Failed to load leaderboard");
        const data = await res.json();
        if (cancelled) return;
        setEntries((prev) => ({
          ...prev,
          builders: (data.builders || []).map((b) => ({ ...b, source: b.source || "firestore" })),
          lenders: (data.backers || []).map((b) => ({ ...b, source: b.source || "firestore" })),
        }));
      } catch (err) {
        console.warn("Leaderboard fetch failed:", err);
        if (!cancelled && needsTorque) setEntries(EMPTY_ENTRIES);
      } finally {
        if (!cancelled && needsTorque) setLoading(false);
      }
    }

    async function loadHackathons() {
      // Own loading lane so hackathon tabs paint even while Torque is slow.
      if (tab === "builders" || tab === "lenders") return;
      setLoading(true);
      try {
        const res = await fetch("/api/hackathons/leaderboard");
        if (!res.ok) throw new Error("Failed to load hackathon leaderboard");
        const data = await res.json();
        if (cancelled) return;
        setEntries((prev) => ({
          ...prev,
          hackathons: data.hackathons || [],
          proofBuilders: data.builders || [],
          projects: data.projects || [],
        }));
      } catch (err) {
        console.warn("Hackathon leaderboard fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTorque();
    loadHackathons();
    return () => { cancelled = true; };
  }, [tab]);

  const { highlightedEntry, ogImageUrl, ogTitle, ogDescription } = useLeaderboardOG(router.query.ref, entries);
  const { currentUser } = useUser();

  // A shared `?ref=` link may target a non-default tab — switch to it while
  // preserving ref/s/v so the OG card, attribution, and highlight survive.
  const targetTab = refTargetTab(router.query.ref);
  useEffect(() => {
    if (!router.isReady || !targetTab || tab === targetTab) return;
    const query = { ...router.query };
    if (targetTab === "hackathons") delete query.tab;
    else query.tab = targetTab;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  }, [router.isReady, targetTab, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate the sharer identity so ShareButton links carry `s=<code>` —
  // this is what makes the share → signup path attributable.
  useEffect(() => {
    setSharerCode(currentUser ? generateReferralCode(currentUser.uid) : null);
  }, [currentUser]);

  // Landing from a shared link: log the funnel step whenever the URL marks
  // a share (s or v), and record first-touch referral attribution when the
  // sharer is identified — so invite rate × conversion = K-factor is
  // computable even for anonymous shares.
  useEffect(() => {
    if (!router.isReady) return;
    const s = router.query.s;
    const variant = router.query.v !== undefined ? String(router.query.v) : null;
    const ref = router.query.ref ? String(router.query.ref) : null;
    if (!s && variant === null) return;
    if (s) {
      const shareCode = String(s);
      storeReferralCode(shareCode);
      storeShareAttribution({ code: shareCode, variant, ref });
    }
    trackEvent("funnel_step", {
      funnel: "share",
      step: "landing",
      funnelId: s ? String(s) : "anon",
      variant,
      ref,
    });
  }, [router.isReady, router.query.s, router.query.v, router.query.ref]);

  const currentList =
    tab === "builders" ? entries.builders :
    tab === "proof-builders" ? entries.proofBuilders :
    tab === "projects" ? entries.projects :
    tab === "lenders" ? entries.lenders :
    entries.hackathons;

  return (
    <ErrorBoundary name="LeaderboardPage" errorMessage="Failed to load leaderboard.">
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="PledgeBond" />
        <meta property="og:url" content={`https://pledgebond.com${router.asPath}`} />
        {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}
        {ogImageUrl && <meta property="og:image:width" content="1200" />}
        {ogImageUrl && <meta property="og:image:height" content="630" />}
        <meta name="twitter:card" content="summary_large_image" />
        {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}
        {ogTitle && <meta name="twitter:title" content={ogTitle} />}
        {ogDescription && <meta name="twitter:description" content={ogDescription} />}
      </Head>

      <div className="min-h-screen bg-surface-secondary">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader
            className="mb-8"
            title="Payout Leaderboard"
            subtitle="Real payout speeds from real hackathons. Ranked by how fast winners actually get paid."
            detail={TAB_EXPLAINERS[tab]}
            icon={<TrophyIcon className="w-8 h-8 text-yellow-500 dark:text-yellow-400" />}
          />

          <div className="flex flex-wrap gap-2 mb-6">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-surface-primary text-text-secondary hover:bg-surface-tertiary border border-border-primary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : currentList.length === 0 ? (
            <EmptyState tab={tab} />
          ) : tab === "hackathons" ? (
            <>
              <FastestPayoutHero entries={currentList} />
              <HackathonLeaderboardList entries={currentList} highlightedEntry={highlightedEntry?.entry} />
            </>
          ) : tab === "proof-builders" ? (
            <ProofBuildersList entries={currentList} highlightedEntry={highlightedEntry?.entry} />
          ) : tab === "projects" ? (
            <ProvenProjectsList entries={currentList} highlightedEntry={highlightedEntry?.entry} />
          ) : (
            <LeaderboardList entries={currentList} type={tab} highlightedEntry={highlightedEntry?.entry} />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
