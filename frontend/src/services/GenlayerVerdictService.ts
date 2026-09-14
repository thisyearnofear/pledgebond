/**
 * GenlayerVerdictService
 *
 * Reads GenLayer MilestoneArbiter verdicts (DELIVERED / NOT_DELIVERED /
 * INCONCLUSIVE) and maps them into PledgeBond's VerificationResult shape so
 * the existing attestation + leaderboard pipeline can consume them with
 * provider: 'genlayer'.
 *
 * Transport is plain JSON-RPC over GENLAYER_RPC_URL so no new SDK dep is
 * needed. Set GENLAYER_MOCK=true for deterministic offline verdicts.
 */

export type GenlayerVerdictValue = 'DELIVERED' | 'NOT_DELIVERED' | 'INCONCLUSIVE' | 'PENDING';

export interface GenlayerVerdict {
  milestoneId: string;
  verdict: GenlayerVerdictValue;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | '';
  reason: string;
  contractAddress: string;
  txHash: string | null;
  resolvedAt: string | null;
  mock?: boolean;
}

export interface GenlayerSubmitInput {
  description: string;
  evidenceUrl: string;
  criteria?: string;
  projectSlug?: string;
}

function env(name: string): string | undefined {
  try {
    return typeof process !== 'undefined' ? process.env?.[name] : undefined;
  } catch {
    return undefined;
  }
}

export function isGenlayerMock(): boolean {
  return env('GENLAYER_MOCK') === 'true' || !env('GENLAYER_RPC_URL');
}

export function getContractAddress(): string {
  return env('GENLAYER_CONTRACT_ADDRESS') || 'mock-genlayer-contract';
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const rpcUrl = env('GENLAYER_RPC_URL');
  if (!rpcUrl) throw new Error('GENLAYER_RPC_URL is not configured');
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`GenLayer RPC failed: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error?.message || 'GenLayer RPC error');
  return data?.result;
}

export function mockVerdict(milestoneId: string, evidenceUrl = ''): GenlayerVerdict {
  const negative = /empty|missing|todo|placeholder/i.test(evidenceUrl);
  return {
    milestoneId,
    verdict: negative ? 'NOT_DELIVERED' : 'DELIVERED',
    confidence: 'HIGH',
    reason: 'Mock verdict: set GENLAYER_RPC_URL for live consensus.',
    contractAddress: getContractAddress(),
    txHash: null,
    resolvedAt: new Date().toISOString(),
    mock: true,
  };
}

/** Read a verdict view from the MilestoneArbiter contract. */
export async function getVerdict(contractAddress: string, milestoneId: string): Promise<GenlayerVerdict> {
  if (isGenlayerMock()) return mockVerdict(milestoneId);
  const result = (await rpcCall('genlayer_getVerdict', [contractAddress, milestoneId])) as GenlayerVerdict;
  return { ...result, contractAddress, milestoneId };
}

/** Full milestone record (description, evidence, verdict, reason). */
export async function getMilestone(contractAddress: string, milestoneId: string): Promise<Record<string, unknown>> {
  if (isGenlayerMock()) {
    const v = mockVerdict(milestoneId);
    return { id: milestoneId, verdict: v.verdict, confidence: v.confidence, reason: v.reason, finalized: true };
  }
  return (await rpcCall('genlayer_getMilestone', [contractAddress, milestoneId])) as Record<string, unknown>;
}

/** Submit + resolve in one step; returns the stored verdict. */
export async function submitAndResolve(input: GenlayerSubmitInput): Promise<GenlayerVerdict> {
  const contractAddress = getContractAddress();
  if (isGenlayerMock()) return mockVerdict('0', input.evidenceUrl);
  const result = (await rpcCall('genlayer_submitAndResolve', [
    contractAddress,
    input.description,
    input.evidenceUrl,
    input.criteria || 'Work is complete and demonstrable.',
  ])) as GenlayerVerdict;
  return { ...result, contractAddress };
}

/** Map a GenLayer verdict onto the credit signal consumed by the Underwriter. */
export function toCreditSignal(verdict: GenlayerVerdictValue): { boost: number; label: string } {
  switch (verdict) {
    case 'DELIVERED':
      return { boost: 15, label: 'genlayer_delivered' };
    case 'NOT_DELIVERED':
      return { boost: -25, label: 'genlayer_not_delivered' };
    default:
      return { boost: 0, label: 'genlayer_inconclusive' };
  }
}

export const genlayerVerdictService = { getVerdict, getMilestone, submitAndResolve, toCreditSignal, isGenlayerMock, getContractAddress };
export default genlayerVerdictService;
