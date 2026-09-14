/**
 * Primary navigation — single source of truth for top-level IA.
 */

/** @typedef {'builder' | 'backer' | null} UserRole */

/**
 * @typedef {Object} NavItem
 * @property {string} id
 * @property {string} label
 * @property {string} href
 * @property {boolean} [auth]
 * @property {boolean} [builderOnly]
 */

/** @type {NavItem[]} */
export const PRIMARY_NAV = [
  { id: "explore", label: "Explore", href: "/explore" },
  { id: "leaderboard", label: "Payouts", href: "/leaderboard" },
  { id: "build", label: "Build", href: "/build", auth: true, builderOnly: true },
  { id: "back", label: "Back", href: "/back" },
];

export const AGENTS_TAB = "agents";

/** @deprecated Use AGENTS_TAB — kept for inbound links during transition */
export const LEGACY_AGENTS_TAB = "economy";

export const AGENT_MODES = ["jury", "analyze", "scout", "compare", "setup"];

/**
 * @param {string} [mode]
 * @param {string} [projectId]
 * @returns {string}
 */
export function agentsHref(mode, projectId) {
  const query = new URLSearchParams({ tab: AGENTS_TAB });
  const resolved = mode || "jury";
  query.set("mode", resolved);
  if (projectId) query.set("project", projectId);
  return `/back?${query.toString()}`;
}

/**
 * @param {string} [ecosystem]
 * @returns {string}
 */
export function exploreHref(ecosystem) {
  if (!ecosystem || ecosystem === "all") return "/explore";
  return `/explore?ecosystem=${encodeURIComponent(ecosystem)}`;
}

/**
 * Normalize legacy `tab=economy` query values.
 * @param {string | string[] | undefined} tab
 * @returns {string | undefined}
 */
export function normalizeBackTab(tab) {
  const value = Array.isArray(tab) ? tab[0] : tab;
  if (value === LEGACY_AGENTS_TAB) return AGENTS_TAB;
  return value;
}

/**
 * @param {NavItem[]} items
 * @param {{ currentUser: object | null, userRole: UserRole }} ctx
 * @returns {NavItem[]}
 */
export function filterNavItems(items, { currentUser, userRole }) {
  return items.filter((item) => {
    if (item.auth && !currentUser) return false;
    if (item.builderOnly && userRole === "backer") return false;
    return true;
  });
}
