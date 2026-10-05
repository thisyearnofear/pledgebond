/**
 * Capital stack rails — single source of truth for the three funding instruments.
 */

/** @typedef {'live' | 'beta' | 'coming_soon'} RailStatus */

/** @type {Record<RailStatus, string>} */
export const RAIL_STATUS_LABELS = {
  live: "Live",
  beta: "Beta",
  coming_soon: "Coming soon",
};

/** @type {Record<RailStatus, string>} */
export const RAIL_STATUS_STYLES = {
  live: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  beta: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  coming_soon: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

/** @type {Record<string, { border: string, label: string, pill: string }>} */
export const RAIL_TONES = {
  purple: {
    border: "border-t-purple-500",
    label: "text-purple-600 dark:text-purple-400",
    pill: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  blue: {
    border: "border-t-blue-500",
    label: "text-blue-600 dark:text-blue-400",
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  green: {
    border: "border-t-green-500",
    label: "text-green-600 dark:text-green-400",
    pill: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
};

/**
 * @typedef {Object} CapitalRail
 * @property {string} id
 * @property {RailStatus} status
 * @property {'purple' | 'blue' | 'green'} tone
 * @property {string} eyebrow
 * @property {string} tag
 * @property {string} title
 * @property {string} shortTitle
 * @property {string} emoji
 * @property {string} description
 * @property {string[]} bullets
 * @property {string} footerLeft
 * @property {string} footerRight
 */

/** @type {CapitalRail[]} */
export const CAPITAL_RAILS = [
  {
    id: "bags",
    status: "coming_soon",
    tone: "purple",
    eyebrow: "Rail 1",
    tag: "Pre-prize",
    title: "Bags Token",
    shortTitle: "Bags",
    emoji: "🎒",
    description:
      "No prize pipeline yet? Launch a project token on Solana. Community buys in, you earn fee-share yield.",
    bullets: [
      "Community capital from token buyers",
      "Fee-share yield from trading volume",
      "No verification required",
    ],
    footerLeft: "Backer yield: Fee-share %",
    footerRight: "Risk: Market-driven",
  },
  {
    id: "loan",
    status: "live",
    tone: "blue",
    eyebrow: "The loan",
    tag: "Bridge",
    title: "Bridge Loan",
    shortTitle: "Loan",
    emoji: "💳",
    description:
      "Won already, paid later? Draw USDC against your confirmed win and repay when the organizer pays out.",
    bullets: [
      "Cash in hours, not 90 days",
      "Overcollateralized or tranche-backed",
      "Repaid on prize settlement",
    ],
    footerLeft: "You set your rate and duration",
    footerRight: "Default risk sits with you and the tranche",
  },
  {
    id: "market",
    status: "coming_soon",
    tone: "green",
    eyebrow: "The market",
    tag: "Speculation",
    title: "Payout Market",
    shortTitle: "Market",
    emoji: "🏆",
    description:
      "Back the organizers who pay. Bet on whether a declared win will actually be settled — and be ranked by what happens next.",
    bullets: [
      "Payout verification on 3 chains",
      "Leaderboard ranks fastest payers",
      "Credibility derived from real history",
    ],
    footerLeft: "Your stake, your call",
    footerRight: "Speculative — bounded at your stake",
  },
];

/**
 * @param {string} id
 * @returns {CapitalRail | undefined}
 */
export function getRailById(id) {
  return CAPITAL_RAILS.find((rail) => rail.id === id);
}

/**
 * @param {string} id
 * @returns {RailStatus | undefined}
 */
export function getRailStatus(id) {
  return getRailById(id)?.status;
}

/**
 * @param {RailStatus | undefined} status
 * @returns {boolean}
 */
export function isRailAvailable(status) {
  return status === "live" || status === "beta";
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isRailIntegrated(id) {
  return isRailAvailable(getRailStatus(id));
}

export const CAPITAL_STACK_HEADING = "Win Now, Settle Later";
export const CAPITAL_STACK_SUBHEADING =
  "Two instruments on one fact: you won, and they haven't paid yet. Borrow against the win, or bet on whether it gets paid.";
export const CAPITAL_STACK_FOOTNOTE =
  "Lenders carry credit risk. Bettors carry bounded speculation. The pools never mix.";

/** Landing page anchor for deep links from Agents tab and elsewhere. */
export const CAPITAL_STACK_ANCHOR_ID = "capital-stack";
export const CAPITAL_STACK_HREF = `/#${CAPITAL_STACK_ANCHOR_ID}`;
export const AGENTS_CAPITAL_HINT =
  "Payout truth first — loans and market open once the win is verified on-chain.";
