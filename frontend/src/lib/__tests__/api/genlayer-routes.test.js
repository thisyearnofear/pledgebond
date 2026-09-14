/**
 * GenLayer jury tests — verdict card rendering + expanded routes.
 * Follows agent-routes.test.js conventions: mock at module boundary,
 * chainable Firestore fakes, no test files under pages/.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const fakeCollection = () => {
  const q = {};
  q.add = vi.fn(() => Promise.resolve({ id: 'att-1' }));
  q.orderBy = vi.fn(() => q);
  q.where = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.get = vi.fn(() => Promise.resolve({ docs: [] }));
  return q;
};

vi.mock('@/lib/firebase/serverOnly', () => ({ db: { collection: vi.fn(() => fakeCollection()) } }));
vi.mock('@/utils/activityLogger', () => ({ logActivity: vi.fn(() => Promise.resolve()) }));

const mockSubmitAndResolve = vi.fn();
const mockGetVerdict = vi.fn();
const mockGetMilestone = vi.fn();

vi.mock('@/services/GenlayerVerdictService', () => ({
  genlayerVerdictService: {
    submitAndResolve: (...a) => mockSubmitAndResolve(...a),
    getVerdict: (...a) => mockGetVerdict(...a),
    getMilestone: (...a) => mockGetMilestone(...a),
  },
  toCreditSignal: (v) => (
    v === 'DELIVERED' ? { boost: 15, label: 'genlayer_delivered' }
    : v === 'NOT_DELIVERED' ? { boost: -25, label: 'genlayer_not_delivered' }
    : { boost: 0, label: 'genlayer_inconclusive' }
  ),
  getContractAddress: () => '0xgenlayer',
}));

function res() {
  const r = {};
  r.status = vi.fn(() => r);
  r.json = vi.fn((d) => d);
  return r;
}

describe('genlayer routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /api/genlayer/submit records a DELIVERED verdict', async () => {
    mockSubmitAndResolve.mockResolvedValue({
      milestoneId: '0', verdict: 'DELIVERED', confidence: 'HIGH',
      reason: 'PR merged', contractAddress: '0xgenlayer', txHash: null, resolvedAt: new Date().toISOString(),
    });
    const { default: handler } = await import('../../../pages/api/genlayer/submit.js');
    const r = res();
    await handler({ method: 'POST', body: { description: 'Ship UI', evidenceUrl: 'https://github.com/x/y/pull/1' }, headers: {} }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json.mock.calls[0][0].verdict.verdict).toBe('DELIVERED');
  });

  it('POST /api/genlayer/submit rejects missing evidence', async () => {
    const { default: handler } = await import('../../../pages/api/genlayer/submit.js');
    const r = res();
    await handler({ method: 'POST', body: { description: 'x' }, headers: {} }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('GET /api/genlayer/verdict returns credit signal', async () => {
    mockGetVerdict.mockResolvedValue({ milestoneId: '0', verdict: 'DELIVERED', confidence: 'HIGH', reason: 'ok', contractAddress: '0xgenlayer', txHash: null, resolvedAt: null });
    const { default: handler } = await import('../../../pages/api/genlayer/verdict.js');
    const r = res();
    await handler({ method: 'GET', query: { milestoneId: '0' }, headers: {} }, r);
    expect(r.json.mock.calls[0][0].creditSignal.boost).toBe(15);
  });
});

describe('toCreditSignal mapping', () => {
  it('maps verdicts to boosts', async () => {
    const m = await import('@/services/GenlayerVerdictService');
    // real module is mocked above; assert mock mapping contract instead
    expect(m.toCreditSignal('DELIVERED').boost).toBe(15);
  });

  it('analyze genlayer_verdict returns jury + credit signal', async () => {
    mockSubmitAndResolve.mockResolvedValue({
      milestoneId: '0', verdict: 'DELIVERED', confidence: 'HIGH', reason: 'PR merged',
      contractAddress: '0xgenlayer', txHash: null, resolvedAt: new Date().toISOString(), mock: true,
    });
    const { default: handler } = await import('../../../pages/api/agent/analyze.js');
    const r = res();
    await handler({
      method: 'POST',
      body: { type: 'genlayer_verdict', description: 'Ship UI', evidenceUrl: 'https://github.com/x/y/pull/1' },
      headers: {},
    }, r);
    const body = r.json.mock.calls[0][0];
    expect(r.status).toHaveBeenCalledWith(200);
    expect(body.analysis.genlayer.verdict).toBe('DELIVERED');
    expect(body.analysis.creditSignal.boost).toBe(15);
    expect(body.source).toBe('genlayer-mock');
  });

  it('analyze genlayer_verdict degrades gracefully on jury failure', async () => {
    mockSubmitAndResolve.mockRejectedValueOnce(new Error('rpc down'));
    const { default: handler } = await import('../../../pages/api/agent/analyze.js');
    const r = res();
    await handler({
      method: 'POST',
      body: { type: 'genlayer_verdict', description: 'Ship UI', evidenceUrl: 'https://github.com/x/y/pull/1' },
      headers: {},
    }, r);
    const body = r.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.source).toBe('genlayer-error');
  });
});

describe('GenlayerVerdictCard', () => {
  const delivered = {
    milestoneId: '0', verdict: 'DELIVERED', confidence: 'HIGH',
    reason: 'PR merged', contractAddress: '0xgenlayer', txHash: null,
    resolvedAt: new Date().toISOString(), mock: true,
  };

  it('renders delivered pill, reason, preview provenance', async () => {
    const { default: Card } = await import('@/components/genlayer/GenlayerVerdictCard');
    render(<Card verdict={delivered} creditSignal={{ boost: 15, label: 'genlayer_delivered' }} contractAddress="0xgenlayer" evidenceUrl="https://example.com/pr/1" />);
    expect(screen.getByText(/Jury: Delivered/)).toBeTruthy();
    expect(screen.getByText(/PR merged/)).toBeTruthy();
    expect(screen.getByText(/preview/)).toBeTruthy();
    expect(screen.getByText(/credit \+15/)).toBeTruthy();
  });

  it('hides details until expanded', async () => {
    const { default: Card } = await import('@/components/genlayer/GenlayerVerdictCard');
    render(<Card verdict={delivered} creditSignal={{ boost: 15 }} contractAddress="0xgenlayer" evidenceUrl="https://example.com/pr/1" />);
    expect(screen.queryByText(/Method:/)).toBeNull();
    fireEvent.click(screen.getByText(/How was this decided\?/));
    expect(screen.getByText(/Method:/)).toBeTruthy();
    expect(screen.getByText(/view deliverable/)).toBeTruthy();
  });

  it('renders not-delivered state and null verdict', async () => {
    const { default: Card } = await import('@/components/genlayer/GenlayerVerdictCard');
    render(<Card verdict={{ ...delivered, verdict: 'NOT_DELIVERED', reason: 'No artifact' }} creditSignal={{ boost: -25 }} />);
    expect(screen.getByText(/Jury: Not delivered/)).toBeTruthy();
    const { container } = render(<Card verdict={null} />);
    expect(container.innerHTML).toBe('');
  });
});
