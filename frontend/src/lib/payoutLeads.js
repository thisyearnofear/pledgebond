/**
 * Shared payout-lead → project-claim conversion.
 *
 * Single source of truth for the lead→claim schema, used by:
 *   - POST /api/payout-leads       (inline conversion when evidence present)
 *   - POST /api/payout-leads/verify (admin/manual conversion)
 *   - GET  /api/payout-leads/process (cron fallback)
 *
 * This is the P4 "one door" fix: every path that converts a lead uses
 * the same slug scheme, claim shape, and idempotency rules.
 */

import { db } from "./firebase/serverOnly";

/**
 * Convert a payout lead into a project hackathon claim.
 * Idempotent per lead: re-running replaces the claim it created.
 *
 * @param {{ id: string, data: object }} leadDoc — Firestore payoutLeads doc
 * @returns {Promise<{ slug: string, claim: object, created: boolean }>}
 */
export async function convertLeadToClaim(leadDoc) {
  const leadId = leadDoc.id;
  const lead = leadDoc.data();

  if (!lead.hackathonName) {
    throw new Error("Lead missing hackathonName");
  }

  const slug =
    lead.hackathonName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + `-lead-${leadId.slice(0, 8)}`;

  const evidenceUrl = lead.announcementUrl || lead.evidenceUrl || null;

  const claim = {
    name: lead.hackathonName,
    outcome: "winner",
    prizeAmount: lead.prizeAmount || 0,
    hackathonEndDate: new Date().toISOString(),
    payoutAt: null,
    payoutVerifiedAt: null,
    // Trust gate: without evidence the claim stays "pending" and never
    // surfaces on the public leaderboard. With evidence it becomes
    // "evidence_attached" — visible, pending on-chain confirmation.
    verificationStatus: evidenceUrl ? "evidence_attached" : "pending",
    evidenceUrl,
    source: "payout-lead",
    leadId,
    submittedAt: lead.createdAt || new Date().toISOString(),
  };

  const projectRef = db.collection("projects").doc(slug);
  const projectSnap = await projectRef.get();

  if (!projectSnap.exists) {
    await projectRef.set({
      slug,
      name: `${lead.hackathonName} Winner`,
      owner: lead.email ? lead.email.split("@")[0] : "anonymous",
      submittedBy: lead.email ? lead.email.split("@")[0] : "anonymous",
      ecosystem: "arc",
      hackathons: [claim],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    const existing = projectSnap.data();
    const hackathons = Array.isArray(existing.hackathons) ? [...existing.hackathons] : [];
    const idx = hackathons.findIndex((h) => h.leadId === leadId);
    if (idx >= 0) hackathons[idx] = claim;
    else hackathons.push(claim);
    await projectRef.update({
      hackathons,
      updatedAt: new Date().toISOString(),
    });
  }

  await db.collection("payoutLeads").doc(leadId).update({
    status: "verified",
    verifiedAt: new Date().toISOString(),
    projectSlug: slug,
  });

  return { slug, claim, created: !projectSnap.exists };
}

/**
 * Run on-chain payout verification for a project's claims that have a
 * payoutTxHash or circleTransferId but are not yet payout_verified.
 * Best-effort: returns verified claim updates, never throws.
 *
 * Used inline at lead submission and by the daily cron as retry.
 *
 * @param {string} projectSlug
 * @returns {Promise<{ verifiedCount: number, updatedClaims: object[] }>}
 */
export async function verifyProjectPayouts(projectSlug) {
  const { payoutVerifierService } = await import("../services/PayoutVerifierService");
  const { logActivity } = await import("../utils/activityLogger");
  const projectRef = db.collection("projects").doc(projectSlug);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) return { verifiedCount: 0, updatedClaims: [] };

  const project = projectSnap.data();
  if (!Array.isArray(project.hackathons)) {
    return { verifiedCount: 0, updatedClaims: [] };
  }

  let modified = false;
  const updatedClaims = await Promise.all(
    project.hackathons.map(async (claim) => {
      if (claim.verificationStatus === "payout_verified") return claim;
      if (!claim.payoutTxHash && !claim.circleTransferId) return claim;

      try {
        const result = await payoutVerifierService.verify({
          hackathonName: claim.name,
          winnerAddress: claim.payoutWallet || claim.winnerAddress || "0x0",
          expectedAmount: claim.prizeAmount || 0,
          payoutTxHash: claim.payoutTxHash,
          circleTransferId: claim.circleTransferId,
          chainId: claim.chainId,
        });

        if (result.result?.verified) {
          modified = true;
          const verifiedClaim = {
            ...claim,
            verificationStatus: "payout_verified",
            payoutVerifiedAt: result.result.payoutTimestamp || new Date().toISOString(),
            payoutActualAmount: result.result.actualAmount,
          };

          const builderUid = project.submittedBy || project.owner;
          if (builderUid) {
            logActivity({
              type: "payout_verified",
              userId: builderUid,
              userHandle: builderUid,
              description: `Payout verified for ${claim.name} — ${result.result.actualAmount || claim.prizeAmount || 0} USDC confirmed on-chain.`,
              metadata: {
                hackathonName: claim.name,
                amount: result.result.actualAmount || claim.prizeAmount || 0,
                projectSlug,
                ecosystem: project.ecosystem,
                txHash: result.result.payoutTxHash,
              },
            }).catch(() => {});
          }

          return verifiedClaim;
        }
      } catch {
        // Verification failed — cron retries later.
      }
      return claim;
    }),
  );

  if (modified) {
    await projectRef.update({
      hackathons: updatedClaims,
      updatedAt: new Date().toISOString(),
    });
  }

  const verifiedCount = updatedClaims.filter(
    (c) => c.verificationStatus === "payout_verified",
  ).length;

  return { verifiedCount, updatedClaims };
}
