/**
 * useProjectFilters — shared search/filter/sort state for backer project lists.
 */

import { useMemo, useState, useCallback } from "react";
import {
  filterBackerProjects,
  sortBackerProjects,
  prioritizeScoutProjects,
} from "@/utils/projectUtils";
import { debounce } from "@/utils/common";

/**
 * @param {object[]} projects
 * @param {{ limit?: number | null, scoutProjects?: object[] }} [options]
 */
export default function useProjectFilters(projects, options = {}) {
  const { limit = null, scoutProjects } = options;

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEcosystem, setFilterEcosystem] = useState("all");
  const [sortBy, setSortBy] = useState("health");

  // Debounce keystrokes → filtering runs ~4x/sec max instead of per-keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pushSearch = useCallback(
    debounce((v) => setSearchQuery(v), 220),
    []
  );

  const setSearch = useCallback(
    (v) => {
      setSearchInput(v);
      pushSearch(v);
    },
    [pushSearch]
  );

  const sortedMatches = useMemo(() => {
    const filtered = filterBackerProjects(projects, {
      search: searchQuery,
      ecosystem: filterEcosystem,
    });
    const sorted = sortBackerProjects(filtered, sortBy);
    return prioritizeScoutProjects(sorted, scoutProjects);
  }, [projects, searchQuery, filterEcosystem, sortBy, scoutProjects]);

  const totalMatches = sortedMatches.length;

  const filteredProjects = useMemo(() => {
    if (limit == null || limit <= 0) return sortedMatches;
    return sortedMatches.slice(0, limit);
  }, [sortedMatches, limit]);

  const hasActiveFilters = searchQuery.trim().length > 0
    || filterEcosystem !== "all";

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setFilterEcosystem("all");
  }, []);

  return {
    filteredProjects,
    totalMatches,
    searchQuery: searchInput,
    setSearchQuery: setSearch,
    filterEcosystem,
    setFilterEcosystem,
    sortBy,
    setSortBy,
    hasActiveFilters,
    clearFilters,
  };
}
