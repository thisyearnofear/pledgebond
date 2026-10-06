/**
 * PortfolioStats — 4-card stat grid for the scout panel.
 *
 * Pure presentational; expects a stats object with: totalEvaluated,
 * totalFlagged, priorityA, runCount.
 */
import { Card } from "@/components/common/Card";

const TONES = {
  evaluated: { value: "text-white" },
  flagged:   { value: "text-emerald-400" },
  priorityA: { value: "text-cyan-400 dark:text-cyan-500" },
  runs:      { value: "text-amber-400" },
};

export default function PortfolioStats({ stats }) {
  const cards = [
    { label: "Projects Evaluated",      value: stats.totalEvaluated,        tone: TONES.evaluated },
    { label: "Candidates Flagged",      value: stats.totalFlagged,          tone: TONES.flagged },
    { label: "Priority A Picks",        value: stats.priorityA,             tone: TONES.priorityA },
    { label: "Agent Runs Logged",       value: stats.runCount,              tone: TONES.runs },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="bg-slate-900 border-slate-800 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{c.label}</div>
          <div className={`text-2xl font-bold ${c.tone.value}`}>{c.value}</div>
        </Card>
      ))}
    </div>
  );
}
