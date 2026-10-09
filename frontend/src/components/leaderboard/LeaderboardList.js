/**
 * LeaderboardList — Generic row list for the `builders` and `backers` tabs.
 *
 * Thin wrapper that maps entries to LeaderboardRow.
 */

import LeaderboardRow from "./LeaderboardRow";
import HighlightedEntry from "./HighlightedEntry";

export default function LeaderboardList({ entries, type, highlightedEntry }) {
  return (
    <div className="space-y-3">
      {entries.map((entry, idx) => (
        <HighlightedEntry key={entry.address || idx} highlighted={entry === highlightedEntry}>
          <LeaderboardRow entry={entry} rank={idx + 1} type={type} />
        </HighlightedEntry>
      ))}
    </div>
  );
}
