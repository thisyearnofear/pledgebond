/**
 * Scout Reasoning Trace Page
 *
 * Displays the full reasoning trace for a specific scout agent run.
 * Shareable URL: /scout/trace/{runId}
 *
 * Shows:
 * - Agent identity and run metadata
 * - Reasoning traces for each recommended project
 * - Ecosystem summary
 * - On-chain execution results (if any)
 * - Share to X with OG image
 */

import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { agentsHref } from "@/config/navigation";
import { db } from "@/lib/firebase/clientApp";
import { doc, getDoc } from "firebase/firestore";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import { ARC_EXPLORER } from "@/config/tokens";
import { trackEvent } from "@/lib/analytics";
import {
  CpuChipIcon,
  LightBulbIcon,
  ArrowLeftIcon,
  ShareIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  CheckCircleIcon,
  BanknotesIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

function formatTraceItem(item, idx) {
  return (
    <Card key={idx} className="bg-slate-900 border-slate-800 p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-900/50 text-purple-400">
          {item.project || `Project ${idx + 1}`}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reasoning Trace</span>
      </div>
      <p className="text-sm text-slate-300 dark:text-slate-500 leading-relaxed whitespace-pre-wrap">
        {item.trace}
      </p>
    </Card>
  );
}

export default function ScoutTracePage() {
  const router = useRouter();
  const { runId } = router.query;
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!runId) return;

    async function fetchRun() {
      try {
        const docRef = doc(db, "agent_runs", runId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setRun({ id: snapshot.id, ...snapshot.data() });
        } else {
          setError("Run not found");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRun();
  }, [runId]);

  const handleShare = () => {
    trackEvent("scout_trace_shared", { runId });
    const text = `Check out the Proof Scout's reasoning trace for this project evaluation:`;
    const url = typeof window !== "undefined" ? window.location.href : "";
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 dark:text-slate-500 mb-4">{error || "Run not found"}</p>
          <Link href={agentsHref("scout")}>
            <Button variant="outline" className="text-xs">
              <ArrowLeftIcon className="w-3.5 h-3.5 mr-1" />
              Back to Scout Portfolio
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const traces = Array.isArray(run.reasoningTrace)
    ? run.reasoningTrace
    : run.reasoningTrace
      ? [{ project: "Analysis", trace: typeof run.reasoningTrace === "string" ? run.reasoningTrace : JSON.stringify(run.reasoningTrace, null, 2) }]
      : [];

  const hasExecution = run.type === "execution" || run.executed;

  return (
    <>
      <Head>
        <title>Scout Trace — {runId}</title>
        <meta name="description" content={`Proof Scout reasoning trace for run ${runId}. Transparent AI project evaluation on-chain.`} />
        <meta property="og:title" content={`Proof Scout Trace — ${runId}`} />
        <meta property="og:description" content="Transparent AI reasoning trace for blockchain project evaluation." />
        <meta property="og:image" content={`https://pledgebond.com/api/og/trace?runId=${encodeURIComponent(runId)}&project=${encodeURIComponent(traces[0]?.project || 'Unknown')}&score=${encodeURIComponent(run.healthScore || run.projectsBacked || '?')}&trace=${encodeURIComponent((traces[0]?.trace || '').slice(0, 200))}`} />
        <meta property="twitter:card" content="summary_large_image" />
      </Head>

      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-b from-indigo-900/20 to-slate-950 border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-4">
              <Link href={agentsHref("scout")}>
                <Button variant="outline" className="text-xs">
                  <ArrowLeftIcon className="w-3.5 h-3.5 mr-1" />
                  Back to Portfolio
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Button onClick={handleShare} variant="outline" className="text-xs">
                  <ShareIcon className="w-3.5 h-3.5 mr-1" />
                  Share
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="relative">
                <CpuChipIcon className="w-10 h-10 text-cyan-400 dark:text-cyan-500" />
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-cyan-400 dark:text-cyan-500 mb-1">
                  Proof Scout — Reasoning Trace
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">{runId}</h1>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {run.timestamp ? new Date(run.timestamp).toLocaleString() : "Unknown"}
                  </span>
                  <span className="flex items-center gap-1">
                    <GlobeAltIcon className="w-3 h-3" />
                    {run.resultSource || "rule_based"}
                  </span>
                  {run.totalStakeRecommended > 0 && (
                    <span className="flex items-center gap-1 text-cyan-400 dark:text-cyan-500">
                      <BanknotesIcon className="w-3 h-3" />
                      {run.totalStakeRecommended.toFixed(2)} USDC
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {/* Run Summary */}
          <section>
            <h2 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
              Run Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-slate-900 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</div>
                <div className="text-sm font-bold text-white">{run.type || "scout"}</div>
              </Card>
              <Card className="bg-slate-900 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Evaluated</div>
                <div className="text-sm font-bold text-white">{run.projectsEvaluated || 0}</div>
              </Card>
              <Card className="bg-slate-900 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Backed</div>
                <div className="text-sm font-bold text-emerald-400">{run.projectsBacked || 0}</div>
              </Card>
              <Card className="bg-slate-900 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Executed</div>
                <div className="text-sm font-bold text-white">{run.executed ? "Yes" : "No"}</div>
              </Card>
            </div>
          </section>

          {/* Reasoning Traces */}
          {traces.length > 0 && (
            <section>
              <h2 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <LightBulbIcon className="w-4 h-4 text-amber-400" />
                Reasoning Traces
              </h2>
              {traces.map((t, idx) => formatTraceItem(t, idx))}
            </section>
          )}

          {/* Ecosystem Analysis */}
          {run.ecosystemAnalysis && (
            <section>
              <h2 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <GlobeAltIcon className="w-4 h-4 text-blue-400" />
                Ecosystem Analysis
              </h2>
              <Card className="bg-slate-900 border-slate-800 p-5">
                <p className="text-sm text-slate-300 dark:text-slate-500 leading-relaxed whitespace-pre-wrap">
                  {run.ecosystemAnalysis}
                </p>
              </Card>
            </section>
          )}

          {/* Execution Results */}
          {hasExecution && run.results && (
            <section>
              <h2 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BanknotesIcon className="w-4 h-4 text-emerald-400" />
                On-Chain Execution
              </h2>
              <div className="space-y-2">
                {run.results.map((r, idx) => (
                  <Card key={idx} className="bg-slate-900 border-slate-800 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-200">{r.name || r.projectId || r.id || "Unknown"}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {r.amount && `${r.amount} USDC`} {r.multiplier && `· ${r.multiplier}x`}
                      </div>
                    </div>
                    {r.txHash && (
                      <a
                        href={`${ARC_EXPLORER}/tx/${r.txHash}`}
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
          )}

          {/* Raw Data (collapsible, for judges) */}
          <section>
            <details className="group">
              <summary className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-300 dark:text-slate-500 transition-colors flex items-center gap-2">
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-mono">RAW</span>
                Full Run Data
              </summary>
              <Card className="bg-slate-900 border-slate-800 p-4 mt-3 overflow-x-auto">
                <pre className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  {JSON.stringify(run, null, 2)}
                </pre>
              </Card>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
