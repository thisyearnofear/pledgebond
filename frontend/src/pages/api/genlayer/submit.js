/**
 * GenLayer Submit API
 *
 * POST /api/genlayer/submit
 * Body: { description, evidenceUrl, criteria?, projectSlug? }
 * Submits a milestone to the MilestoneArbiter contract and resolves it via
 * validator consensus, then records a provider:'genlayer' attestation.
 */
import { logActivity } from '../../../utils/activityLogger';
import { genlayerVerdictService, toCreditSignal, getContractAddress } from '../../../services/GenlayerVerdictService';
import { withAgentAuth } from '../../../lib/agentAuth';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { description, evidenceUrl, criteria, projectSlug } = req.body || {};
    if (!description || !evidenceUrl) {
      return res.status(400).json({ error: 'description and evidenceUrl are required' });
    }
    const verdict = await genlayerVerdictService.submitAndResolve({ description, evidenceUrl, criteria, projectSlug });
    const signal = toCreditSignal(verdict.verdict);

    let attestationId;
    try {
      const { db } = await import('@/lib/firebase/serverOnly');
      const doc = await db.collection('payoutAttestations').add({
        projectSlug: (projectSlug || 'genlayer-demo').toLowerCase(),
        hackathonName: 'GenLayer Agent Tank',
        winnerAddress: verdict.contractAddress,
        expectedAmount: 0,
        verification: {
          verified: verdict.verdict === 'DELIVERED',
          provider: 'genlayer',
          actualAmount: null,
          payoutTimestamp: verdict.resolvedAt,
          payoutTxHash: verdict.txHash,
          senderAddress: verdict.contractAddress,
          confidence: verdict.confidence === 'HIGH' ? 'high' : verdict.confidence === 'MEDIUM' ? 'medium' : 'low',
          details: `GenLayer jury: ${verdict.verdict} — ${verdict.reason}`,
        },
        attestorType: 'agent',
        attestedAt: new Date().toISOString(),
        sourceTxHash: verdict.txHash,
        genlayer: { ...verdict, creditSignal: signal },
      });
      attestationId = doc.id;
    } catch (err) {
      console.warn('Failed to record genlayer attestation:', err);
    }

    await logActivity({
      type: verdict.verdict === 'DELIVERED' ? 'milestone_verified' : 'payout_verification_failed',
      projectSlug: projectSlug || 'genlayer-demo',
      userHandle: 'genlayer-jury-agent',
      description: `GenLayer verdict: ${verdict.verdict} (${verdict.confidence}) — ${verdict.reason}`,
      metadata: { ...verdict, creditSignal: signal, attestationId, contractAddress: getContractAddress() },
    });

    return res.status(200).json({ success: true, verdict, creditSignal: signal, attestationId, contractAddress: getContractAddress() });
  } catch (err) {
    console.error('GenLayer submit error:', err);
    return res.status(500).json({ success: false, error: 'GenLayer resolution failed', details: err.message });
  }
}

export default withAgentAuth(handler);
