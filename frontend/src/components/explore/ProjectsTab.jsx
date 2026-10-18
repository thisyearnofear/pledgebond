/**
 * ProjectsTab — Projects view of the Explore page.
 *
 * Owns its own filter/sort/view/page state, syncs to URL, and renders
 * a TrendingSection + filter bar + grid/list of project cards.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { useEnhancedGithub } from "@/providers/Github/EnhancedGithubProvider";
import { useUser } from "@/stores/authStore";
import { useBookmarks } from "@/hooks/useBookmarks.js";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";
import { SkeletonProjectGrid, SkeletonBlock } from "@/components/common/LoadingStates";
import { ECOSYSTEM_CONFIGS } from "@/config/ecosystems";
import { getProjectQuality } from "@/lib/projects/projectQuality";
import { filterProjects, sortProjects, calculateProjectStats } from "@/utils/projectUtils";

import ActiveFilterChips from "./ActiveFilterChips";
import ExplorePagination from "./ExplorePagination";
import ExploreProjectCard from "./ExploreProjectCard";
import ExploreProjectListItem from "./ExploreProjectListItem";
import TrendingSection from "./TrendingSection";
import { CATEGORY_OPTIONS, SORT_OPTIONS, SORT_LABELS, ECOSYSTEM_OPTIONS, ITEMS_PER_PAGE } from "./constants";

function computeTrendingScore(project) {
  const daysSinceCommit = project.stats?.lastCommit
    ? Math.floor((Date.now() - new Date(project.stats.lastCommit).getTime()) / (1000 * 60 * 60 * 24))
    : 365;
  const activityScore = daysSinceCommit <= 7 ? 40 : daysSinceCommit <= 30 ? 30 : daysSinceCommit <= 90 ? 20 : 10;
  const healthScore = (project.stats?.healthScore || 0) * 0.3;
  const consistency = Math.min((project.stats?.commits || 0) / 5, 20);
  const crossChain = project.chains?.length > 1 ? 10 : 3;
  const quality = getProjectQuality(project).score * 0.05;
  return Math.round(activityScore + healthScore + consistency + crossChain + quality);
}

export default function ProjectsTab({ selectedEcosystems = [], onEcosystemsChange = () => {} }) {
  const { projectData, loading, errors } = useEnhancedGithub();
  const { currentUser } = useUser();
  const { bookmarks, isBookmarked, toggleBookmark, loaded: bookmarksLoaded } = useBookmarks();
  const resultsRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [minQualityScore, setMinQualityScore] = useState(0);
  const [fundingOnly, setFundingOnly] = useState(false);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [sortBy, setSortBy] = useState("trending");
  const [viewMode, setViewMode] = useState("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [showTrending, setShowTrending] = useState(true);

  const allProjects = useMemo(() => {
    if (!projectData) return [];
    const flat = [];
    Object.entries(projectData).forEach(([eco, list]) => {
      if (Array.isArray(list)) list.forEach((p) => flat.push({ ...p, ecosystem: p.ecosystem || eco }));
    });
    return flat;
  }, [projectData]);

  const trendingProjects = useMemo(() => {
    return allProjects
      .filter((p) => p.stats?.isActive || (p.stats?.healthScore || 0) >= 40)
      .map((p) => ({ ...p, trendingScore: computeTrendingScore(p) }))
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 3);
  }, [allProjects]);

  const handleFilterToggle = useCallback((setter, value) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    setPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    onEcosystemsChange([]);
    setSelectedCategories([]);
    setMinQualityScore(0);
    setFundingOnly(false);
    setBookmarksOnly(false);
    setSortBy("trending");
    setPage(1);
  }, [onEcosystemsChange]);

  const hasActiveFilters =
    searchQuery || selectedEcosystems.length > 0 || selectedCategories.length > 0 ||
    minQualityScore > 0 || fundingOnly || bookmarksOnly;

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (searchQuery) chips.push({ key: "search", label: `"${searchQuery}"` });
    selectedEcosystems.forEach((e) => {
      const cfg = ECOSYSTEM_CONFIGS[e];
      chips.push({ key: `eco-${e}`, label: cfg ? `${cfg.icon} ${cfg.shortName}` : e });
    });
    selectedCategories.forEach((c) => {
      const cat = CATEGORY_OPTIONS.find((o) => o.id === c);
      chips.push({ key: `cat-${c}`, label: cat ? cat.label : c });
    });
    if (minQualityScore > 0) chips.push({ key: "quality", label: `≥${minQualityScore}% quality` });
    if (fundingOnly) chips.push({ key: "funding", label: "Seeking funding" });
    if (bookmarksOnly) chips.push({ key: "bookmarks", label: "Bookmarked" });
    return chips;
  }, [searchQuery, selectedEcosystems, selectedCategories, minQualityScore, fundingOnly, bookmarksOnly]);

  const removeFilterChip = useCallback((key) => {
    if (key === "search") setSearchQuery("");
    else if (key.startsWith("eco-")) onEcosystemsChange(selectedEcosystems.filter((e) => `eco-${e}` !== key));
    else if (key.startsWith("cat-")) setSelectedCategories((prev) => prev.filter((c) => `cat-${c}` !== key));
    else if (key === "quality") setMinQualityScore(0);
    else if (key === "funding") setFundingOnly(false);
    else if (key === "bookmarks") setBookmarksOnly(false);
    setPage(1);
  }, [onEcosystemsChange, selectedEcosystems]);

  const processedProjects = useMemo(() => {
    let list = [...allProjects];
    if (bookmarksOnly && bookmarksLoaded) list = list.filter((p) => isBookmarked(p.slug));
    if (selectedEcosystems.length > 0) list = list.filter((p) => selectedEcosystems.includes(p.ecosystem));
    if (selectedCategories.length > 0) list = list.filter((p) => selectedCategories.includes(p.category));
    if (minQualityScore > 0) list = list.filter((p) => getProjectQuality(p).score >= minQualityScore);
    if (fundingOnly) list = list.filter((p) => p.lookingForFunding);
    if (searchQuery) list = filterProjects(list, { search: searchQuery.toLowerCase() });
    if (sortBy === "trending") {
      list = list
        .map((p) => {
          const quality = getProjectQuality(p);
          const daysSince = p.stats?.lastCommit
            ? (Date.now() - new Date(p.stats.lastCommit).getTime()) / (1000 * 60 * 60 * 24)
            : 365;
          const recencyScore = daysSince <= 7 ? 40 : daysSince <= 30 ? 30 : daysSince <= 90 ? 20 : daysSince <= 180 ? 10 : 0;
          return { ...p, _sortScore: recencyScore + quality.score * 0.3 + Math.min((p.stats?.stars || 0) * 0.5 + (p.stats?.forks || 0) * 0.3, 20) };
        })
        .sort((a, b) => b._sortScore - a._sortScore);
    } else {
      list = sortProjects(list, sortBy, sortBy === "name" ? "asc" : "desc");
    }
    return list;
  }, [allProjects, selectedEcosystems, selectedCategories, minQualityScore, fundingOnly, bookmarksOnly, bookmarksLoaded, isBookmarked, sortBy, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(processedProjects.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedProjects = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedProjects.slice(start, start + ITEMS_PER_PAGE);
  }, [processedProjects, currentPage]);
  const stats = useMemo(() => calculateProjectStats(processedProjects), [processedProjects]);

  if (Object.keys(errors).length > 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">Failed to load projects. Please refresh.</p>
      </Card>
    );
  }
  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-12 w-full rounded-xl" />
        <SkeletonBlock className="h-32 w-full rounded-xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="h-8 w-20 rounded-full" />)}
        </div>
        <SkeletonBlock className="h-6 w-48 rounded" />
        <SkeletonProjectGrid count={6} />
      </div>
    );
  }

  return (
    <>
      {showTrending && trendingProjects.length > 0 && !hasActiveFilters && (
        <TrendingSection
          projects={trendingProjects}
          onDismiss={() => setShowTrending(false)}
          onProjectClick={(p) => { window.location.href = `/projects/${p.ecosystem || "base"}/${p.slug}`; }}
          isBookmarked={isBookmarked}
          onToggleBookmark={toggleBookmark}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            data-search-input
            placeholder="Search projects by name, description, or owner..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-secondary bg-surface text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-gray-100"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400">
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-secondary rounded-xl text-sm bg-surface dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{SORT_LABELS[opt.id] || opt.label}</option>
            ))}
          </select>

          <div className="flex rounded-xl border border-secondary overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-surface text-gray-500 hover:text-gray-700 dark:text-gray-300"}`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2.5 ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-surface text-gray-500 hover:text-gray-700 dark:text-gray-300"}`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border transition-colors ${
              showFilters || hasActiveFilters
                ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
                : "border-secondary text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
            title="Filters"
          >
            <FunnelIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ActiveFilterChips filters={activeFilterChips} onRemove={removeFilterChip} onClearAll={clearAllFilters} />

      {showFilters && (
        <Card className="p-5 mb-4 border-2 border-blue-100 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="w-4 h-4" /> Filters
            </h3>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 font-medium">Clear all</button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Ecosystem</label>
              <div className="flex flex-wrap gap-1.5">
                {ECOSYSTEM_OPTIONS.map((eco) => (
                  <button
                    key={eco.id}
                    onClick={() => {
                      onEcosystemsChange(
                        selectedEcosystems.includes(eco.id)
                          ? selectedEcosystems.filter((id) => id !== eco.id)
                          : [...selectedEcosystems, eco.id],
                      );
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedEcosystems.includes(eco.id)
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-surface text-gray-600 dark:text-gray-300 border border-default hover:border-blue-300"
                    }`}
                  >
                    {eco.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleFilterToggle(setSelectedCategories, cat.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCategories.includes(cat.id)
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-surface text-gray-600 dark:text-gray-300 border border-default hover:border-purple-300"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Min quality score: {minQualityScore}%
              </label>
              <input
                type="range" min="0" max="100" step="5"
                value={minQualityScore}
                onChange={(e) => { setMinQualityScore(Number(e.target.value)); setPage(1); }}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1"><span>Any</span><span>100</span></div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={fundingOnly} onChange={(e) => { setFundingOnly(e.target.checked); setPage(1); }} className="rounded border-gray-300 text-blue-600 dark:text-blue-400 focus:ring-blue-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Seeking funding</span>
              </label>
              {bookmarksLoaded && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={bookmarksOnly} onChange={(e) => { setBookmarksOnly(e.target.checked); setPage(1); }} className="rounded border-gray-300 text-amber-500 dark:text-amber-400 focus:ring-amber-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Bookmarked only</span>
                </label>
              )}
            </div>
          </div>
        </Card>
      )}

      <div ref={resultsRef} className="flex items-center justify-between mb-4">
        <p className="text-sm text-secondary">
          {hasActiveFilters || searchQuery ? (
            <>
              <span className="font-medium text-primary">{processedProjects.length}</span> result
              {processedProjects.length !== 1 ? "s" : ""}
              {searchQuery && <> for &ldquo;{searchQuery}&rdquo;</>}
            </>
          ) : (
            <>
              <span className="font-medium text-primary">{stats.total}</span> projects across{" "}
              <span className="font-medium text-primary">{stats.ecosystems}</span> ecosystems
            </>
          )}
        </p>
        {bookmarksLoaded && bookmarks.length > 0 && !bookmarksOnly && (
          <button onClick={() => { setBookmarksOnly(true); setPage(1); }} className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 font-medium flex items-center gap-1">
            <BookmarkSolid className="w-3.5 h-3.5" /> {bookmarks.length} bookmarked
          </button>
        )}
      </div>

      {pagedProjects.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hover flex items-center justify-center">
            <MagnifyingGlassIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">No projects found</h3>
          <p className="text-sm text-secondary max-w-md mx-auto mb-6">
            {hasActiveFilters ? "Try adjusting your filters or search query." : "Be the first to submit a project!"}
          </p>
          {hasActiveFilters && <Button variant="outline" onClick={clearAllFilters}>Clear all filters</Button>}
          {!currentUser && <Link href="/login"><Button className="ml-2">Sign in to submit</Button></Link>}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedProjects.map((project) => (
            <ExploreProjectCard
              key={project.slug}
              project={project}
              isBookmarked={isBookmarked(project.slug)}
              onToggleBookmark={() => toggleBookmark(project.slug)}
              onClick={() => { window.location.href = `/projects/${project.ecosystem || "base"}/${project.slug}`; }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {pagedProjects.map((project) => (
            <ExploreProjectListItem
              key={project.slug}
              project={project}
              isBookmarked={isBookmarked(project.slug)}
              onToggleBookmark={() => toggleBookmark(project.slug)}
              onClick={() => { window.location.href = `/projects/${project.ecosystem || "base"}/${project.slug}`; }}
            />
          ))}
        </div>
      )}

      <ExplorePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} resultsRef={resultsRef} />
    </>
  );
}
