/**
 * ProvenProjectsList — Row list for the "Proven Projects" tab.
 *
 * Mirrors the ProofBuildersList layout but the trailing column links to
 * the project detail page when an entry has a slug.
 */

import Link from "next/link";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { computeLeaderboardBadges } from "@/lib/badges/computeBadges";
import { ProofBadgeGroup } from "@/components/common/ProofBadge";
import MovementIndicator from "./MovementIndicator";
import ShareButton from "./ShareButton";

export default function ProvenProjectsList({ entries }) {
  return (
    <div className="space-y-3">
      {entries.map((entry, idx) => {
        const entryBadges = computeLeaderboardBadges(entry, "project");
        const rank = idx + 1;
        return (
          <div key={entry.slug || idx} className="flex items-center gap-4 p-4 rounded-xl border bg-surface-primary border-border-primary hover:shadow-md transition-all">
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
                <span className="font-semibold text-text-primary truncate">{entry.name}</span>
                {entry.ecosystem ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-gray-600 dark:text-gray-400 uppercase">{entry.ecosystem}</span>
                ) : null}
              </div>
              <p className="text-xs text-text-tertiary mt-0.5">
                {entry.verifiedWins || 0} verified win{entry.verifiedWins === 1 ? "" : "s"} · {entry.evidenceBackedClaims || 0}/{entry.totalClaims || 0} evidence-backed claims
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
              <div className="flex items-center justify-end gap-2">
                <div>
                  <div className="font-bold text-amber-600 dark:text-amber-400">{entry.score || 0}</div>
                  <div className="text-xs text-text-tertiary">credibility</div>
                </div>
                {entry.slug ? (
                  <Link href={`/projects/${entry.ecosystem}/${entry.slug}`} className="text-text-tertiary hover:text-text-secondary">
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </Link>
                ) : null}
              </div>
            </div>
            <ShareButton
              entryType="project"
              entry={entry}
              rank={rank}
            />
          </div>
        );
      })}
    </div>
  );
}
