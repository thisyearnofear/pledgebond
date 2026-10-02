/**
 * Onboarding localStorage — single source of truth for dismiss flags.
 */

export const ONBOARDING_KEYS = {
  tour: "pos_tour_complete",
  banner: "pos_banner_dismissed",
  privacy: "pos_privacy_dismissed",
  walletLink: "pb_wallet_link_dismissed",
};

const LEGACY_KEYS = {
  tour: "hasSeenUnifiedOnboarding",
  banner: "pos_onboarding_dismissed",
  privacy: "pos_privacy_onboarding_dismissed",
};

function readFlag(key) {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(key) === "1" || localStorage.getItem(key) === "true";
}

function writeFlag(key, value = "1") {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

/** One-time migration from legacy key names. */
export function migrateLegacyOnboardingKeys() {
  if (typeof window === "undefined") return;

  if (!readFlag(ONBOARDING_KEYS.tour) && readFlag(LEGACY_KEYS.tour)) {
    writeFlag(ONBOARDING_KEYS.tour);
    localStorage.removeItem(LEGACY_KEYS.tour);
  }
  if (!readFlag(ONBOARDING_KEYS.banner) && readFlag(LEGACY_KEYS.banner)) {
    writeFlag(ONBOARDING_KEYS.banner);
    localStorage.removeItem(LEGACY_KEYS.banner);
  }
  if (!readFlag(ONBOARDING_KEYS.privacy) && readFlag(LEGACY_KEYS.privacy)) {
    writeFlag(ONBOARDING_KEYS.privacy);
    localStorage.removeItem(LEGACY_KEYS.privacy);
  }
}

export function isTourDismissed() {
  return readFlag(ONBOARDING_KEYS.tour);
}

export function markTourDismissed() {
  writeFlag(ONBOARDING_KEYS.tour);
}

export function isBannerDismissed() {
  return readFlag(ONBOARDING_KEYS.banner);
}

export function markBannerDismissed() {
  writeFlag(ONBOARDING_KEYS.banner);
}

export function isPrivacyDismissed() {
  return readFlag(ONBOARDING_KEYS.privacy);
}

export function markPrivacyDismissed() {
  writeFlag(ONBOARDING_KEYS.privacy);
}

export function isWalletLinkDismissed() {
  return readFlag(ONBOARDING_KEYS.walletLink);
}

export function markWalletLinkDismissed() {
  writeFlag(ONBOARDING_KEYS.walletLink);
}
