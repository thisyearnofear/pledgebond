/**
 * useProfileStore — user preferences, theme, and behavior tracking.
 *
 * Replaces AppContext.tsx (theme + preferences + behavior) and the
 * preference portion of the old UserContext.tsx.
 *
 * SSR safety: localStorage is read in an effect below; the initial
 * state uses safe defaults. The store is gated by `NoSSR` in the
 * provider tree, so this only runs client-side anyway.
 */

import { useRouter } from "next/router";
import { createStore, useStore, type Store } from "./createStore";

// ============================================================================
// Types
// ============================================================================

export type Theme = "light" | "dark" | "high-contrast";

interface UserPreferences {
  theme?: Theme;
  defaultViewMode?: string;
  lastVisitedEcosystem?: string;
  lastActiveDate?: string;
  favoriteEcosystems?: string[];
  primaryEcosystem?: string;
  ecosystemOnboardingComplete?: boolean;
  recentProjects?: Record<string, any>;
  rememberFilters?: boolean;
  commonFilters?: Record<string, any>;
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  preferredComplexity?: "simple" | "detailed" | "advanced";
  totalInteractions?: number;
  featureUsage?: Record<string, number>;
}

interface AdaptiveSettings {
  showAdvancedFilters: boolean;
  showHealthScores: boolean;
  showDetailedStats: boolean;
  defaultComplexity: string;
  autoExpandSections: boolean;
  showHints: boolean;
  enableCompactMode: boolean;
}

interface PersonalizedRecommendation {
  type: string;
  title: string;
  description: string;
  action: string;
  priority: "high" | "medium" | "low";
}

// ============================================================================
// Store
// ============================================================================

interface ProfileState {
  // Theme
  theme: Theme;
  themeMounted: boolean;
  // Preferences
  preferences: UserPreferences;
  isLoaded: boolean;
}

const initialState: ProfileState = {
  theme: "dark",
  themeMounted: false,
  preferences: {},
  isLoaded: false,
};

export const profileStore: Store<ProfileState> = createStore<ProfileState>(initialState);

// ============================================================================
// Persistence
// ============================================================================

const PREF_KEY = "pledgebond-user-preferences";
const THEME_KEY = "pledgebond-dashboard-theme";

function loadFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const themeRaw = window.localStorage.getItem(THEME_KEY);
    if (themeRaw === "light" || themeRaw === "dark" || themeRaw === "high-contrast") {
      applyThemeToDOM(themeRaw);
      profileStore.setState({ theme: themeRaw });
    }
    const prefRaw = window.localStorage.getItem(PREF_KEY);
    if (prefRaw) {
      profileStore.setState({ preferences: JSON.parse(prefRaw) });
    }
  } catch {}
  profileStore.setState({ isLoaded: true, themeMounted: true });
}

function persistPreferences(prefs: UserPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {}
}

function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

// ============================================================================
// Actions
// ============================================================================

