/**
 * Shared constants for the Explore page tabs.
 */

import { ECOSYSTEM_CONFIGS } from "@/config/ecosystems";

export const CATEGORY_OPTIONS = [
  { id: "defi", label: "DeFi" },
  { id: "gaming", label: "Gaming" },
  { id: "rwa", label: "RWA" },
  { id: "infrastructure", label: "Infra" },
  { id: "social", label: "Social" },
  { id: "ai-agents", label: "AI Agents" },
  { id: "payments", label: "Payments" },
  { id: "nft", label: "NFT" },
  { id: "dao", label: "DAO" },
  { id: "other", label: "Other" },
];

export const SORT_OPTIONS = [
  { id: "trending", label: "Trending" },
  { id: "created", label: "Newest" },
  { id: "health", label: "Quality" },
  { id: "name", label: "Name" },
  { id: "recent", label: "Activity" },
];

export const SORT_LABELS = {
  trending: "🔥 Trending",
  created: "🆕 Newest",
  health: "⭐ Quality",
  recent: "📊 Activity",
};

export const BUILDER_SORT_OPTIONS = [
  { id: "projects", label: "Most projects" },
  { id: "stars", label: "Most stars" },
  { id: "health", label: "Quality" },
  { id: "followers", label: "Most followed" },
  { id: "recent", label: "Recently active" },
  { id: "name", label: "Name" },
];

export const ECOSYSTEM_OPTIONS = Object.entries(ECOSYSTEM_CONFIGS).map(([id, cfg]) => ({
  id,
  label: `${cfg.icon} ${cfg.shortName}`,
}));

/** Ecosystem filter dropdowns — includes "all" sentinel */
export const ECOSYSTEM_FILTER_OPTIONS = [
  { id: "all", label: "All Ecosystems" },
  ...ECOSYSTEM_OPTIONS,
];

export const ITEMS_PER_PAGE = 12;

export const BACKER_SORT_OPTIONS = [
  { id: "health", label: "Health" },
  { id: "confidence", label: "Confidence" },
  { id: "newest", label: "Newest" },
];

/** Max projects shown on Back → Discover before linking to Explore */
export const BACKER_SHORTLIST_LIMIT = 9;
