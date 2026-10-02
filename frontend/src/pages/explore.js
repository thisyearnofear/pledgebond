/**
 * Explore — Tabbed discovery surface for projects, builders, and
 * hackathons. Tab routing lives here; each tab is a self-contained
 * component in `@/components/explore`. Tabs are lazy-loaded via
 * `next/dynamic` so the heaviest one (ProjectsTab) doesn't ship in the
 * initial bundle for users landing on the builders or hackathons tab.
 */

import { useEffect } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import TabBar from "@/components/common/TabBar";
import PageHeader from "@/components/common/PageHeader";
import LiveAgentTicker from "@/components/common/LiveAgentTicker";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ECOSYSTEM_CONFIGS } from "@/config/ecosystems";
import useEcosystemPreference from "@/hooks/useEcosystemPreference";
import { useApp } from "@/stores/profileStore";

const ProjectsTab = dynamic(() => import("@/components/explore/ProjectsTab").then((m) => m.default), {
  ssr: false,
  loading: () => null,
});
const BuildersTab = dynamic(() => import("@/components/explore/BuildersTab").then((m) => m.default), {
  ssr: false,
  loading: () => null,
});
const HackathonsTab = dynamic(() => import("@/components/explore/HackathonsTab").then((m) => m.default), {
  ssr: false,
  loading: () => null,
});

const TABS = [
  { id: "projects", label: "Projects" },
  { id: "builders", label: "Builders" },
  { id: "hackathons", label: "Hackathons" },
];

const ECOSYSTEM_IDS = Object.keys(ECOSYSTEM_CONFIGS);

function parseEcosystems(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === "all") return [];
  return [...new Set(raw.split(",").filter((id) => ECOSYSTEM_IDS.includes(id)))];
}

export default function ExplorePage() {
  const router = useRouter();
  const { primary, hasExplicitPrimary, setPrimaryEcosystem, ranked } = useEcosystemPreference();
  const { trackEcosystemInteraction } = useApp();
  const tab = router.query.tab || "projects";
  const selectedEcosystems = parseEcosystems(router.query.ecosystem);

  useEffect(() => {
    if (!router.isReady || router.query.ecosystem !== undefined || !hasExplicitPrimary) return;
    router.replace(
      { pathname: router.pathname, query: { ...router.query, ecosystem: primary } },
      undefined,
      { shallow: true },
    );
  }, [hasExplicitPrimary, primary, router]);

  const setTab = (t) => {
    const query = { ...router.query };
    if (t === "projects") delete query.tab;
    else query.tab = t;
    router.replace(
      { pathname: router.pathname, query },
      undefined,
      { shallow: true },
    );
  };

  const setEcosystems = (ecosystems) => {
    const next = [...new Set(ecosystems)].filter((id) => ECOSYSTEM_IDS.includes(id));
    const query = { ...router.query, ecosystem: next.length > 0 ? next.join(",") : "all" };
    if (next.length > 0) {
      setPrimaryEcosystem(next[0]);
      // Feed the learning loop — filter use is an implicit preference signal.
      try { trackEcosystemInteraction(next[0], "filter"); } catch {}
    }
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  const toggleEcosystem = (id) => {
    setEcosystems(
      selectedEcosystems.includes(id)
        ? selectedEcosystems.filter((ecosystem) => ecosystem !== id)
        : [...selectedEcosystems, id],
    );
  };

  return (
    <ErrorBoundary name="ExplorePage" errorMessage="Failed to load. Please refresh.">
      <Head><title>Explore — PledgeBond</title></Head>
      <div className="min-h-screen bg-surface-secondary">
        <LiveAgentTicker />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <PageHeader
            title="Explore"
            subtitle="Browse projects, builders, and hackathon winners across ecosystems."
            breadcrumbs={[{ label: "Explore" }]}
          />
          <div className="mb-6" aria-label="Ecosystem lens">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Ecosystem lens
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEcosystems([])}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedEcosystems.length === 0
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-default bg-surface text-secondary hover:border-blue-300"
                }`}
              >
                All ecosystems
              </button>
              {ranked.map((id) => {
                const config = ECOSYSTEM_CONFIGS[id];
                if (!config) return null;
                return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleEcosystem(id)}
                  aria-pressed={selectedEcosystems.includes(id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedEcosystems.includes(id)
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-default bg-surface text-secondary hover:border-blue-300"
                  }`}
                >
                  {config.icon} {config.shortName}
                </button>
                );
              })}
            </div>
          </div>
          <TabBar tabs={TABS} activeTab={tab} onChange={setTab} variant="pill" className="mb-6" />
          {tab === "projects" ? (
            <ProjectsTab selectedEcosystems={selectedEcosystems} onEcosystemsChange={setEcosystems} />
          ) : tab === "builders" ? (
            <BuildersTab selectedEcosystems={selectedEcosystems} onEcosystemsChange={setEcosystems} />
          ) : (
            <HackathonsTab selectedEcosystems={selectedEcosystems} />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
