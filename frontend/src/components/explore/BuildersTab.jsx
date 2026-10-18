/**
 * BuildersTab — Builders view of the Explore page. Fetches from
 * /api/builders with search/ecosystem/sort query params, then renders a
 * paginated grid of builder cards.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/stores/authStore";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";
import { SkeletonBlock } from "@/components/common/LoadingStates";
import { MagnifyingGlassIcon, XMarkIcon, UsersIcon } from "@heroicons/react/24/outline";
import { ECOSYSTEM_CONFIGS } from "@/config/ecosystems";

import ActiveFilterChips from "./ActiveFilterChips";
import ExplorePagination from "./ExplorePagination";
import ExploreBuilderCard from "./ExploreBuilderCard";
import { BUILDER_SORT_OPTIONS, ITEMS_PER_PAGE } from "./constants";

export default function BuildersTab({ selectedEcosystems = [], onEcosystemsChange = () => {} }) {
  const { currentUser } = useUser();
  const resultsRef = useRef(null);
  const [builders, setBuilders] = useState([]);
  const [totalBuilders, setTotalBuilders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("projects");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function fetchBuilders() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.append("limit", "200");
        if (searchQuery) params.append("search", searchQuery);
        if (selectedEcosystems.length > 0) params.append("ecosystem", selectedEcosystems.join(","));
        if (sortBy) params.append("sort", sortBy);
        const res = await fetch(`/api/builders?${params}`);
        if (!res.ok) throw new Error("Failed to load builders");
        const data = await res.json();
        if (!cancelled) {
          setBuilders(data.builders || []);
          setTotalBuilders(data.total || 0);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBuilders();
    return () => { cancelled = true; };
  }, [searchQuery, selectedEcosystems, sortBy]);

  const totalPages = Math.max(1, Math.ceil(builders.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedBuilders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return builders.slice(start, start + ITEMS_PER_PAGE);
  }, [builders, currentPage]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (searchQuery) chips.push({ key: "search", label: `"${searchQuery}"` });
    selectedEcosystems.forEach((ecosystem) => {
      const cfg = ECOSYSTEM_CONFIGS[ecosystem];
      chips.push({ key: `ecosystem-${ecosystem}`, label: cfg ? `${cfg.icon} ${cfg.shortName}` : ecosystem });
    });
    return chips;
  }, [searchQuery, selectedEcosystems]);

  const removeFilterChip = useCallback((key) => {
    if (key === "search") setSearchQuery("");
    if (key.startsWith("ecosystem-")) {
      onEcosystemsChange(selectedEcosystems.filter((ecosystem) => `ecosystem-${ecosystem}` !== key));
    }
    setPage(1);
  }, [onEcosystemsChange, selectedEcosystems]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    onEcosystemsChange([]);
    setSortBy("projects");
    setPage(1);
  }, [onEcosystemsChange]);

  const hasActiveFilters = searchQuery || selectedEcosystems.length > 0;

  if (loading && builders.length === 0) {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-12 w-full rounded-xl" />
        <SkeletonBlock className="h-6 w-48 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }
  if (error) {
    return <Card className="p-8 text-center"><p className="text-red-600 dark:text-red-400">⚠️ {error}</p></Card>;
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search builders by name, bio, or GitHub handle..."
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
            {BUILDER_SORT_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      <ActiveFilterChips filters={activeFilterChips} onRemove={removeFilterChip} onClearAll={clearAllFilters} />

      <div ref={resultsRef} className="flex items-center justify-between mb-4">
        <p className="text-sm text-secondary">
          {hasActiveFilters ? (
            <>
              <span className="font-medium text-primary">{builders.length}</span> builder
              {builders.length !== 1 ? "s" : ""}
              {searchQuery && <> for &ldquo;{searchQuery}&rdquo;</>}
            </>
          ) : (
            <><span className="font-medium text-primary">{totalBuilders}</span> active builders</>
          )}
        </p>
      </div>

      {pagedBuilders.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hover flex items-center justify-center">
            <UsersIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">No builders found</h3>
          <p className="text-sm text-secondary max-w-md mx-auto mb-6">
            {hasActiveFilters ? "Try adjusting your search or filters." : "No builders have submitted projects yet."}
          </p>
          {hasActiveFilters && <Button variant="outline" onClick={clearAllFilters}>Clear all filters</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedBuilders.map((builder) => (
            <ExploreBuilderCard
              key={builder.uid}
              builder={builder}
              currentUserId={currentUser?.uid}
              onClick={() => { window.location.href = `/u/${builder.githubUsername}`; }}
            />
          ))}
        </div>
      )}

      <ExplorePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} resultsRef={resultsRef} />
    </>
  );
}
