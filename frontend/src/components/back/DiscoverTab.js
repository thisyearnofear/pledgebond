/**
 * DiscoverTab — scout recommendations + shortlist for backers.
 * Full browse/filter lives on /explore.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet, useNanopayment } from "@/stores/walletStore";
import { useToastActions } from "@/components/common/Toast";
import { useProjectData } from "@/hooks/useProjectData";
import useProjectFilters from "@/hooks/useProjectFilters";
import ProjectCard from "@/components/backer/ProjectCard";
import OpenWinsPanel from "@/components/back/OpenWinsPanel";
import LoanTermsModal from "@/components/back/LoanTermsModal";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import { PrivacyBadge } from "@/components/common/PrivacyShield";
import { exploreHref } from "@/config/navigation";
import {
  ECOSYSTEM_FILTER_OPTIONS,
  BACKER_SORT_OPTIONS,
  BACKER_SHORTLIST_LIMIT,
} from "@/components/explore/constants";
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export default function DiscoverTab() {
  const { projects, loading, error, refresh } = useProjectData();
  const wallet = useWallet();
  const { connected } = wallet;
  const { payForScout, loading: nanopaymentLoading, nanopaymentDemoMode } = useNanopayment();
  const toast = useToastActions();

  const [backingProject, setBackingProject] = useState(null);
  const [scoutData, setScoutData] = useState(null);
  const [scouting, setScouting] = useState(false);
  const [scoutMessage, setScoutMessage] = useState(null);

  const {
    filteredProjects,
    totalMatches,
    searchQuery,
    setSearchQuery,
    filterEcosystem,
    setFilterEcosystem,
    setFilterMultiplier,
    sortBy,
    setSortBy,
    hasActiveFilters,
    clearFilters,
  } = useProjectFilters(projects, {
    limit: BACKER_SHORTLIST_LIMIT,
    scoutProjects: scoutData?.projects,
  });

  const runAIScout = async () => {
    setScouting(true);
    setScoutMessage(null);
    try {
      const result = await payForScout();
      if (result.success && result.data) {
        setScoutData(result.data);
        setScoutMessage({
          tone: result.data.status === "ok" ? "success" : "warning",
          text: result.data.nextAction || "Scout finished. Review the recommended projects below.",
          detail: `Source: ${result.data.resultSource || "unknown"} · Payment: ${result.data.agentInfo?.paymentStatus || (result.demoMode ? "demo" : "unknown")}`,
        });
      } else {
        setScoutMessage({
          tone: "error",
          text: result.error || result.data?.error || "Scout could not complete this run.",
          detail: result.data?.details || "Try again after checking your payment setup.",
        });
      }
    } catch (err) {
      console.error("Scout failed:", err);
      setScoutMessage({
        tone: "error",
        text: "Scout failed to complete.",
        detail: err.message || "Try again after checking your connection.",
      });
    } finally {
      setScouting(false);
    }
  };

  useEffect(() => {
    fetch("/api/agent/scout", { headers: { "x-test-mode": "true" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.success || data?.status === "ok") setScoutData(data);
      })
      .catch(() => {});
  }, []);

  const getScoutScore = (projectId) => {
    if (!scoutData?.projects) return null;
    return scoutData.projects.find((p) => p.id === projectId || p.slug === projectId);
  };

  const handleBackProject = (project) => {
    if (!connected) return;
    // A bridge loan is only fundable against a win the organizer has
    // declared on the rail. Shortlisted Firestore projects carry no winId,
    // so route the backer to the Open bridge loans panel instead of opening
    // a funding modal that can't be completed.
    if (!project?.winId) {
      toast.info(
        "Fund a loan against a declared on-chain win — see Open bridge loans above."
      );
      document
        .getElementById("open-bridge-loans")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setBackingProject(project);
  };

  const exploreLink = exploreHref(filterEcosystem);
  const showingShortlist = totalMatches > filteredProjects.length;

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">⚠️ {error}</p>
        <Button onClick={refresh} className="mt-4">Retry</Button>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4 mb-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-2xl">🔭</span>
              <span className="font-medium text-indigo-900 dark:text-indigo-200">Scout your next project</span>
              {scoutData?.summary && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-full">
                  {scoutData.summary.recommended} recommended
                </span>
              )}
            </div>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 max-w-2xl">
              Run one paid scan, review the strongest candidates here, then browse the full fleet on Explore.
            </p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
              {scoutData?.summary
                ? `Last scan: ${scoutData.summary.evaluated} projects evaluated · ${scoutData.summary.totalStake}`
                : `Cost: 0.01 USDC per scan · Mode: ${nanopaymentDemoMode ? "test" : "live"}`}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={runAIScout}
            disabled={scouting || nanopaymentLoading}
            className="flex items-center gap-2"
          >
            {scouting ? (
              <>
                <LoadingSpinner size="sm" />
                Running scout...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Run Scout · $0.01
              </>
            )}
          </Button>
        </div>

        {scoutMessage && (
          <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            scoutMessage.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:text-green-300"
              : scoutMessage.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-800"
          }`}>
            <p className="font-medium">{scoutMessage.text}</p>
            {scoutMessage.detail && <p className="text-xs mt-1 opacity-80">{scoutMessage.detail}</p>}
          </div>
        )}
      </Card>

      <OpenWinsPanel />

      <div className="flex flex-col md:flex-row gap-3 mb-4 items-start md:items-center">
        <div className="relative w-full md:max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Filter shortlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-search-input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <select
            value={filterEcosystem}
            onChange={(e) => setFilterEcosystem(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded text-sm px-2 py-1.5 font-medium bg-white dark:bg-gray-800"
          >
            {ECOSYSTEM_FILTER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded text-sm px-2 py-1.5 font-medium bg-white dark:bg-gray-800"
          >
            {BACKER_SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredProjects.length} of {totalMatches} match{totalMatches !== 1 ? "es" : ""}
            {filterEcosystem !== "all" ? ` in ${filterEcosystem}` : ""}
            {showingShortlist ? ` (top ${BACKER_SHORTLIST_LIMIT})` : ""}
          </p>
          <Link
            href={exploreLink}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mt-1"
          >
            Browse all projects on Explore
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
        <PrivacyBadge />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-1">No projects match your filters.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
            {projects.length === 0
              ? "Projects need a description, GitHub link, and ecosystem to appear here."
              : "Try broadening your filters or browse the full catalog."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                Clear filters
              </button>
            )}
            <Link href={exploreLink} className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
              Open Explore →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onBack={handleBackProject}
              scoutScore={getScoutScore(project.id || project.slug)}
            />
          ))}
        </div>
      )}

      {showingShortlist && filteredProjects.length > 0 && (
        <div className="mt-8 text-center">
          <Link href={exploreLink}>
            <Button variant="outline" className="inline-flex items-center gap-2">
              View all {totalMatches} projects on Explore
              <ArrowRightIcon className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}

      {backingProject && (
        <LoanTermsModal
          opportunity={backingProject}
          wallet={wallet}
          onClose={() => setBackingProject(null)}
          onSuccess={refresh}
        />
      )}
    </>
  );
}
