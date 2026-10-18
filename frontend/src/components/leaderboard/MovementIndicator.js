/**
 * MovementIndicator — Up / down / new / stable dot.
 *
 * Used in every leaderboard row to show how an entry has moved since
 * the previous ranking. Self-contained; takes a `movement` field
 * (one of: "up" | "down" | "new" | undefined).
 */

export default function MovementIndicator({ entry }) {
  if (entry.movement === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400" title="Moved up">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </span>
    );
  }
  if (entry.movement === "down") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-500 dark:text-red-400" title="Moved down">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    );
  }
  if (entry.movement === "new") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
        New
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] text-tertiary">
      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" opacity="0.4">
        <circle cx="12" cy="12" r="4" />
      </svg>
    </span>
  );
}
