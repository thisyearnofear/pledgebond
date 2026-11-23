/**
 * Payout Campaign detail + transitions
 *
 * GET /api/payout-campaigns/[id]              — sponsor/admin: full view
 * GET /api/payout-campaigns/[id]?wallet=<w>   — recipient-facing sanitized view
 * PUT /api/payout-campaigns/[id]              — status transitions + draft edits
 *   body: { action: "submit" | "reopen" | "approve" | "cancel" | "edit", ... }
 *
 * Sponsors drive draft→awaiting_funding→cancelled and draft edits.
 * `approved` requires the automatic approval rule (evidence URL + business
 * purpose) or an admin override — see lib/payoutCampaigns.
 */

import { db, auth } from "../../../lib/firebase/serverOnly";
import { verifyAuth, withApiMiddleware } from "../../../utils/apiMiddleware";
import {
  canTransition,
  isSponsorDrivenTarget,
  passesApprovalRule,
  validateCampaignInput,
  recipientView,
} from "../../../lib/payoutCampaigns";

async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Campaign id is required" });
  }

  const ref = db.collection("payoutCampaigns").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(404).json({ error: "Campaign not found" });
  }
  const campaign = snap.data();

  if (req.method === "GET") {
    // Recipient-facing status: a wallet matching a recipient gets a sanitized
    // view without sponsor-private data (other recipients, notes, internals).
    const wallet = typeof req.query.wallet === "string" ? req.query.wallet.trim() : null;
    if (wallet) {
      const isRecipient = (campaign.recipients || []).some((r) => r.wallet === wallet);
      if (!isRecipient) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      return res.status(200).json({ campaign: recipientView(snap.id, campaign, wallet) });
    }

    const ctx = await getCaller(req);
    if (!ctx) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!ctx.isAdmin && campaign.sponsorUid !== ctx.userId) {
      return res.status(403).json({ error: "Not your campaign" });
    }
    return res.status(200).json({ campaign: { id: snap.id, ...campaign } });
  }

  // PUT — transitions and edits
  const ctx = await getCaller(req);
  if (!ctx) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const isSponsor = campaign.sponsorUid === ctx.userId;
  if (!isSponsor && !ctx.isAdmin) {
    return res.status(403).json({ error: "Not your campaign" });
  }

  const { action } = req.body || {};

  if (action === "edit") {
    if (campaign.status !== "draft") {
      return res.status(409).json({ error: "Only draft campaigns can be edited" });
    }
    const check = validateCampaignInput(req.body.campaign);
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }
    await ref.update({ ...check.value, updatedAt: new Date().toISOString() });
    return res.status(200).json({ success: true, status: "draft" });
  }

  const TARGETS = { submit: "awaiting_funding", reopen: "draft", approve: "approved", cancel: "cancelled" };
  const target = TARGETS[action];
  if (!target) {
    return res.status(400).json({ error: 'action must be one of: "submit" | "reopen" | "approve" | "cancel" | "edit"' });
  }
  if (!canTransition(campaign.status, target)) {
    return res.status(409).json({ error: `Cannot move ${campaign.status} → ${target}` });
  }

  if (target === "approved") {
    // Approval rule: evidence + business purpose lets a sponsor self-serve;
    // otherwise an admin must approve explicitly.
    if (!ctx.isAdmin && !passesApprovalRule(campaign)) {
      return res.status(422).json({
        error: "Approval requires an evidence URL and a business purpose (min 10 chars)",
      });
    }
  } else if (isSponsor && !isSponsorDrivenTarget(target)) {
    return res.status(403).json({ error: "Sponsors cannot drive this transition" });
  }

  const now = new Date().toISOString();
  const update = { status: target, updatedAt: now };
  if (target === "approved") {
    update.approval = { approvedBy: ctx.userId, approvedAt: now, auto: !ctx.isAdmin };
  }
  await ref.update(update);
  return res.status(200).json({ success: true, status: target });
}

async function getCaller(req) {
  try {
    const userId = await verifyAuth(req, auth);
    const adminSnap = await db.collection("admins").doc(userId).get();
    return { userId, isAdmin: adminSnap.exists };
  } catch {
    return null;
  }
}

export default withApiMiddleware(handler, {
  allowedMethods: ["GET", "PUT"],
  rateLimit: 30,
  rateLimitKey: "PAYOUT_CAMPAIGN_DETAIL",
});
