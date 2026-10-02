/**
 * Payout Leads API — POST /api/payout-leads
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const addMock = vi.fn(() => Promise.resolve({ id: 'lead-123' }));
const leadGetMock = vi.fn(() => Promise.resolve({
  id: 'lead-123',
  data: () => ({
    hackathonName: 'Test Hackathon',
    email: 'test@example.com',
    prizeAmount: 5000,
    announcementUrl: 'https://x.com/win',
    createdAt: '2026-09-01T00:00:00Z',
  }),
}));
const leadUpdateMock = vi.fn(() => Promise.resolve());
const projectSetMock = vi.fn(() => Promise.resolve());

const fakeDoc = (opts = {}) => ({
  id: 'lead-123',
  get: vi.fn(() => Promise.resolve({ exists: false, ...opts })),
  set: projectSetMock,
  update: leadUpdateMock,
});

const fakeQuery = () => {
  const q = {};
  q.where = vi.fn(() => q);
  q.orderBy = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.get = vi.fn(() => Promise.resolve({ docs: [], size: 0 }));
  // payoutLeads doc reads return the lead snapshot; projects start absent.
  q.doc = vi.fn((id) => ({
    get: id === 'lead-123' ? leadGetMock : vi.fn(() => Promise.resolve({ exists: false })),
    set: projectSetMock,
    update: leadUpdateMock,
  }));
  q.add = addMock;
  return q;
};

// Inline conversion uses the shared lib — stub it at the module boundary.
const convertLeadToClaimMock = vi.fn(() =>
  Promise.resolve({ slug: 'test-hackathon-lead-lead-123', claim: {}, created: true }),
);
vi.mock('@/lib/payoutLeads', () => ({
  convertLeadToClaim: (...args) => convertLeadToClaimMock(...args),
}));

vi.mock('@/lib/firebase/serverOnly', () => ({
  db: {
    collection: vi.fn(() => fakeQuery()),
  },
}));

describe('/api/payout-leads (index)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST methods', async () => {
    const handler = (await import('../../../../pages/api/payout-leads/index')).default;
    const req = { method: 'GET' };
    const res = {
      status: vi.fn(() => res),
      json: vi.fn(),
    };
    handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 when hackathonName is missing', async () => {
    const handler = (await import('../../../../pages/api/payout-leads/index')).default;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { email: 'test@example.com' },
    };
    const res = {
      status: vi.fn(() => res),
      json: vi.fn(),
    };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 201 on successful creation', async () => {
    const handler = (await import('../../../../pages/api/payout-leads/index')).default;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        hackathonName: 'Test Hackathon',
        email: 'test@example.com',
        prizeAmount: 5000,
        wallet: '0xabc',
      },
    };
    const res = {
      status: vi.fn(() => res),
      json: vi.fn(),
    };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('converts inline and returns projectSlug when announcementUrl is present', async () => {
    const handler = (await import('../../../../pages/api/payout-leads/index')).default;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        hackathonName: 'Test Hackathon',
        email: 'test@example.com',
        announcementUrl: 'https://x.com/win',
      },
    };
    const res = { status: vi.fn(() => res), json: vi.fn() };
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        converted: true,
        projectSlug: 'test-hackathon-lead-lead-123',
      }),
    );
    expect(convertLeadToClaimMock).toHaveBeenCalled();
  });

  it('falls back to lead-only (no conversion) without announcementUrl', async () => {
    convertLeadToClaimMock.mockClear();
    const handler = (await import('../../../../pages/api/payout-leads/index')).default;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        hackathonName: 'Test Hackathon',
        email: 'test@example.com',
      },
    };
    const res = { status: vi.fn(() => res), json: vi.fn() };
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, leadId: 'lead-123' }),
    );
    expect(convertLeadToClaimMock).not.toHaveBeenCalled();
  });

  it('still returns 201 when inline conversion fails (cron retries)', async () => {
    convertLeadToClaimMock.mockRejectedValueOnce(new Error('convert failed'));
    const handler = (await import('../../../../pages/api/payout-leads/index')).default;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        hackathonName: 'Test Hackathon',
        email: 'test@example.com',
        announcementUrl: 'https://x.com/win',
      },
    };
    const res = { status: vi.fn(() => res), json: vi.fn() };
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, leadId: 'lead-123' }),
    );
  });
});
