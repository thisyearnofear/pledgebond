/**
 * Payout Campaigns API
 *
 * GET  /api/payout-campaigns          — list the caller's campaigns (admin: ?all=1)
 * POST /api/payout-campaigns          — create a draft campaign
 *
 * Authenticated (Firebase ID token). Sponsors only ever see their own
 * campaigns; admins can list everything. See docs/MULTIHOPPER_PLAN.md.
 */

import { db, auth } from "../../../lib/firebase/serverOnly";
import { verifyAuth, withApiMiddleware } from "../../../utils/apiMiddleware";
import { validateCampaignInput } from "../../../lib/payoutCampaigns";

async function handler(req, res) {
  let userId;
  try {
    userId = await verifyAuth(req, auth);
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }

  const adminSnap = await db.collection("admins").doc(userId).get();
  const isAdmin = adminSnap.exists;

  if (req.method === "GET") {
    return handleList(req, res, userId, isAdmin);
  }
  return handleCreate(req, res, userId, isAdmin);
}

async function handleList(req, res, userId, isAdmin) {
  let query = db.collection("payoutCampaigns").limit(100);
  if (!(isAdmin && req.query.all === "1")) {
    query = db.collection("payoutCampaigns").where("sponsorUid", "==", userId).limit(100);
  }

  const snap = await query.get();
  const campaigns = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    // Sorted in memory — avoids a composite index for a low-volume collection
    // (same convention as /api/follows).
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return res.status(200).json({ campaigns });
}

async function handleCreate(req, res, userId) {
  const check = validateCampaignInput(req.body);
  if (!check.ok) {
    return res.status(400).json({ error: check.error });
  }

  // Sponsor display name for recipient-facing status pages
  let sponsorName = null;
  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (userSnap.exists) {
      const u = userSnap.data();
      sponsorName = u.displayName || u.githubUsername || null;
    }
  } catch {
    // Non-fatal — sponsor name is cosmetic
  }

  const now = new Date().toISOString();
  const doc = {
    ...check.value,
    sponsorUid: userId,
    sponsorName,
    status: "draft",
    approval: null,
    route: null,
    settlement: { transfers: [], settledCount: 0, settledAmount: 0, settledAt: null },
    createdAt: now,
    updatedAt: now,
  };

  const ref = await db.collection("payoutCampaigns").add(doc);
  return res.status(201).json({ success: true, campaignId: ref.id, status: "draft" });
}

export default withApiMiddleware(handler, {
  allowedMethods: ["GET", "POST"],
  rateLimit: 20,
  rateLimitKey: "PAYOUT_CAMPAIGNS",
});
