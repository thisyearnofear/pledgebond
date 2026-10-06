/**
 * useScoutRuns — subscribes to the agent_runs Firestore collection and
 * memoizes derived views: portfolio stats, reasoning traces, recent executions.
 *
 * Single subscription, derived selectors. Returns loading + the four
 * data shapes the /scout page consumes.
 */
import { useEffect, useState, useMemo } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";

const RUNS_LIMIT = 50;
const TRACE_LIMIT = 10;

function computePortfolioStats(runs) {
  const scouts = runs.filter((r) => r.type === "scout");

  const totalEvaluated = scouts.reduce((s, r) => s + (r.projectsEvaluated || 0), 0);
  const totalFlagged = scouts.reduce((s, r) => s + (r.projectsFlagged ?? r.projectsBacked ?? 0), 0);
  const priorityA = scouts.reduce(
    (s, r) => s + ((r.results || []).filter((x) => x.priority === "A").length),
    0
  );

  return { totalEvaluated, totalFlagged, priorityA, runCount: runs.length };
}

function buildReasoningTraces(runs) {
  const traces = [];
  for (const run of runs) {
    if (run.reasoningTrace && Array.isArray(run.reasoningTrace)) {
      for (const t of run.reasoningTrace) {
        traces.push({
          runId: run.id,
          timestamp: run.timestamp,
          project: t.project,
          trace: t.trace,
        });
      }
    } else if (run.reasoningTrace) {
      traces.push({
        runId: run.id,
        timestamp: run.timestamp,
        project: "Scout Analysis",
        trace: typeof run.reasoningTrace === "string"
          ? run.reasoningTrace
          : JSON.stringify(run.reasoningTrace, null, 2),
      });
    }
  }
  return traces.slice(0, TRACE_LIMIT);
}

export default function useScoutRuns() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "agent_runs"),
      orderBy("timestamp", "desc"),
      limit(RUNS_LIMIT)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRuns(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.warn("Agent runs feed unavailable:", error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => computePortfolioStats(runs), [runs]);
  const reasoningTraces = useMemo(() => buildReasoningTraces(runs), [runs]);

  return { runs, loading, stats, reasoningTraces };
}
