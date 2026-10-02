/**
 * Lightweight analytics utility — fire-and-forget event tracking.
 *
 * In development: logs to console.
 * In production: POSTs to /api/analytics/event (silently fails if endpoint missing).
 * Uses navigator.sendBeacon when available for reliable page-unload delivery.
 */

import React from "react";

const ANALYTICS_ENDPOINT = "/api/analytics/event";
const isDev = process.env.NODE_ENV === "development";

/**
 * Track a named event with optional properties.
 * @param {string} event — Event name (kebab-case)
 * @param {object} [properties] — Additional event properties
 */
export function trackEvent(event, properties = {}) {
  const payload = {
    event,
    properties,
    timestamp: Date.now(),
    url: typeof window !== "undefined" ? window.location.href : null,
  };

  if (isDev) {
    // eslint-disable-next-line no-console
    console.log("[analytics]", event, properties);
    return;
  }

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      // Blob with type application/json — sendBeacon with a plain string
      // sends text/plain, which Next's body parser skips (empty req.body).
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
    } catch {
      // Silently fail — analytics should never break user flow
    }
    return;
  }

  // Fallback to fetch (fire-and-forget)
  try {
    fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silently fail
  }
}

/**
 * Hook to track that a component rendered with specific badges.
 * Uses a ref to dedupe so it only fires once per mount.
 * @param {string} page — Page identifier (e.g., "builder-dashboard")
 * @param {object[]} badges — Array of badge objects
 */
export function useBadgeViewTracking(page, badges) {
  const trackedRef = React.useRef(false);

  React.useEffect(() => {
    if (trackedRef.current) return;
    if (!badges || badges.length === 0) return;

    trackedRef.current = true;
    trackEvent("badge_viewed", {
      page,
      badge_ids: badges.map((b) => b.id),
      badge_tiers: badges.map((b) => b.tier || "default"),
      count: badges.length,
    });
  }, [page, badges]);
}
