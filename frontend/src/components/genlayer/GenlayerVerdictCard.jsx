/**
 * GenlayerVerdictCard — the jury verdict as a first-class PledgeBond badge.
 *
 * Design: speaks ProofBadge language (tiered pill, gold shimmer only when
 * earned, tooltip with provenance) so builders/backers/stewards read it with
 * zero new learning. Three states map onto existing credibility colors:
 * DELIVERED → gold/green · NOT_DELIVERED → red · INCONCLUSIVE/PENDING → amber.
 * Live vs mock provenance is always labeled — trust is the product.
 *
 * Props: { verdict, creditSignal, contractAddress, evidenceUrl }
 * verdict: { verdict, confidence, reason, milestoneId, txHash, resolvedAt, mock? }
 */
import { useState } from "react";

const STATE = {
  DELIVERED: { emoji: "⚖️✅", label: "Jury: Delivered", tier: "gold" },
  NOT_DELIVERED: { emoji: "⚖️❌", label: "Jury: Not delivered", tier: "alert" },
  INCONCLUSIVE: { emoji: "⚖️🔍", label: "Jury: Inconclusive", tier: "amber" },
  PENDING: { emoji: "⚖️⏳", label: "Jury: Resolving", tier: "amber" },
};

export default function GenlayerVerdictCard({
  verdict,
  creditSignal,
  contractAddress,
  evidenceUrl,
}) {
  const [expanded, setExpanded] = useState(false);
  if (!verdict) return null;
  const v = verdict.verdict || "PENDING";
  const meta = STATE[v] || STATE.PENDING;
  const isGold = meta.tier === "gold" && verdict.confidence === "HIGH";
  const live = verdict.txHash && !verdict.mock;

  const shell =
    v === "DELIVERED"
      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40"
      : v === "NOT_DELIVERED"
        ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40"
        : "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40";

  return (
    <div className={`rounded-xl border p-4 ${shell}`}>
      {/* Verdict pill row — ProofBadge grammar */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`group relative inline-flex items-center rounded-full border font-semibold cursor-default px-2.5 py-1 text-xs gap-1.5 ${
            isGold ? "gold-badge-glow bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200" : ""
          } ${!isGold && v === "DELIVERED" ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200" : ""} ${
            v === "NOT_DELIVERED" ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200" : ""
          } ${v !== "DELIVERED" && v !== "NOT_DELIVERED" ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200" : ""}`}
          title={verdict.reason || meta.label}
        >
          {isGold && <span className="gold-badge-shimmer absolute inset-0 rounded-full pointer-events-none" />}
          <span className="relative z-10">{meta.emoji} {meta.label}</span>
          {verdict.confidence && <span className="relative z-10 opacity-70">· {verdict.confidence}</span>}
        </span>
        {typeof creditSignal?.boost === "number" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300" title="Underwriter credit adjustment from this verdict">
            credit {creditSignal.boost > 0 ? `+${creditSignal.boost}` : creditSignal.boost}
          </span>
        )}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400" title={live ? "Resolved by GenLayer validator consensus on testnet" : "Offline preview — same interface, no chain call"}>
          {live ? "● live jury" : "○ preview"}
        </span>
      </div>

      {/* Reason — the human sentence, always visible */}
      {verdict.reason && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">“{verdict.reason}”</p>}

      {/* Progressive disclosure — stewards get everything, others get calm */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
        aria-expanded={expanded}
      >
        {expanded ? "Hide verification details" : "How was this decided?"}
      </button>
      {expanded && (
        <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          {evidenceUrl && <div><dt className="font-semibold inline">Evidence: </dt><dd className="inline break-all"><a className="underline" href={evidenceUrl} target="_blank" rel="noopener noreferrer">view deliverable</a></dd></div>}
          {contractAddress && !verdict.mock && <div><dt className="font-semibold inline">Contract: </dt><dd className="inline font-mono">{String(contractAddress).slice(0, 12)}…</dd></div>}
          {verdict.milestoneId !== undefined && <div><dt className="font-semibold inline">Milestone: </dt><dd className="inline">#{String(verdict.milestoneId)}</dd></div>}
          {verdict.txHash && <div><dt className="font-semibold inline">Tx: </dt><dd className="inline font-mono">{String(verdict.txHash).slice(0, 12)}…</dd></div>}
          <div className="sm:col-span-2"><dt className="font-semibold inline">Method: </dt><dd className="inline">validators fetched the evidence independently, then reached LLM consensus — no oracle, no admin vote.</dd></div>
        </dl>
      )}
    </div>
  );
}

