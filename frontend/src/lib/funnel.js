/**
 * Funnel event instrumentation — measures steps-to-outcome.
 *
 * Emits `funnel_step` events through the existing /api/analytics/event
 * endpoint. The route persists only funnel_* events to Firestore
 * (`funnelEvents` collection, rules-locked); other analytics stay
 * log-only so storage is bounded to what we deliberately instrument.
 *
 * A stable anonymous `funnelId` (localStorage) ties pre-login steps to
 * post-login outcomes without waiting for auth.
 *
 * Vocabulary (funnel → steps):
 *   login:        role_selected, github_connected, wallet_connected, identity_signed
 *   payout_lead:  lead_submitted, lead_verified_inline
 *   winner_claim: claim_submitted, claim_pending, claim_verified, explore_hackathons_clicked
 *   backing:      modal_opened, amount_entered, tx_confirmed, tx_failed
 */

import { trackEvent } from "@/lib/analytics";

const FUNNEL_ID_KEY = "pb_funnel_id";

/** Stable anonymous id — survives reloads, ties steps to outcomes. */
export function getFunnelId() {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(FUNNEL_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(FUNNEL_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Track a funnel step. Fire-and-forget — never blocks the caller.
 * @param {string} funnel — funnel name (login | payout_lead | winner_claim | backing)
 * @param {string} step — step name within the funnel
 * @param {object} [properties] — optional extra context
 */
export function trackFunnelStep(funnel, step, properties = {}) {
  trackEvent("funnel_step", {
    funnel,
    step,
    funnelId: getFunnelId(),
    ...properties,
  });
}
