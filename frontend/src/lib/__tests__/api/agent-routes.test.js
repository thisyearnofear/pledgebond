/**
 * API Route Tests for Agent Endpoints
 * Tests response contracts for chat, scout, underwrite, verify endpoints.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Firebase admin
const fakeQuery = () => {
  /** @type {any} */
  const q = {};
  q.orderBy = vi.fn(() => q);
  q.where = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.get = vi.fn(() => Promise.resolve({ docs: [] }));
  q.doc = vi.fn(() => ({
    get: vi.fn(() => Promise.resolve({ exists: true, id: 'test-project', data: () => ({ name: 'Test Project' }) })),
    set: vi.fn(() => Promise.resolve()),
  }));
  return q;
};
vi.mock('@/lib/firebase/serverOnly', () => ({
  db: {
    collection: vi.fn(() => fakeQuery()),
  },
}));

// Mock nanopayment middleware
vi.mock('@/lib/nanopayment', () => ({
  withNanopayment: vi.fn((handler, amount) => (req, res) => {
    req.nanopayment = { amount: 0.05, demo: false, txHash: '0xtest', verificationStatus: 'verified' };
    return handler(req, res);
  }),
}));

// Mock scoring engine
vi.mock('@/lib/scoringEngine', () => ({
  computeScore: vi.fn(() => ({ total: 75, breakdown: { github: 40, completeness: 20, community: 15 } })),
  getRecommendation: vi.fn(() => ({ priority: 'C', label: 'priority C', note: 'test note' })),
  MIN_SCORE_TO_BACK: 60,
}));

// Mock agent identity
vi.mock('@/lib/agentIdentity', () => ({
  getAgentIdentity: vi.fn((type) => ({
    domain: `pledgebond-${type}.sol`,
    displayName: `${type} Agent`,
    icon: '🔭',
    description: `The ${type} agent`,
  })),
  agentIdentityResponse: vi.fn((type) => ({
    agent: { type, snsDomain: `pledgebond-${type}.sol`, displayName: `pledgebond-${type}.sol`, humanName: `${type} Agent`, icon: '🔭', description: `The ${type} agent` },
  })),
  AGENT_IDENTITIES: { scout: {}, underwrite: {}, verify: {}, rebalance: {} },
}));

// Mock agent cache
vi.mock('@/lib/agentCache', () => ({
  getCachedResult: vi.fn(() => null),
  setCachedResult: vi.fn(() => Promise.resolve()),
}));

// Mock aisa client
vi.mock('@/server/aisaClient', () => ({
  getAisaFetch: vi.fn(() => fetch),
  AISA_BASE_URL: 'https://api.aisa.dev/v1',
  isAisaConfigured: vi.fn(() => false),
}));

function reqWithSlug(slug, overrides = {}) {
  return {
    method: overrides.method || 'GET',
    query: { slug: [slug], ...(overrides.query || {}) },
    body: overrides.body || {},
    headers: { host: 'localhost:3000', ...(overrides.headers || {}) },
  };
}

