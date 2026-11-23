/**
 * Payout Campaign route lifecycle
 *
 * POST /api/payout-campaigns/[id]/route — create the MultiHopper route for an
 *   approved campaign. Moves status → routing and records the route + pending
 *   per-recipient transfers.
 * GET  /api/payout-campaigns/[id]/route — reconcile route status against the
 *   provider and advance the campaign (routing → partially_settled → settled,
 *   or → exception). Sponsor/admin only.
 *
 * The campaign record only ever stores: integration id, route id, destination
 * wallets, public tx signatures, status, failure data. Funds stay with the
 * sponsor's route — PledgeBond never custodies them.
 */

import { db, auth } from "../../../../lib/firebase/serverOnly";
import { verifyAuth, withApiMiddleware } from "../../../../utils/apiMiddleware";
import { logActivity } from "../../../../utils/activityLogger";
import {
  createRoute,
  getRouteStatus,
  isConfigured,
} from "../../../../services/MultiHopperService";

async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Campaign id is required" });
  }

  let userId;
  try {
    userId = await verifyAuth(req, auth);
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
  const adminSnap = await db.collection("admins").doc(userId).get();
  const isAdmin = adminSnap.exists;

  const ref = db.collection("payoutCampaigns").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(404).json({ error: "Campaign not found" });
  }
  const campaign = snap.data();
  if (!isAdmin && campaign.sponsorUid !== userId) {
    return res.status(403).json({ error: "Not your campaign" });
  }

  if (req.method === "POST") {
    return handleCreateRoute(req, res, ref, snap.id, campaign);
  }
  return handleReconcile(res, ref, snap.id, campaign);
}

async function handleCreateRoute(req, res, ref, campaignId, campaign) {
  if (!["approved", "exception"].includes(campaign.status)) {
    return res.status(409).json({
      error: `Campaign must be approved before routing (current: ${campaign.status})`,
    });
  }
  if (!isConfigured()) {
    return res.status(503).json({
      error: "Payout routing is not configured — MultiHopper onboarding incomplete",
    });
  }

  let route;
  try {
    route = await createRoute({
      campaignId,
      asset: campaign.asset,
      recipients: campaign.recipients,
      businessPurpose: campaign.businessPurpose || campaign.title,
    });
  } catch (err) {
    // Fail closed: record the exception so the sponsor sees it, never pretend
    // the route exists.
    const now = new Date().toISOString();
    await ref.update({
      status: "exception",
      "route.failure": String(err.message || err),
      updatedAt: now,
    });
    await logActivity({
      type: "payout_exception",
      userId: campaign.sponsorUid,
      userHandle: campaign.sponsorName || campaign.sponsorUid,
      description: `Payout route failed for "${campaign.title}": ${err.message}`,
      metadata: { campaignId, routeId: campaign.route?.routeId || null },
    });
    return res.status(502).json({ error: "Route creation failed", detail: err.message });
  }

  const now = new Date().toISOString();
  await ref.update({
    status: "routing",
    route: { ...route, failure: null },
    settlement: {
      transfers: campaign.recipients.map((r) => ({
        wallet: r.wallet,
        amount: r.amount,
        status: "pending",
        signature: null,
      })),
      settledCount: 0,
      settledAmount: 0,
      settledAt: null,
      updatedAt: now,
    },
    updatedAt: now,
  });

  await logActivity({
    type: "payout_routed",
    userId: campaign.sponsorUid,
    userHandle: campaign.sponsorName || campaign.sponsorUid,
    description: `Payout route created for "${campaign.title}" — ${campaign.recipientCount} recipient(s), ${campaign.totalAmount} ${campaign.asset}`,
    amount: campaign.totalAmount,
    metadata: { campaignId, routeId: route.routeId, routeType: route.routeType, mock: route.mock },
  });

  return res.status(200).json({ success: true, status: "routing", route });
}

async function handleReconcile(res, ref, campaignId, campaign) {
  if (!campaign.route || !campaign.route.routeId) {
    return res.status(200).json({ status: campaign.status, route: null, settlement: campaign.settlement });
  }
  if (["settled", "cancelled", "draft", "awaiting_funding"].includes(campaign.status)) {
    return res.status(200).json({ status: campaign.status, route: campaign.route, settlement: campaign.settlement });
  }

  let result;
  try {
    result = await getRouteStatus(campaign.route, campaign.recipients || []);
  } catch (err) {
    return res.status(502).json({ error: "Route status check failed", detail: err.message });
  }

  const settledTransfers = result.transfers.filter((t) => t.status === "settled");
  const settledAmount = settledTransfers.reduce((s, t) => s + t.amount, 0);
  const total = (campaign.recipients || []).length;
  const now = new Date().toISOString();

  let status = campaign.status;
  if (result.status === "failed") {
    status = "exception";
  } else if (settledTransfers.length >= total && total > 0) {
    status = "settled";
  } else if (settledTransfers.length > 0 || result.status === "settling") {
    status = settledTransfers.length > 0 ? "partially_settled" : "routing";
  }

  const wasSettled = campaign.status === "settled";

  await ref.update({
    status,
    "route.status": result.status === "failed" ? "failed" : status === "settled" ? "settled" : result.status,
    settlement: {
      transfers: result.transfers,
      settledCount: settledTransfers.length,
      settledAmount,
      settledAt: status === "settled" ? campaign.settlement?.settledAt || now : null,
      updatedAt: now,
    },
    updatedAt: now,
  });

  if (status === "settled" && !wasSettled) {
    await logActivity({
      type: "payout_settled",
      userId: campaign.sponsorUid,
      userHandle: campaign.sponsorName || campaign.sponsorUid,
      description: `Payout settled for "${campaign.title}" — ${settledTransfers.length}/${total} recipient(s), ${settledAmount} ${campaign.asset}`,
      amount: settledAmount,
      metadata: { campaignId, routeId: campaign.route.routeId, signatures: result.signatures },
    });
  } else if (status === "exception" && campaign.status !== "exception") {
    await logActivity({
      type: "payout_exception",
      userId: campaign.sponsorUid,
      userHandle: campaign.sponsorName || campaign.sponsorUid,
      description: `Payout route failed for "${campaign.title}"`,
      metadata: { campaignId, routeId: campaign.route.routeId },
    });
  }

  return res.status(200).json({
    status,
    route: { ...campaign.route, status: result.status },
    settlement: {
      transfers: result.transfers,
      settledCount: settledTransfers.length,
      settledAmount,
      settledAt: status === "settled" ? now : null,
    },
  });
}

export default withApiMiddleware(handler, {
  allowedMethods: ["GET", "POST"],
  rateLimit: 20,
  rateLimitKey: "PAYOUT_CAMPAIGN_ROUTE",
});
