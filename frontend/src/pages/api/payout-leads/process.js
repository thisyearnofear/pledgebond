/**
 * Process Payout Leads — Cron-friendly endpoint
 *
 * GET /api/payout-leads/process
 *
 * Processes all unverified payout leads and converts them to
 * project hackathon claims. Designed to be called by a Vercel cron.
 * Skips leads that lack enough data (no hackathon name or email).
 *
 * Response:
 * {
 *   processed: number,
 *   skipped: number,
 *   errors: number,
 *   details: [{ leadId, status, projectSlug }]
 * }
 */

import { db } from "../../../lib/firebase/serverOnly";
import { convertLeadToClaim, verifyProjectPayouts } from "../../../lib/payoutLeads";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret && process.env.NODE_ENV === "production") {
    return res.status(503).json({ error: "Cron authentication is not configured" });
  }
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const leadsSnap = await db
      .collection("payoutLeads")
      .where("status", "!=", "verified")
      .get();

    const details = [];
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let totalVerified = 0;

    for (const doc of leadsSnap.docs) {
      const lead = doc.data();
      const leadId = doc.id;

      try {
        if (!lead.hackathonName || !lead.email) {
          skipped++;
          details.push({ leadId, status: "skipped", reason: "missing required fields" });
          continue;
        }

        // Idempotency: skip leads already verified
        if (lead.status === "verified") {
          skipped++;
          details.push({ leadId, status: "skipped", reason: "already verified" });
          continue;
        }

        // Trust gate: require evidence URL (announcement link) before creating
        // a public-facing claim. Without evidence, the claim stays pending
        // and is not surfaced on the leaderboard.
        const evidenceUrl = lead.announcementUrl || lead.evidenceUrl || null;
        if (!evidenceUrl) {
          // Mark as pending — admin can add evidence and re-process
          await db.collection("payoutLeads").doc(leadId).update({
            status: "pending_evidence",
            updatedAt: new Date().toISOString(),
          });
          skipped++;
          details.push({ leadId, status: "skipped", reason: "missing evidence URL" });
          continue;
        }

        // Shared conversion path (same as inline submission + verify route)
        const { slug } = await convertLeadToClaim(doc);

        processed++;
        details.push({ leadId, status: "verified", projectSlug: slug });
      } catch (err) {
        errors++;
        details.push({ leadId, status: "error", error: err.message });
      }
    }

    // ── Pass 2: On-chain payout verification ──────────────────────────
    // For each project with claims that have a payoutTxHash or circleTransferId
    // but haven't been verified yet, run the shared verifier and upgrade
    // the verificationStatus to "payout_verified" when confirmed.
    // Shared with inline submission — the cron is the retry path.
    // Paginated read (S1) — cursor batches bound the read cost per run.
    // The where filter applies in memory per page to avoid needing a new
    // composite index for the cursor path.
    try {
      const PAGE_SIZE = 500;
      let query = db.collection("projects").orderBy("__name__").limit(PAGE_SIZE);
      for (;;) {
        const projectsSnap = await query.get();
        if (projectsSnap.empty) break;

        for (const projectDoc of projectsSnap.docs) {
          const project = projectDoc.data();
          if (!Array.isArray(project.hackathons)) continue;
          const { verifiedCount } = await verifyProjectPayouts(projectDoc.id);
          totalVerified += verifiedCount;
        }

        if (projectsSnap.docs.length < PAGE_SIZE) break;
        const last = projectsSnap.docs[projectsSnap.docs.length - 1];
        query = db.collection("projects").orderBy("__name__").startAfter(last).limit(PAGE_SIZE);
      }
    } catch (verifyErr) {
      console.error("Payout verification pass error:", verifyErr);
      // Non-fatal — the leads were processed, verification can retry next run
    }

    return res.status(200).json({
      success: true,
      total: leadsSnap.size,
      processed,
      skipped,
      errors,
      details,
    });
  } catch (err) {
    console.error("Process payout leads error:", err);
    return res.status(500).json({ error: "Failed to process payout leads" });
  }
}