describe('Agent API Response Contracts', () => {
  describe('Chat Endpoint', () => {
    it('returns 405 for non-POST requests', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('chat', { method: 'GET' });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('returns 400 for missing message', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('chat', { method: 'POST', body: {} });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for message over 500 chars', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('chat', { method: 'POST', body: { message: 'a'.repeat(501) } });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns valid response structure for valid request', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn((data) => data),
      };

      const req = reqWithSlug('chat', { method: 'POST', body: { message: 'Hello' } });
      await handler(req, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('agent');
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('reply');
      expect(response).toHaveProperty('agentInfo');
      expect(response.agent).toHaveProperty('type', 'assistant');
      expect(response.agent).toHaveProperty('snsDomain');
    }, 15000);
  });

  describe('Peek Endpoint', () => {
    it('returns 405 for non-GET requests', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('peek', { method: 'POST', body: {} });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('returns 400 when projectId is missing', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('peek', { query: { slug: ['peek'] } });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 204 when nothing is cached', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('peek', { query: { slug: ['peek'], projectId: 'proj-1' } });
      const res = { status: vi.fn(() => res), json: vi.fn(), end: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('returns a compact cached summary when the cache is warm', async () => {
      const { getCachedResult } = await import('@/lib/agentCache');
      getCachedResult.mockResolvedValueOnce({
        data: {
          healthScore: 82,
          recommendation: { priority: 'B', label: 'priority B', note: 'solid candidate' },
          aiAnalysis: 'A'.repeat(500),
        },
        cachedAt: '2026-09-14T00:00:00Z',
        ageHuman: '5 min ago',
      });

      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('peek', { query: { slug: ['peek'], projectId: 'proj-1' } });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(200);

      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.cached).toBe(true);
      expect(body.projectId).toBe('proj-1');
      expect(body.summary.healthScore).toBe(82);
      expect(body.summary.healthVerdict).toBe('fundable');
      expect(body.summary.recommendation).toBe('bridge-loan candidate — priority B');
      // aiAnalysis is truncated for the card surface
      expect(body.summary.aiAnalysis.length).toBeLessThanOrEqual(280);
    });

    it('reports below-threshold scores as watch, not back', async () => {
      const { getCachedResult } = await import('@/lib/agentCache');
      getCachedResult.mockResolvedValueOnce({
        data: { healthScore: 42, recommendation: null, aiAnalysis: null },
        cachedAt: '2026-09-14T00:00:00Z',
        ageHuman: '5 min ago',
      });

      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('peek', { query: { slug: ['peek'], projectId: 'proj-2' } });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      const body = res.json.mock.calls[0][0];
      expect(body.summary.healthVerdict).toBe('watch');
      expect(body.summary.recommendation).toBe('below candidate threshold');
    });
  });

  describe('Scout Endpoint', () => {
    it('returns 405 for invalid methods', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('scout', { method: 'PUT' });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('returns valid response structure for GET', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn((data) => data),
      };

      const req = reqWithSlug('scout');
      await handler(req, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('agent');
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('summary');
      expect(response).toHaveProperty('projects');
      expect(response.summary).toHaveProperty('evaluated');
      expect(response.summary).toHaveProperty('recommended');
    });
  });

  describe('Underwrite Endpoint', () => {
    it('returns 405 for non-GET requests', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('underwrite', { method: 'POST' });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('returns 400 for missing projectId', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('underwrite', { method: 'GET', query: {} });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns valid response structure for valid request', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn((data) => data),
      };

      const req = reqWithSlug('underwrite', { query: { projectId: 'test-project' } });
      await handler(req, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('agent');
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('healthScore');
      expect(response).toHaveProperty('breakdown');
      expect(response).toHaveProperty('recommendation');
    });
  });

  describe('Verify Endpoint', () => {
    it('returns 405 for non-GET requests', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('verify', { method: 'POST' });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('returns 400 for missing prId', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const req = reqWithSlug('verify', { method: 'GET', query: {} });
      const res = { status: vi.fn(() => res), json: vi.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns valid response structure for valid request', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn((data) => data),
      };

      const req = reqWithSlug('verify', { query: { prId: '123', lines: 100 } });
      await handler(req, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('agent');
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('verification');
      expect(response.verification).toHaveProperty('prId');
      expect(response.verification).toHaveProperty('linesAnalyzed');
      expect(response.verification).toHaveProperty('approved');
      expect(response.verification).toHaveProperty('confidence');
      expect(response.verification).toHaveProperty('summary');
    });

    it('returns fallback verification when AIsa not configured', async () => {
      const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn((data) => data),
      };

      const req = reqWithSlug('verify', { query: { prId: '456' } });
      await handler(req, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.verification.approved).toBeNull();
      expect(response.verification.confidence).toBe(0);
      expect(response.resultSource).toBe('fallback');
    });
  });
});

describe('Agent Identity Response Shape', () => {
  it('all agent responses include required fields', async () => {
    const { default: handler } = await import('../../../pages/api/agent/[[...slug]].js');
    const mockRes = {
      status: vi.fn(() => mockRes),
      json: vi.fn((data) => data),
    };

    const req = reqWithSlug('scout');
    await handler(req, mockRes);

    const response = mockRes.json.mock.calls[0][0];

    expect(response.agent).toHaveProperty('type');
    expect(response.agent).toHaveProperty('snsDomain');
    expect(response.agent).toHaveProperty('displayName');
    expect(response.agent).toHaveProperty('humanName');
    expect(response.agent).toHaveProperty('icon');
    expect(response.agent).toHaveProperty('description');

    expect(response.agentInfo).toHaveProperty('name');
    expect(response.agentInfo).toHaveProperty('humanName');
    expect(response.agentInfo).toHaveProperty('network');
  });
});

describe('Agent API authentication', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.AGENT_API_KEY;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalApiKey === undefined) delete process.env.AGENT_API_KEY;
    else process.env.AGENT_API_KEY = originalApiKey;
  });

  it('fails closed in production when AGENT_API_KEY is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AGENT_API_KEY;
    const { withAgentAuth } = await import('@/lib/agentAuth');
    const inner = vi.fn();
    const res = { status: vi.fn(() => res), json: vi.fn() };

    await withAgentAuth(inner)({ headers: {} }, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(inner).not.toHaveBeenCalled();
  });

  it('rejects an invalid configured API key', async () => {
    process.env.AGENT_API_KEY = 'correct-key';
    const { withAgentAuth } = await import('@/lib/agentAuth');
    const inner = vi.fn();
    const res = { status: vi.fn(() => res), json: vi.fn() };

    await withAgentAuth(inner)({ headers: { 'x-api-key': 'wrong-key' } }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(inner).not.toHaveBeenCalled();
  });
});
