/**
 * LeaderboardRankBadge — Shows where a project or builder ranks across leaderboards
 *
 * Displays rank number, movement indicator (up/down/new/stable), and category label.
 * Fetches leaderboard data on mount and caches for reuse across the page.
 *
 * Props:
 *   type: 'project' | 'proof-builder' | 'builder' | 'backer'
 *   identifier: slug for projects, uid/address for builders/backers
 *   ecosystem: optional ecosystem for link and display
 *   variant: 'card' | 'inline' (default: 'inline')
 *   showLink: whether to link to the leaderboard page (default: false)
 */

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { TrophyIcon } from "@heroicons/react/24/outline";

const CATEGORIES = {
  project: {
    dataKey: "projects",
    label: "Proven Projects",
    identifierKey: "slug",
    source: "hackathons",
    href: "/leaderboard",
    rankLabel: "Proven Projects",
  },
  "proof-builder": {
    dataKey: "builders",
    label: "Proof Builders",
    identifierKey: "id",
    source: "hackathons",
    href: "/leaderboard",
    rankLabel: "Proof Builders",
  },
  builder: {
    dataKey: "builders",
    label: "Top Builders",
    identifierKey: "address",
    source: "torque",
    href: "/leaderboard",
    rankLabel: "Top Builders",
  },
  backer: {
    dataKey: "backers",
    label: "Top Lenders",
    identifierKey: "address",
    source: "torque",
    href: "/leaderboard",
    rankLabel: "Top Lenders",
  },
};

/* ── Lightweight in-memory cache so multiple badges share fetches ── */
const cache = new Map();      // url → { data, ts }
const inflight = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cachedFetch(url) {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
    return Promise.resolve(entry.data);
  }
  if (inflight.has(url)) return inflight.get(url);
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not OK"))))
    .then((data) => {
      cache.set(url, { data, ts: Date.now() });
      inflight.delete(url);
      return data;
    })
    .catch((err) => {
      inflight.delete(url);
      throw err;
    });
  inflight.set(url, p);
  return p;
}

export default function LeaderboardRankBadge({
  type,
  identifier,
  ecosystem,
  showLink = false,
}) {
  const [entry, setEntry] = useState(null);
  const [rank, setRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const config = CATEGORIES[type];

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    if (!identifier) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const url =
      config.source === "torque"
        ? "/api/torque/leaderboard?limit=200"
        : "/api/hackathons/leaderboard";

    async function fetchRank() {
      try {
        const data = await cachedFetch(url);
        if (cancelled || !mountedRef.current) return;

        const list = data[config.dataKey] || [];
        const idx = list.findIndex(
          (e) => e[config.identifierKey] === identifier
        );
        if (idx >= 0) {
          setRank(idx + 1);
          setEntry(list[idx]);
        }
      } catch (e) {
        if (!cancelled) console.warn(`Leaderboard rank fetch (${type}):`, e.message);
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    }

    fetchRank();
    return () => {
      cancelled = true;
    };
  }, [identifier, type, config]);

  if (!config) return null;

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="animate-pulse flex items-center gap-2 py-2">
        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-8 bg-gray-100 dark:bg-gray-600 rounded" />
      </div>
    );
  }

  if (!rank || !entry) return null;

  const movement = entry.movement;

  return (
    <div className="group">
      <div className="flex items-center gap-2 text-sm">
        {/* Rank badge */}
        <span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs px-1.5 tabular-nums">
          #{rank}
        </span>

        {/* Category label */}
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          in
        </span>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
          {config.rankLabel}
        </span>

        {/* Movement */}
        {movement === "up" && (
          <span
            className="inline-flex items-center text-emerald-600 dark:text-emerald-400"
            title="Moved up"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 15l7-7 7 7"
              />
            </svg>
          </span>
        )}
        {movement === "down" && (
          <span
            className="inline-flex items-center text-red-500 dark:text-red-400"
            title="Moved down"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        )}
        {movement === "new" && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            New
          </span>
        )}
        {!movement && (
          <span className="inline-flex items-center" title="Stable">
            <svg
              className="w-2 h-2 text-gray-300 dark:text-gray-600"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="12" r="4" />
            </svg>
          </span>
        )}
      </div>

      {/* Subtle link to leaderboard */}
      {showLink && (
        <Link
          href={config.href}
          className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-500 transition-colors"
        >
          <TrophyIcon className="w-3 h-3" />
          View leaderboard
        </Link>
      )}
    </div>
  );
}
