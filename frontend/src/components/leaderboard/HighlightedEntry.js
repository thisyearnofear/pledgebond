/**
 * HighlightedEntry — marks the entry a shared `?ref=` link points at.
 *
 * Scrolls the row into view and rings it so the landing page visually
 * matches the OG card that was shared. Identity comparison happens in the
 * parent list (`entry === highlightedEntry`), which survives search
 * filtering since the filtered array holds the same objects.
 */

import { useEffect, useRef } from "react";

export default function HighlightedEntry({ highlighted, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  return (
    <div
      ref={ref}
      className={
        highlighted
          ? "rounded-xl ring-2 ring-indigo-500 dark:ring-indigo-400"
          : undefined
      }
    >
      {children}
    </div>
  );
}