function applyThemeToDOM(theme: Theme) {
  if (typeof window === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function setTheme(theme: Theme) {
  applyThemeToDOM(theme);
  persistTheme(theme);
  profileStore.setState((s) => ({ theme, preferences: { ...s.preferences, theme } }));
}

function toggleTheme() {
  const { theme } = profileStore.getState();
  setTheme(theme === "dark" ? "light" : "dark");
}

function setLightTheme() { setTheme("light"); }
function setDarkTheme() { setTheme("dark"); }
function setHighContrastTheme() { setTheme("high-contrast"); }

function updatePreference(key: string, value: any) {
  profileStore.setState((s) => {
    const next: UserPreferences = { ...s.preferences, [key]: value as any };
    persistPreferences(next);
    return { preferences: next };
  });
}

function updateNestedPreference(path: string, key: string, value: any) {
  profileStore.setState((s) => {
    const pathParts = path.split(".");
    const next: any = { ...s.preferences };
    let cursor: any = next;
    for (const p of pathParts) {
      cursor[p] = { ...(cursor[p] || {}) };
      cursor = cursor[p];
    }
    cursor[key] = value;
    persistPreferences(next);
    return { preferences: next };
  });
}

function getPreference(key: string, defaultValue?: any) {
  return (profileStore.getState().preferences as any)[key] ?? defaultValue;
}

function trackInteraction(event: string, type?: string) {
  profileStore.setState((s) => {
    const totalInteractions = (s.preferences.totalInteractions || 0) + 1;
    const featureUsage = { ...(s.preferences.featureUsage || {}), [event]: ((s.preferences.featureUsage || {})[event] || 0) + 1 };
    const next = { ...s.preferences, totalInteractions, featureUsage };
    persistPreferences(next);
    return { preferences: next };
  });
}

function trackViewModeChange(viewMode: string, context?: string) {
  trackInteraction(`view_${viewMode}`, context);
  updatePreference("defaultViewMode", viewMode);
}

function trackFilterUsage(filterType: string, value: any, context?: string) {
  trackInteraction(`filter_${filterType}`, context);
  profileStore.setState((s) => {
    const commonFilters = { ...(s.preferences.commonFilters || {}), [filterType]: value };
    return { preferences: { ...s.preferences, commonFilters } };
  });
}

function trackEcosystemInteraction(ecosystem: string, action: string = "view") {
  trackInteraction(`ecosystem_${action}`);
  profileStore.setState((s) => {
    const recentProjects = { ...(s.preferences.recentProjects || {}) };
    recentProjects[ecosystem] = (recentProjects[ecosystem] || 0) + 1;
    const favorites = s.preferences.favoriteEcosystems || [];
    const next: UserPreferences = { ...s.preferences, recentProjects };
    if (recentProjects[ecosystem] >= 3 && !favorites.includes(ecosystem)) {
      next.favoriteEcosystems = [...favorites, ecosystem];
    }
    persistPreferences(next);
    return { preferences: next };
  });
}

function trackProjectInteraction(projectSlug: string, ecosystem: string, action: string = "view") {
  trackInteraction(`project_${action}`);
  trackEcosystemInteraction(ecosystem, "view");
  updateNestedPreference("recentProjects", projectSlug, { ecosystem, action, at: new Date().toISOString() });
}

function trackFeatureUsage(feature: string, context?: string) {
  trackInteraction(feature, context);
  profileStore.setState((s) => {
    const featureUsage = s.preferences.featureUsage || {};
    let experienceLevel: UserPreferences["experienceLevel"] = s.preferences.experienceLevel;
    if (!experienceLevel) {
      const total = Object.values(featureUsage).reduce((sum: number, n: any) => sum + (n || 0), 0);
      if (total >= 100) experienceLevel = "advanced";
      else if (total >= 30) experienceLevel = "intermediate";
    }
    return { preferences: { ...s.preferences, experienceLevel } };
  });
}

function isExperiencedWith(feature: string) {
  const usage = profileStore.getState().preferences.featureUsage || {};
  return (usage[feature] || 0) >= 3;
}

function getAdaptiveSettings(): AdaptiveSettings {
  const { preferences } = profileStore.getState();
  // Explicit user override always wins — adaptive that can't be tuned feels creepy.
  const override = preferences.preferredComplexity;
  if (override === "advanced" || override === "detailed" || override === "simple") {
    const advanced = override === "advanced";
    return {
      showAdvancedFilters: override !== "simple",
      showHealthScores: true,
      showDetailedStats: advanced,
      defaultComplexity: override,
      autoExpandSections: advanced,
      showHints: override === "simple",
      enableCompactMode: advanced,
    };
  }
  const total = preferences.totalInteractions || 0;
  const level = preferences.experienceLevel || (total >= 100 ? "advanced" : total >= 30 ? "intermediate" : "beginner");
  return {
    showAdvancedFilters: level !== "beginner",
    showHealthScores: total > 20,
    showDetailedStats: level === "advanced",
    defaultComplexity: level === "advanced" ? "advanced" : level === "intermediate" ? "detailed" : "simple",
    autoExpandSections: level === "advanced",
    showHints: level === "beginner",
    enableCompactMode: total > 50,
  };
}

function getPersonalizedRecommendations(): PersonalizedRecommendation[] {
  const { preferences } = profileStore.getState();
  const recs: PersonalizedRecommendation[] = [];
  if (!preferences.favoriteEcosystems?.length) {
    recs.push({ type: "discover", title: "Pick your ecosystems", description: "Tell us which chains interest you for tailored results.", action: "/profile/settings", priority: "high" });
  }
  if ((preferences.totalInteractions || 0) < 10) {
    recs.push({ type: "tutorial", title: "Take the 2-minute tour", description: "See what PledgeBond can do for you.", action: "/explore", priority: "medium" });
  }
  return recs;
}

function applySmartDefaults() {
  const { preferences } = profileStore.getState();
  const total = preferences.totalInteractions || 0;
  if (total === 10) {
    // milestone: show hints less
  } else if (total === 25) {
    updatePreference("showAdvancedFilters", true);
  } else if (total === 50) {
    updatePreference("enableCompactMode", true);
  }
}

function usageStats() {
  const { preferences } = profileStore.getState();
  return { totalInteractions: preferences.totalInteractions || 0, featureUsage: preferences.featureUsage || {} };
}

function smartDefaults() {
  // The old code exposed the function itself here (almost certainly a typo).
  // Return the result of calling it so consumers reading `smartDefaults`
  // get a value, not a function.
  return applySmartDefaults();
}

function refreshDerived(_userProfile: any, _creditData: any) {
  // Hook for authStore to call after profile changes that affect derived values.
  // Currently a no-op; placeholder for future recomputation.
}

// ============================================================================
// Router sync (route changes update lastVisitedEcosystem)
// ============================================================================

// NOTE: route tracking is written directly by the project detail page effect
// (trackProjectInteraction + lastVisitedEcosystem) rather than a global router
// hook — explicit call sites beat magic listeners. This stub remains only so
// initProfileStore() keeps its shape; do not re-add router magic here.

function attachRouterSync() {
  if (typeof window === "undefined") return;
  // Lazy import to avoid SSR issues
  try {
    const { useRouter: _ } = require("next/router");
  } catch {}
}

// ============================================================================
// Init
// ============================================================================

let initialized = false;
export function initProfileStore() {
  if (initialized) return;
  initialized = true;
  if (typeof window === "undefined") return;
  loadFromStorage();
  attachRouterSync();
}

// ============================================================================
// Hooks + aliases
// ============================================================================

export const useProfileStore = <T,>(selector: (s: ProfileState) => T) => useStore(profileStore, selector);

export const profileActions = {
  setTheme,
  toggleTheme,
  setLightTheme,
  setDarkTheme,
  setHighContrastTheme,
  updatePreference,
  updateNestedPreference,
  getPreference,
  trackInteraction,
  trackViewModeChange,
  trackFilterUsage,
  trackEcosystemInteraction,
  trackProjectInteraction,
  trackFeatureUsage,
  isExperiencedWith,
  getAdaptiveSettings,
  getPersonalizedRecommendations,
  applySmartDefaults,
  usageStats,
  smartDefaults,
  refreshDerived,
};

// ============================================================================
// Convenience hooks — drop-in replacements for the old AppContext hooks.
// ============================================================================

export function useTheme() {
  const theme = useStore(profileStore, (s) => s.theme);
  const themeMounted = useStore(profileStore, (s) => s.themeMounted);
  return {
    theme,
    themeMounted,
    setTheme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    setHighContrastTheme,
  };
}

export function useUserBehavior() {
  const preferences = useStore(profileStore, (s) => s.preferences);
  const isLoaded = useStore(profileStore, (s) => s.isLoaded);
  return {
    preferences,
    isLoaded,
    updatePreference,
    updateNestedPreference,
    getPreference,
    trackViewModeChange,
    trackFilterUsage,
    trackEcosystemInteraction,
    trackProjectInteraction,
    trackFeatureUsage,
    trackInteraction,
    isExperiencedWith,
    getPersonalizedRecommendations,
    getAdaptiveSettings,
    applySmartDefaults,
    smartDefaults,
    usageStats,
    personalizedRecommendations: getPersonalizedRecommendations(),
    adaptiveSettings: getAdaptiveSettings(),
  };
}

export function useApp() {
  const theme = useStore(profileStore, (s) => s.theme);
  const themeMounted = useStore(profileStore, (s) => s.themeMounted);
  const preferences = useStore(profileStore, (s) => s.preferences);
  const isLoaded = useStore(profileStore, (s) => s.isLoaded);
  return {
    theme,
    themeMounted,
    setTheme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    setHighContrastTheme,
    preferences,
    isLoaded,
    updatePreference,
    updateNestedPreference,
    getPreference,
    trackViewModeChange,
    trackFilterUsage,
    trackEcosystemInteraction,
    trackProjectInteraction,
    trackFeatureUsage,
    trackInteraction,
    isExperiencedWith,
    getPersonalizedRecommendations,
    getAdaptiveSettings,
    applySmartDefaults,
    smartDefaults,
    usageStats,
  };
}
