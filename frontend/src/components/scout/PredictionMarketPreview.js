/**
 * PredictionMarketPreview — preview card showing how the Payout Verifier
 * agent could serve as a prediction-market oracle. Renders 2 sample
 * markets from the latest reasoning traces, with placeholder 72/28 split.
 */
import { Card } from "@/components/common/Card";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

function MarketRow({ trace }) {
  return (
    <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-200 truncate">
          Will {trace.project} ship by June 1?
        </div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400">
          Resolved by Verifier agent on-chain
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-[10px] text-emerald-400">Yes 72%</div>
          <div className="text-[10px] text-rose-400">No 28%</div>
        </div>
        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: "72%" }} />
        </div>
      </div>
    </div>
  );
}

export default function PredictionMarketPreview({ traces }) {
  return (
    <section>
      <h2 className="text-sm font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <GlobeAltIcon className="w-4 h-4 text-pink-400 dark:text-pink-500" />
        Prediction Market Preview
      </h2>
      <Card className="bg-gradient-to-br from-pink-900/20 to-slate-900 border-pink-500/20 p-5">
        <p className="text-sm text-slate-300 dark:text-slate-500 mb-4">
          The Payout Verifier agent can serve as an oracle for prediction markets. When the verifier attests a project shipped, the market resolves automatically.
        </p>
        <div className="space-y-3">
          {traces.slice(0, 2).map((t, idx) => (
            <MarketRow key={idx} trace={t} />
          ))}
          {traces.length === 0 && (
            <div className="text-sm text-slate-400 dark:text-slate-500 italic">
              Run the Scout to generate prediction markets for top projects.
            </div>
          )}
        </div>
        <div className="mt-3 text-[10px] text-pink-300/80 text-center">
          Coming soon — USDC markets with verifier oracle resolution
        </div>
      </Card>
    </section>
  );
}
