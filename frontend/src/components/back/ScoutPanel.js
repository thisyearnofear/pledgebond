/**
 * ScoutPanel — autonomous scout portfolio (formerly /scout page body).
 */

import { useUser } from "@/stores/authStore";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import { trackEvent } from "@/lib/analytics";
import { agentsHref } from "@/config/navigation";
import useScoutRuns from "@/hooks/useScoutRuns";
import {
  ScoutHeader,
  PortfolioStats,
  ReasoningTraces,
  PredictionMarketPreview,
  ActivityFeed,
} from "@/components/scout";

const SHARE_TEXT = (stats) =>
  `Proof Scout has evaluated ${stats.totalEvaluated} projects and flagged ${stats.totalFlagged} bridge-loan candidates. Read the reasoning traces:`;

export default function ScoutPanel() {
  const { currentUser } = useUser();
  const { runs, loading, stats, reasoningTraces } = useScoutRuns();

  const handleShare = () => {
    trackEvent("scout_portfolio_shared", { user: currentUser?.uid || "anonymous" });
    const text = SHARE_TEXT(stats);
    const url = typeof window !== "undefined"
      ? `${window.location.origin}${agentsHref("scout")}`
      : "https://pledgebond.com/back?tab=agents&mode=scout";
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="rounded-xl overflow-hidden bg-slate-950 text-slate-100 border border-slate-800">
      <ScoutHeader onShare={handleShare} embedded />

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <PortfolioStats stats={stats} />
            <ReasoningTraces traces={reasoningTraces} />
            <PredictionMarketPreview traces={reasoningTraces} />
            <ActivityFeed runs={runs} />
          </>
        )}
      </div>
    </div>
  );
}
