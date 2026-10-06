/**
 * Shared constants + utilities for the leaderboard page.
 * Kept co-located with the components that consume them.
 */

import {
  TrophyIcon,
  RocketLaunchIcon,
  BanknotesIcon,
  FireIcon,
} from "@heroicons/react/24/outline";
import { BoltIcon } from "@heroicons/react/24/solid";

export const TABS = [
  { id: "hackathons", label: "Payouts", icon: BoltIcon },
  { id: "proof-builders", label: "Proof Builders", icon: TrophyIcon },
  { id: "projects", label: "Proven Projects", icon: FireIcon },
  { id: "builders", label: "Top Builders", icon: RocketLaunchIcon },
  { id: "backers", label: "Top Backers", icon: BanknotesIcon },
];

export const TAB_EXPLAINERS = {
  hackathons: "Real payout speeds from real hackathons. How fast do winners actually get paid? See the data and stop waiting.",
  "proof-builders": "Builders ranked by verified wins, evidence coverage, and proof-backed project claims — the most credible in the ecosystem.",
  projects: "Projects ranked by onchain evidence, verified hackathon claims, and overall credibility score.",
  builders: "Top builders by shipping velocity, project submissions, and milestone completions.",
  backers: "Top backers by funded volume, projects backed, and portfolio performance.",
};

export function truncateAddress(addr) {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function generateShareText(entry, rank, type) {
  if (type === "builders") {
    return `#${rank} ${entry.name || truncateAddress(entry.address)} — ${entry.velocity || entry.score || 0} shipping velocity on @pledgebond`;
  }
  if (type === "backers") {
    return `#${rank} ${entry.name || truncateAddress(entry.address)} — ${entry.velocity || entry.score || 0} funding velocity on @pledgebond`;
  }
  return `#${rank} ${entry.name || truncateAddress(entry.address)} on @pledgebond`;
}
