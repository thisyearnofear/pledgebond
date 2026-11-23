/**
 * Payout Campaigns — shared domain module for the sponsor-side payout router.
 *
 * A payout campaign is a sponsor's obligation to pay a cohort of recipients
 * (hackathon winners, grantees, contributors). PledgeBond verifies the claim,
 * records the payout instruction, and hands the transfer route to an adapter
 * (MultiHopper on Solana). Sponsor-held funds stay non-custodial: the campaign
 * record tracks the route, it never holds the money.
 *
 * See docs/MULTIHOPPER_PLAN.md.
 */

/**
 * Campaign status machine:
 *
 *   draft → awaiting_funding → approved → routing → partially_settled → settled
 *     ↓           ↓                ↓          ↓            ↓
 *   cancelled  cancelled       cancelled  exception → (back to) routing / approved
 *
 * - `draft`: created by the sponsor, still editable.
 * - `awaiting_funding`: recipients + evidence locked; sponsor is moving funds
 *   into position (non-custodial — we never hold them).
 * - `approved`: approval rule passed (evidence URL + business purpose present,
 *   or an admin approved explicitly). Routes may be created only from here.
 * - `routing`: a route was created and transfers are in flight.
 * - `partially_settled`: some, not all, recipient transfers settled.
 * - `settled`: every recipient transfer settled. Terminal.
 * - `exception`: a route failure that needs operator attention. Can return to
 *   `routing` on retry.
 * - `cancelled`: sponsor or admin cancelled. Terminal.
 */
export const CAMPAIGN_STATUSES = [
  "draft",
  "awaiting_funding",
  "approved",
  "routing",
  "partially_settled",
  "settled",
  "exception",
  "cancelled",
];

/** @type {Record<string, string[]>} */
export const ALLOWED_TRANSITIONS = {
  draft: ["awaiting_funding", "cancelled"],
  awaiting_funding: ["approved", "draft", "cancelled"],
  approved: ["routing", "awaiting_funding", "cancelled"],
  routing: ["partially_settled", "settled", "exception", "cancelled"],
  partially_settled: ["settled", "exception", "routing"],
  exception: ["routing", "cancelled"],
  settled: [],
  cancelled: [],
};

/** Transitions a sponsor may request directly. Anything else is server-driven. */
const SPONSOR_DRIVEN_TARGETS = new Set([
  "awaiting_funding",
  "draft",
  "cancelled",
]);

export const PAYOUT_ASSETS = ["USDC", "SOL"];

/**
 * @param {string} from
 * @param {string} to
 */
export function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

/**
 * Whether a sponsor may drive this transition themselves (vs admin/server).
 * `approved` is admin- or rule-driven; settlement statuses are route-driven.
 * @param {string} to
 */
export function isSponsorDrivenTarget(to) {
  return SPONSOR_DRIVEN_TARGETS.has(to);
}

/**
 * The automatic approval rule: a campaign can pass `awaiting_funding →
 * approved` without an admin only when both an evidence URL and a business
 * purpose are recorded. Genuine-use qualifying volume requires a verifiable
 * business purpose — the same gate the challenge applies to us.
 * @param {object} campaign
 */
export function passesApprovalRule(campaign) {
  return Boolean(
    campaign &&
      typeof campaign.evidenceUrl === "string" &&
      campaign.evidenceUrl.length > 0 &&
      typeof campaign.businessPurpose === "string" &&
      campaign.businessPurpose.trim().length >= 10
  );
}

/**
 * Validate and normalize the POST body for campaign creation.
 * Returns { ok: true, value } or { ok: false, error }.
 * @param {any} body
 */
export function validateCampaignInput(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required" };
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) {
    return { ok: false, error: "title is required (min 3 chars)" };
  }

  const asset = typeof body.asset === "string" ? body.asset.trim().toUpperCase() : "USDC";
  if (!PAYOUT_ASSETS.includes(asset)) {
    return { ok: false, error: `asset must be one of: ${PAYOUT_ASSETS.join(", ")}` };
  }

  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    return { ok: false, error: "recipients must be a non-empty array" };
  }
  if (body.recipients.length > 500) {
    return { ok: false, error: "recipients limited to 500 per campaign" };
  }

  const recipients = [];
  for (let i = 0; i < body.recipients.length; i++) {
    const r = body.recipients[i];
    if (!r || typeof r !== "object") {
      return { ok: false, error: `recipients[${i}] must be an object` };
    }
    const wallet = typeof r.wallet === "string" ? r.wallet.trim() : "";
    if (wallet.length < 32 || wallet.length > 64) {
      return { ok: false, error: `recipients[${i}].wallet is not a valid address` };
    }
    const amount = Number(r.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: `recipients[${i}].amount must be a positive number` };
    }
    recipients.push({
      wallet,
      amount,
      ...(typeof r.note === "string" && r.note.trim() ? { note: r.note.trim() } : {}),
      ...(typeof r.uid === "string" && r.uid ? { uid: r.uid } : {}),
      ...(typeof r.claimId === "string" && r.claimId ? { claimId: r.claimId } : {}),
    });
  }

  const evidenceUrl =
    typeof body.evidenceUrl === "string" && body.evidenceUrl.trim()
      ? body.evidenceUrl.trim()
      : null;
  if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) {
    return { ok: false, error: "evidenceUrl must be an http(s) URL" };
  }

  const businessPurpose =
    typeof body.businessPurpose === "string" ? body.businessPurpose.trim() : "";

  const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0);

  return {
    ok: true,
    value: {
      title,
      asset,
      recipients,
      totalAmount,
      recipientCount: recipients.length,
      evidenceUrl,
      businessPurpose,
    },
  };
}

/**
 * The sponsor-facing projection — the full record is already sponsor-private.
 * @param {string} id
 * @param {object} data
 */
export function campaignView(id, data) {
  return { id, ...data };
}

/**
 * The recipient-facing projection: enough to see that a payment to *their*
 * wallet is coming or settled, without exposing other recipients' wallets,
 * amounts, or the sponsor's notes.
 * @param {string} id
 * @param {object} data
 * @param {string} wallet
 */
export function recipientView(id, data, wallet) {
  const mine = (data.recipients || []).find((r) => r.wallet === wallet) || null;
  const settlement = data.settlement || {};
  const myTransfer = (settlement.transfers || []).find((t) => t.wallet === wallet) || null;
  return {
    id,
    title: data.title,
    asset: data.asset,
    status: data.status,
    sponsorName: data.sponsorName || null,
    recipient: mine ? { wallet: mine.wallet, amount: mine.amount } : null,
    transfer: myTransfer
      ? { status: myTransfer.status, signature: myTransfer.signature || null }
      : null,
    createdAt: data.createdAt,
    settledAt: settlement.settledAt || null,
  };
}
