/**
 * HackathonLeaderboardRow — Specialized row for the "Hackathons" tab.
 *
 * Highlights payout speed (with color-coded tier label) and shows the
 * trophy score. No explorer link (hackathons don't have addresses).
 */

import { useMemo } from "react";
import { TrophyIcon } from "@heroicons/react/24/outline";
import { computeLeaderboardBadges } from "@/lib/badges/computeBadges";
import { ProofBadgeGroup } from "@/components/common/ProofBadge";
import MovementIndicator from "./MovementIndicator";
import ShareButton from "./ShareButton";

const RANK_STYLES = {
  1: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700",
  2: "bg-gray-50 dark:bg-gray-800/30 border-secondary",
  3: "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700",
};

function payoutSpeedColor(days) {
  if (days === null || days === undefined) return "text-text-tertiary";
  if (days <= 7) return "text-emerald-600 dark:text-emerald-400";
  if (days <= 30) return "text-green-600 dark:text-green-400";
  if (days <= 90) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function payoutSpeedLabel(days) {
  if (days === null || days === undefined) return null;
  if (days <= 7) return "lightning fast";
  if (days <= 30) return "fast";
  if (days <= 90) return "moderate";
  return "slow";
}

export default function HackathonLeaderboardRow({ entry, rank }) {
  const entryBadges = useMemo(() => computeLeaderboardBadges(entry, "hackathon"), [entry]);
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
        RANK_STYLES[rank] || "bg-surface-primary border-border-primary"
      }`}
    >
      <div className="w-14 text-center flex-shrink-0">
        <div className="text-lg font-bold">{medal}</div>
        <div className="-mt-1 flex justify-center">
          <MovementIndicator entry={entry} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-primary truncate">{entry.name}</span>
          {entry.ecosystem && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-gray-600 dark:text-gray-400 uppercase">
              {entry.ecosystem}
            </span>
          )}
        </div>
        <p className="text-xs text-text-tertiary mt-0.5">
          {entry.totalProjects} project{entry.totalProjects !== 1 ? "s" : ""} · {entry.winners || 0} winner{(entry.winners || 0) !== 1 ? "s" : ""} · {entry.builderCount || 0} builder{(entry.builderCount || 0) !== 1 ? "s" : ""}
          {entry.totalPrizeAmount > 0 && ` · $${(entry.totalPrizeAmount / 1000).toFixed(0)}k prizes`}
        </p>
        {entryBadges.length > 0 && (
          <ProofBadgeGroup badges={entryBadges} size="sm" max={2} className="mt-1" />
        )}
      </div>

      <div className="flex items-center gap-6">
        {entry.avgPayoutDays !== null ? (
          <div className="text-right">
            <div className={`text-lg font-bold ${payoutSpeedColor(entry.avgPayoutDays)}`}>
              {entry.avgPayoutDays}
              <span className="text-sm ml-0.5">d</span>
            </div>
            <p className={`text-xs ${payoutSpeedColor(entry.avgPayoutDays)}`}>{payoutSpeedLabel(entry.avgPayoutDays)}</p>
          </div>
        ) : (
          <div className="text-right">
            <div className="text-lg font-bold text-text-tertiary">—</div>
            <p className="text-xs text-text-tertiary">payout speed</p>
          </div>
        )}

        <div className="text-right">
          <div className={`text-lg font-bold ${entry.payoutCompletionRate >= 80 ? "text-green-600 dark:text-green-400" : entry.payoutCompletionRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
            {entry.payoutCompletionRate}%
          </div>
          <p className="text-xs text-text-tertiary">paid</p>
        </div>
      </div>

      <div className="text-right min-w-[80px]">
        <div className="text-lg font-bold text-text-primary flex items-center gap-1 justify-end">
          <TrophyIcon className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
          {entry.score}
        </div>
        <p className="text-xs text-text-tertiary">reputation</p>
      </div>

      <ShareButton
        entryType="hackathon"
        entry={entry}
        rank={rank}
      />
    </div>
  );
}
