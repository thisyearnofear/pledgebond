/**
 * HackathonLeaderboardList — Thin wrapper that maps entries to rows.
 *
 * Kept separate from HackathonLeaderboardRow to keep the import site
 * (the page) agnostic to how the list is rendered.
 */

import { useState, useMemo } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import HackathonLeaderboardRow from "./HackathonLeaderboardRow";
import HighlightedEntry from "./HighlightedEntry";
import PayoutLeadForm from "./PayoutLeadForm";

function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-4 p-4 rounded-lg border border-border-primary bg-surface-primary">
      <div className="w-8 h-8 rounded-full bg-surface-hover" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 rounded bg-surface-hover" />
        <div className="h-3 w-32 rounded bg-surface-hover" />
      </div>
      <div className="h-4 w-20 rounded bg-surface-hover" />
    </div>
  );
}

export default function HackathonLeaderboardList({ entries, highlightedEntry }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!entries || !searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.ecosystem && e.ecosystem.toLowerCase().includes(q)),
    );
  }, [entries, searchQuery]);

  if (!entries) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search hackathons by name or ecosystem..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-border-primary bg-surface-primary text-sm text-text-primary placeholder-text-tertiary focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {searchQuery && (
        <p className="text-sm text-text-tertiary">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {filtered.map((entry, idx) => (
        <HighlightedEntry key={`${entry.name}-${idx}`} highlighted={entry === highlightedEntry}>
          <HackathonLeaderboardRow entry={entry} rank={idx + 1} />
        </HighlightedEntry>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-text-tertiary">
          {searchQuery ? (
            <>No hackathons match &ldquo;{searchQuery}&rdquo;</>
          ) : (
            <>No hackathons found</>
          )}
        </div>
      )}

      <div className="pt-4">
        <PayoutLeadForm />
      </div>
    </div>
  );
}
