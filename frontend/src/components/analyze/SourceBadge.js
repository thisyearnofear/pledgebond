/**
 * SourceBadge — pill showing the AI provider source for an analysis
 * result: "On-Device" (QVAC local) or "Cloud" (provider fallback).
 * Renders nothing for unknown sources.
 */
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

const STYLES = {
  "qvac-local": "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  "cloud-fallback": "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  "cloud": "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  "genlayer": "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  "genlayer-mock": "bg-violet-50 text-violet-600 border border-dashed border-violet-300 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700",
};

const LABELS = {
  "qvac-local": "On-Device",
  "cloud-fallback": "Cloud",
  "cloud": "Cloud",
  "genlayer": "Jury",
  "genlayer-mock": "Jury Preview",
};

export default function SourceBadge({ source }) {
  if (!STYLES[source]) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${STYLES[source]}`}>
      {source === "qvac-local" && <ShieldCheckIcon className="w-3 h-3" />}
      {LABELS[source]}
    </span>
  );
}
