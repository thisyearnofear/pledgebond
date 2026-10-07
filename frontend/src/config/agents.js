/**
 * AI agent catalog — display metadata derived from AGENT_PRICES.
 */

import { AGENT_PRICES } from "@/lib/wallet/constants";

/**
 * @param {number} amount
 * @returns {string}
 */
function formatAgentPrice(amount) {
  if (amount < 0.01) return `$${amount}/10 LOC`;
  const decimals = amount >= 1 ? 0 : 2;
  return `$${amount.toFixed(decimals)}`;
}

/** @type {{ id: string, name: string, icon: string, price: number, priceLabel: string, description: string }[]} */
export const AGENTS = [
  {
    id: "scout",
    name: "Scout",
    icon: "🔭",
    price: AGENT_PRICES.scout,
    priceLabel: formatAgentPrice(AGENT_PRICES.scout),
    description: "Scans projects and recommends where to look first",
  },
  {
    id: "underwrite",
    name: "Underwriter",
    icon: "📊",
    price: AGENT_PRICES.underwrite,
    priceLabel: formatAgentPrice(AGENT_PRICES.underwrite),
    description: "Scores a project and returns actionable analysis",
  },
  {
    id: "verify",
    name: "Verifier",
    icon: "✅",
    price: AGENT_PRICES.verify,
    priceLabel: formatAgentPrice(AGENT_PRICES.verify),
    description: "Reviews code and reports whether automation is available",
  },
];

export const AGENTS_INTRO =
  "For winners: Verifier confirms payouts. Underwriter scores the win into a shareable packet. Scout is optional for lenders scanning the wider market.";
