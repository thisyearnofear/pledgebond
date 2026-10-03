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
 * A global ceiling in `agentSponsorshipGlobal` bounds total sponsored spend
 * regardless of how many callers appear. Set AGENT_SPONSOR_GLOBAL_CAP to a
 * positive integer to enable sponsorship; unset or 0 disables it.
 *
 * Rules:
 *   - Default budget: 3 calls per user (env AGENT_FREE_CALLS overrides).
 *   - Sponsored calls are recorded in agent_runs with sponsored: true so
 *     the economics stay auditable.
 *   - Unauthenticated users get an IP-keyed ephemeral budget of 1.
 *   - Decrement is transactional; no call is served without a reservation.
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
    // Hard global ceiling on total sponsored spend. Even if every per-user
    // budget were bypassed, the platform's exposure stops here.
    const remainingGlobal = await consumeGlobalBudget();
    if (remainingGlobal === null) return null;

    // Atomic decrement inside a transaction: the previous read-then-write
    // could over-sponsor under concurrency, and each sponsored call costs
    // real upstream AI spend.
    const ref = db.collection("agentSponsorships").doc(status.key);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? Number(snap.data().callsRemaining || 0) : DEFAULT_FREE_CALLS;
      if (current <= 0) return null;
      const next = current - 1;
      tx.set(
        ref,
        {
          callsRemaining: next,
          callsUsed: (snap.exists ? Number(snap.data().callsUsed || 0) : 0) + 1,
          updatedAt: new Date().toISOString(),
          uid: caller.uid || null,
        },
        { merge: true },
      );
      return next;
    });

    if (result === null) return null;
    return { sponsored: true, callsRemaining: result };
  } catch {
    return null;
  }
}

/**
 * Reserve one unit of the global sponsored-call budget, atomically.
 * Returns remaining global budget, or null when the ceiling is exhausted.
 */
async function consumeGlobalBudget() {
  const cap = Number(process.env.AGENT_SPONSOR_GLOBAL_CAP || 0);
  // A cap of 0 (or unset) disables global sponsorship entirely rather than
  // defaulting to an unbounded platform liability.
  if (!Number.isFinite(cap) || cap <= 0) return null;

  const ref = db.collection("agentSponsorshipGlobal").doc("budget");
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const used = snap.exists ? Number(snap.data().callsUsed || 0) : 0;
      if (used >= cap) return null;
      const next = used + 1;
      tx.set(
        ref,
        { callsUsed: next, cap, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return cap - next;
    });
  } catch {
    return null;
  }
}
