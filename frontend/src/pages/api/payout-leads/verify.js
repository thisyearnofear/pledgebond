/**
 * Payout Lead Verification API
 *
 * POST /api/payout-leads/verify
 *
 * Converts a payout lead into a project hackathon claim in Firestore.
 * This is how user-submitted payout data feeds into the leaderboard.
 * Optionally triggers the Scout agent to verify the payout.
 *
 * Body:
 * {
 *   leadId: string,           // Firestore doc ID from payoutLeads collection
 *   projectSlug?: string,     // Existing project slug to attach claim to
 *   projectName?: string,     // New project name (created if no slug given)
 *   builderEmail?: string,    // Email to look up existing builder
 *   triggerVerification?: boolean  // Whether to run agent verification (default false)
 * }
 */

import { db } from "../../../lib/firebase/serverOnly";
import { withAgentAuth } from "../../../lib/agentAuth";
import { convertLeadToClaim } from "../../../lib/payoutLeads";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { leadId, projectSlug, projectName, triggerVerification } = req.body;

    if (!leadId) {
      return res.status(400).json({ error: "leadId is required" });
    }

    // 1. Fetch the payout lead
    const leadDoc = await db.collection("payoutLeads").doc(leadId).get();
    if (!leadDoc.exists) {
      return res.status(404).json({ error: "Payout lead not found" });
    }
    const lead = leadDoc.data();

    // Idempotency: if lead is already verified, don't duplicate the claim
    if (lead.status === "verified") {
      return res.status(409).json({ error: "This lead has already been verified", projectSlug: lead.projectSlug || null });
    }

    // 2-4. Convert via the shared path (same slug scheme + claim shape
    // as inline submission and cron processing)
    const { slug, claim } = await convertLeadToClaim(leadDoc);

    const result = {
      success: true,
      projectSlug: slug,
      claim,
      leadProcessed: true,
    };

    // 5. Optionally trigger agent verification
    if (triggerVerification && lead.prizeAmount) {
      try {
        const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/agent/payout-verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.AGENT_API_KEY ? { "x-api-key": process.env.AGENT_API_KEY } : {}),
          },
          body: JSON.stringify({
            projectSlug: slug,
            hackathonClaimIndex: 0,
            winnerAddress: lead.wallet || "0x0000000000000000000000000000000000000000",
            expectedAmount: lead.prizeAmount,
          }),
        });
        const verifyData = await verifyRes.json();
        result.verification = verifyData;
      } catch (agentErr) {
        result.verification = { error: "Agent verification skipped", details: agentErr.message };
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("Payout lead verification error:", err);
    return res.status(500).json({ error: "Failed to verify payout lead", details: err.message });
  }
}

export default withAgentAuth(handler);
