/**
 * ActivityFeed — list of the most recent agent runs with type-coded dots
 * and human-readable summary lines.
 */
import { Card } from "@/components/common/Card";
import { ChartBarIcon } from "@heroicons/react/24/outline";

const DOT = {
  execution: "bg-emerald-500",
  scout: "bg-purple-500",
  underwrite: "bg-blue-500",
};

function describe(run) {
  switch (run.type) {
    case "execution":  return `Legacy pre-rail Executor run — ${run.totalBacked || 0} backings`;
    case "scout":      return `Evaluated ${run.projectsEvaluated || 0} projects, flagged ${run.projectsFlagged ?? run.projectsBacked ?? 0} bridge-loan candidates`;
    case "underwrite": return `Analyzed ${run.project?.name || "project"}`;
    default:           return "Agent run";
  }
}

function Row({ run }) {
  return (
    <Card className="bg-slate-900 border-slate-800 p-3 flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full shrink-0 ${DOT[run.type] || "bg-slate-500"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-300 dark:text-slate-500 truncate">{describe(run)}</div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          {run.timestamp ? new Date(run.timestamp).toLocaleString() : ""}
        </div>
      </div>
      <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 hidden sm:inline">{run.id}</span>
    </Card>
  );
}

export default function ActivityFeed({ runs }) {
  return (
    <section>
      <h2 className="text-sm font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-4 h-4 text-cyan-400 dark:text-cyan-500" />
        Agent Activity Feed
      </h2>
      <div className="space-y-2">
        {runs.slice(0, 10).map((run) => (
          <Row key={run.id} run={run} />
        ))}
      </div>
    </section>
  );
}
