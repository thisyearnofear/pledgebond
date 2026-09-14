/**
 * GenLayer demo panel for the Back / Agents tab.
 *
 * Stakeholder design: a steward can verify the whole story in one click;
 * a builder sees what "good evidence" looks like via presets; a backer sees
 * the verdict → credit consequence inline. Narrated loading states replace
 * the dead spinner; live/preview provenance is always visible.
 */
import React, { useState } from "react";
import GenlayerVerdictCard from "@/components/genlayer/GenlayerVerdictCard";

const STEPS = ["Fetching evidence", "Validators voting", "Consensus"];

const PRESETS = [
  {
    label: "Delivered (merged PR)",
    hint: "Strong evidence — expect DELIVERED",
    description: "PledgeBond milestone escrow UI — merged and live",
    evidenceUrl: "https://github.com/thisyearnofear/pledgebond/pulls?q=is%3Apr+is%3Amerged",
    criteria: "A merged PR implementing milestone escrow exists.",
  },
  {
    label: "Not delivered (placeholder)",
    hint: "Weak evidence — expect NOT_DELIVERED",
    description: "Mobile app launch — placeholder",
    evidenceUrl: "https://github.com/thisyearnofear/pledgebond/blob/main/README.md",
    criteria: "A published mobile app binary exists.",
  },
];

export default function GenlayerDemoPanel() {
  const [preset, setPreset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function run() {
    const p = PRESETS[preset];
    setLoading(true);
    setError(null);
    setResult(null);
    setStep(0);
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    try {
      const res = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "genlayer_verdict", description: p.description, evidenceUrl: p.evidenceUrl, criteria: p.criteria }),
      });
      const body = await res.json();
      if (body.success) setResult({ ...body.analysis, evidenceUrl: p.evidenceUrl });
      else setError(body.analysis?.summary || "Resolution failed");
    } catch (e) {
      setError(e.message);
    } finally {
      clearInterval(ticker);
      setLoading(false);
    }
  }

  const p = PRESETS[preset];

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/30 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-primary">⚖️ GenLayer jury — try it</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl">
            Pick a case, resolve it, watch validator consensus turn evidence into
            a credit decision. No wallet needed.
          </p>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-dashed border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-300" title={result?.genlayer?.txHash && !result?.genlayer?.mock ? "Resolved by GenLayer validator consensus on testnet" : "Runs offline until GENLAYER_RPC_URL is set — then resolves on testnet"}>
          {result?.genlayer?.txHash && !result?.genlayer?.mock ? "● live jury" : "○ preview mode"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Demo cases">
        {PRESETS.map((c, i) => (
          <button
            key={c.label}
            role="tab"
            aria-selected={i === preset}
            onClick={() => { setPreset(i); setResult(null); setError(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${i === preset ? "bg-violet-600 text-white border-violet-600 shadow" : "border-gray-300 dark:border-gray-700 hover:border-violet-400"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{p.hint} · Evidence: <a className="underline" href={p.evidenceUrl} target="_blank" rel="noopener noreferrer">view link</a></p>

      <button
        onClick={run}
        disabled={loading}
        className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 min-h-touch"
      >
        {loading ? "Resolving…" : "Resolve on GenLayer"}
      </button>

      {loading && (
        <ol className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400" aria-live="polite">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-1.5 ${i <= step ? "font-semibold text-violet-700 dark:text-violet-300" : "opacity-50"}`}>
              <span className={`w-2 h-2 rounded-full ${i < step ? "bg-violet-500" : i === step ? "bg-violet-500 animate-pulse" : "bg-gray-300 dark:bg-gray-600"}`} />
              {s}{i < STEPS.length - 1 && <span className="mx-1 opacity-40">→</span>}
            </li>
          ))}
        </ol>
      )}

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {result && (
        <GenlayerVerdictCard
          verdict={result.genlayer}
          creditSignal={result.creditSignal}
          contractAddress={result.genlayer?.contractAddress}
          evidenceUrl={result.evidenceUrl}
        />
      )}
    </div>
  );
}

