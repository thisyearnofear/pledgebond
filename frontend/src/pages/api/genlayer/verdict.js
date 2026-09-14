/**
 * GenLayer Verdict API
 *
 * GET /api/genlayer/verdict?milestoneId=0&contract=0x...
 * Read path for the Underwriter + UI polling.
 */
import { genlayerVerdictService, toCreditSignal, getContractAddress } from '../../../services/GenlayerVerdictService';
import { withAgentAuth } from '../../../lib/agentAuth';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const milestoneId = String(req.query.milestoneId ?? req.query.id ?? '0');
    const contract = String(req.query.contract || getContractAddress());
    const verdict = await genlayerVerdictService.getVerdict(contract, milestoneId);
    return res.status(200).json({ success: true, verdict, creditSignal: toCreditSignal(verdict.verdict), contractAddress: contract });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'GenLayer read failed', details: err.message });
  }
}

export default withAgentAuth(handler);
