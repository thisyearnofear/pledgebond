/**
 * LeaderboardRow — Default row for builders/lenders (torque or firestore).
 *
 * Renders the rank medal, identity (name + SNS), stats line, score, share
 * button, and explorer link. Used by the `builders` and `lenders` tabs.
 */

import { useMemo } from "react";
import { FireIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { computeLeaderboardBadges } from "@/lib/badges/computeBadges";
import { ProofBadgeGroup } from "@/components/common/ProofBadge";
import MovementIndicator from "./MovementIndicator";
import ShareButton from "./ShareButton";
import { truncateAddress } from "./tabs";

const RANK_STYLES = {
  1: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700",
  2: "bg-gray-50 dark:bg-gray-800/30 border-secondary",
  3: "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700",
};

export default function LeaderboardRow({ entry, rank, type }) {
  const entryBadges = useMemo(
    () => computeLeaderboardBadges(entry, type === "builders" ? "builder" : "backer"),
    [entry, type],
  );
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
          <span className="font-semibold text-text-primary truncate">
            {entry.name || truncateAddress(entry.address)}
          </span>
          {entry.snsDomain && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              {entry.snsDomain}
            </span>
          )}
        </div>
        <p className="text-xs text-text-tertiary mt-0.5">
          {type === "builders"
            ? `${entry.projectCount || 0} projects · ${entry.milestoneCount || 0} milestones`
            : `$${Number(entry.totalBacked || 0).toLocaleString()} funded · ${entry.projectsBacked || 0} projects`}
        </p>
        {entryBadges.length > 0 && (
          <ProofBadgeGroup badges={entryBadges} size="sm" max={2} className="mt-1" />
        )}
      </div>

      <div className="text-right">
        <div className="text-lg font-bold text-text-primary flex items-center gap-1 justify-end">
          <FireIcon className="w-4 h-4 text-orange-500 dark:text-orange-400" />
          {entry.velocity || entry.score || 0}
        </div>
        <p className="text-xs text-text-tertiary">
          {type === "builders" ? "shipping velocity" : "funding velocity"}
        </p>
        {entry.source === "torque" && (
          <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
            Torque
          </span>
        )}
      </div>

      <ShareButton
        entryType={type === "builders" ? "builder" : "backer"}
        entry={entry}
        rank={rank}
      />

      {entry.address && (
        <a
          href={`https://explorer.solana.com/address/${entry.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-tertiary hover:text-text-secondary"
          title="View on Solana Explorer"
        >
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
