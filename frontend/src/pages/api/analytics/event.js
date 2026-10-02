/**
 * Analytics event ingestion.
 *
 * POST /api/analytics/event
 *
 * General analytics events: validated, logged, not persisted.
 * funnel_step events: persisted to the `funnelEvents` Firestore
 * collection (rules-locked, server-SDK writes only) so step
 * abandonment can be analyzed. Storage stays bounded to the
 * funnels we deliberately instrument.
 *
 * Never blocks or fails the caller's flow beyond a 4xx on bad input.
 */

import { db } from "../../../lib/firebase/serverOnly";

const MAX_PROPERTIES_BYTES = 4 * 1024; // 4 KB
const ALLOWED_FUNNELS = new Set(["login", "payout_lead", "winner_claim", "backing"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { event, properties, timestamp, url } = req.body;

  if (!event || typeof event !== "string") {
    return res.status(400).json({ error: "Event name is required" });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[analytics]", event, properties);
  }

  if (event !== "funnel_step") {
    return res.status(200).json({ success: true });
  }

  // ── Funnel event persistence ────────────────────────────────────────
  const { funnel, step, funnelId } = properties || {};
  if (!funnel || !ALLOWED_FUNNELS.has(funnel)) {
    return res.status(400).json({ error: "Unknown funnel" });
  }
  if (!step || typeof step !== "string" || step.length > 64) {
    return res.status(400).json({ error: "Invalid step" });
  }

  // Drop sensitive/large payloads rather than rejecting — the caller
  // treats tracking as fire-and-forget and a retry would not help.
  let safeProperties = {};
  try {
    const filtered = {};
    for (const key of ["funnel", "step", "funnelId", "role", "outcome", "hasEvidence", "projectId", "error"]) {
      if (properties[key] !== undefined) filtered[key] = properties[key];
    }
    if (JSON.stringify(filtered).length > MAX_PROPERTIES_BYTES) {
      filtered.extra = "dropped";
    }
    safeProperties = filtered;
  } catch {
    safeProperties = { funnel, step };
  }

  try {
    await db.collection("funnelEvents").add({
      event,
      ...safeProperties,
      clientTimestamp: typeof timestamp === "number" ? new Date(timestamp).toISOString() : null,
      url: typeof url === "string" ? url.slice(0, 256) : null,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Persistence failure must never surface to the user.
    console.warn("[analytics] funnel event persist failed:", err.message);
  }

  return res.status(200).json({ success: true });
}
