/**
 * Sponsored agent calls — platform-funded first runs.
 *
 * The first N agent calls per user are on the platform. The value lands
 * before the toll: a new backer reads a real Underwriter packet without
 * first depositing USDC. After the budget is spent, the standard x402
 * payment path applies unchanged.
 *
 * Budget lives in the `agentSponsorships` collection:
 *   { uid, callsRemaining, callsUsed, updatedAt, history[] }
 *
 * Rules:
 *   - Default budget: 3 calls per user (env AGENT_FREE_CALLS overrides).
 *   - Sponsored calls are recorded in agent_runs with sponsored: true so
 *     the economics stay auditable.
 *   - Unauthenticated users get an IP-keyed ephemeral budget of 1.
 */

import { db } from "./firebase/serverOnly";

const DEFAULT_FREE_CALLS = Number(process.env.AGENT_FREE_CALLS || 3);

/**
 * Read a caller's remaining sponsored-call budget without consuming it.
 *
 * @param {{ uid?: string | null, ip?: string | null }} caller
 * @returns {Promise<{ eligible: boolean, callsRemaining: number, key: string }>}
 */
export async function getSponsorshipStatus(caller) {
  const key = caller.uid ? `uid:${caller.uid}` : `ip:${caller.ip || "unknown"}`;
  try {
    const doc = await db.collection("agentSponsorships").doc(key).get();
    if (!doc.exists) {
      const budget = caller.uid ? DEFAULT_FREE_CALLS : 1;
      return { eligible: budget > 0, callsRemaining: budget, key };
    }
    const callsRemaining = Math.max(0, Number(doc.data().callsRemaining || 0));
    return { eligible: callsRemaining > 0, callsRemaining, key };
  } catch {
    // Firestore unavailable — never sponsor blindly.
    return { eligible: false, callsRemaining: 0, key };
  }
}

/**
 * Atomically consume one sponsored call. Returns null when the budget is
 * exhausted (caller should fall back to the paid path).
 *
 * @param {{ uid?: string | null, ip?: string | null }} caller
 * @returns {Promise<{ sponsored: true, callsRemaining: number } | null>}
 */
export async function consumeSponsoredCall(caller) {
  const status = await getSponsorshipStatus(caller);
  if (!status.eligible) return null;

  try {
    // Best-effort decrement. Races can over-sponsor by at most a few calls
    // per key; the cost is cents and the write is idempotent per doc.
    await db.collection("agentSponsorships").doc(status.key).set(
      {
        callsRemaining: status.callsRemaining - 1,
        callsUsed: (await getUsedCount(status.key)) + 1,
        updatedAt: new Date().toISOString(),
        uid: caller.uid || null,
      },
      { merge: true },
    );
    return { sponsored: true, callsRemaining: status.callsRemaining - 1 };
  } catch {
    return null;
  }
}

async function getUsedCount(key) {
  try {
    const doc = await db.collection("agentSponsorships").doc(key).get();
    return Number(doc.data()?.callsUsed || 0);
  } catch {
    return 0;
  }
}
