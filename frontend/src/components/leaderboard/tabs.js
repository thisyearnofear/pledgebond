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
  { id: "lenders", label: "Top Lenders", icon: BanknotesIcon },
];

export const TAB_EXPLAINERS = {
  hackathons: "Real payout speeds from real hackathons. How fast do winners actually get paid? See the data and stop waiting.",
  "proof-builders": "Builders ranked by verified wins, evidence coverage, and proof-backed project claims — the most credible in the ecosystem.",
  projects: "Projects ranked by onchain evidence, verified hackathon claims, and overall credibility score.",
  builders: "Top builders by shipping velocity, project submissions, and milestone completions.",
  lenders: "Top lenders by funded volume, bridge loans placed, and portfolio performance.",
};

export function truncateAddress(addr) {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

// Tab ids are plural, OG/entry types are singular. Share URLs carry the
// singular form (`?ref=builder-3`), callers pass whichever they have.
const ENTRY_TYPE_ALIASES = {
  builders: "builder",
  lenders: "backer",
  "proof-builders": "proof-builder",
  projects: "project",
  hackathons: "hackathon",
};

function normalizeEntryType(type) {
  return ENTRY_TYPE_ALIASES[type] || type;
}

const displayName = (entry) => entry.name || truncateAddress(entry.address);
const hasPayoutData = (e) => e.avgPayoutDays !== null && e.avgPayoutDays !== undefined;
const winCount = (e) => `${e.verifiedWins || 0} verified win${e.verifiedWins === 1 ? "" : "s"}`;

/**
 * Share copy variants per entry type. Index 0 preserves the original copy;
 * 1 and 2 are the 48-hour test variants. The chosen index travels in the
 * share URL (`?v=`) so clicks, landings, and signups can be attributed
 * per-variant in the share funnel.
 */
export const SHARE_TEXT_VARIANTS = {
  hackathon: [
    (e, r) => hasPayoutData(e)
      ? `🏆 ${e.name} pays winners in ${e.avgPayoutDays}d avg with ${e.payoutCompletionRate}% payout rate — ranked #${r} on @pledgebond`
      : `🏆 ${e.name} — ranked #${r} hackathon on @pledgebond`,
    (e, r) => hasPayoutData(e)
      ? `How fast does ${e.name} actually pay winners? ${e.avgPayoutDays}d avg, ${e.payoutCompletionRate}% paid — the record is public on @pledgebond`
      : `Does ${e.name} actually pay its winners? The payout record is public on @pledgebond`,
    (e, r) => `Stop waiting 90 days for prize money. ${e.name} is #${r} on the @pledgebond payout leaderboard — verified wins only.`,
  ],
  builder: [
    (e, r) => `#${r} ${displayName(e)} — ${e.velocity || e.score || 0} shipping velocity on @pledgebond`,
    (e, r) => `${displayName(e)} is #${r} on @pledgebond with ${winCount(e)} — no self-reported fluff.`,
    (e, r) => `Proof over promises: ${displayName(e)} is the #${r} verified builder on @pledgebond 🏆`,
  ],
  backer: [
    (e, r) => `#${r} ${displayName(e)} — ${e.velocity || e.score || 0} funding velocity on @pledgebond`,
    (e, r) => `${displayName(e)} funds hackathon winners before prizes land — #${r} lender on @pledgebond`,
    (e, r) => `#${r} lender on @pledgebond: ${displayName(e)} backs builders against confirmed wins.`,
  ],
  "proof-builder": [
    (e, r) => `#${r} Proof Builder: ${displayName(e)} — ${e.score || 0} proof score · ${e.evidenceCoverage || 0}% evidence coverage on @pledgebond`,
    (e, r) => `${displayName(e)} holds ${winCount(e)} — #${r} proof builder on @pledgebond`,
    (e, r) => `Credibility you can audit: ${displayName(e)} is #${r} on @pledgebond with ${winCount(e)}.`,
  ],
  project: [
    (e, r) => `#${r} Proven Project: ${displayName(e)} — ${e.score || 0} credibility · ${e.evidenceCoverage || 0}% evidence coverage on @pledgebond`,
    (e, r) => `${displayName(e)} ranks #${r} on @pledgebond — evidence-backed wins, not self-reported.`,
    (e, r) => `Is ${displayName(e)} actually proven? #${r} on @pledgebond with ${e.evidenceCoverage || 0}% evidence coverage.`,
  ],
};

export function pickShareVariant(entryType) {
  const variants = SHARE_TEXT_VARIANTS[normalizeEntryType(entryType)] || SHARE_TEXT_VARIANTS.project;
  return Math.floor(Math.random() * variants.length);
}

export function generateShareText(entry, rank, type, variant = 0) {
  const variants = SHARE_TEXT_VARIANTS[normalizeEntryType(type)] || SHARE_TEXT_VARIANTS.project;
  const fn = variants[variant] || variants[0];
  return fn(entry, rank);
}

/**
 * Share guardrail — the credibility mechanic doubles as distribution control:
 * only entries backed by verified wins get a share surface, so nothing in a
 * shared OG card is self-attested. Hackathon entries are exempt because the
 * API only lists them after the verified-claim trust gate.
 */
export function isShareableEntry(entryType, entry) {
  if (!entry) return false;
  if (normalizeEntryType(entryType) === "hackathon") return true;
  return (entry.verifiedWins || 0) > 0;
}
