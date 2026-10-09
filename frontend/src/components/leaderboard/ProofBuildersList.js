/**
 * ProofBuildersList — Specialized row list for the "Proof Builders" tab.
 *
 * Shows the proof score breakdown (avg proof / evidence coverage / proof
 * score) instead of the velocity/score columns used by the default
 * LeaderboardRow. Each row links to the builder's profile via the share
 * ref.
 */

import { computeLeaderboardBadges } from "@/lib/badges/computeBadges";
import { ProofBadgeGroup } from "@/components/common/ProofBadge";
import MovementIndicator from "./MovementIndicator";
import ShareButton from "./ShareButton";
import HighlightedEntry from "./HighlightedEntry";

export default function ProofBuildersList({ entries, highlightedEntry }) {
  return (
    <div className="space-y-3">
      {entries.map((entry, idx) => {
        const entryBadges = computeLeaderboardBadges(entry, "proof-builder");
        const rank = idx + 1;
        return (
          <HighlightedEntry key={entry.id || idx} highlighted={entry === highlightedEntry}>
          <div className="flex items-center gap-4 p-4 rounded-xl border bg-surface-primary border-border-primary hover:shadow-md transition-all">
            <div className="w-14 text-center flex-shrink-0">
              <div className="text-lg font-bold">
                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${rank}`}
              </div>
              <div className="-mt-1 flex justify-center">
                <MovementIndicator entry={entry} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary truncate">{entry.name || "Builder"}</span>
                {entry.ecosystem ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-gray-600 dark:text-gray-400 uppercase">{entry.ecosystem}</span>
                ) : null}
              </div>
              <p className="text-xs text-text-tertiary mt-0.5">
                {entry.proofBackedProjectCount || 0} proof-backed project{entry.proofBackedProjectCount === 1 ? "" : "s"} · {entry.verifiedWins || 0} verified win{entry.verifiedWins === 1 ? "" : "s"} · {entry.totalClaims || 0} claims
              </p>
              {entryBadges.length > 0 && (
                <ProofBadgeGroup badges={entryBadges} size="sm" max={2} className="mt-1" />
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-right text-sm min-w-[260px]">
              <div>
                <div className="font-bold text-text-primary">{entry.avgProofScore || 0}</div>
                <div className="text-xs text-text-tertiary">avg proof</div>
              </div>
              <div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400">{entry.evidenceCoverage || 0}%</div>
                <div className="text-xs text-text-tertiary">evidence</div>
              </div>
              <div>
                <div className="font-bold text-amber-600 dark:text-amber-400">{entry.score || 0}</div>
                <div className="text-xs text-text-tertiary">proof score</div>
              </div>
            </div>
            <ShareButton
              entryType="proof-builder"
              entry={entry}
              rank={rank}
            />
          </div>
          </HighlightedEntry>
        );
      })}
    </div>
  );
}
