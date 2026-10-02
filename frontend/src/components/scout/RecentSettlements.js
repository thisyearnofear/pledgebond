/**
 * RecentSettlements — list of recent on-chain Arc settlements.
 * Each row links to the Arc explorer for the tx hash.
 */
import { Card } from "@/components/common/Card";
import { ARC_EXPLORER } from "@/config/tokens";
import { BanknotesIcon, TrophyIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

export default function RecentSettlements({ executions }) {
  if (!executions.length) return null;

  return (
    <section>
      <h2 className="text-sm font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <BanknotesIcon className="w-4 h-4 text-emerald-400" />
        Recent On-chain Settlements
      </h2>
      <div className="space-y-2">
        {executions.map((exec) => (
          <Card key={exec.id} className="bg-slate-900 border-slate-800 p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-900/30 rounded-lg flex items-center justify-center">
                <TrophyIcon className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200">
                  {exec.backed} backing{exec.backed !== 1 ? "s" : ""} · ${exec.staked.toFixed(2)} USDC
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {exec.timestamp ? new Date(exec.timestamp).toLocaleString() : ""}
                </div>
              </div>
            </div>
            {exec.txHashes?.[0] && (
              <a
                href={`${ARC_EXPLORER}/tx/${exec.txHashes[0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-cyan-400 dark:text-cyan-500 hover:underline flex items-center gap-1"
              >
                View <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </a>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
