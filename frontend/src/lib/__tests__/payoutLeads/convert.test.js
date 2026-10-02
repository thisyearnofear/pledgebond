/**
 * Tests for lib/payoutLeads — shared lead→claim conversion.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Chainable Firestore mock with per-collection behavior capture.
 * `projects` docs and `payoutLeads` updates are recorded so tests can
 * assert the exact claim shape the conversion wrote.
 */
function makeDb() {
  /** @type {Record<string, any>} */
  const collections = {};
  const projects = {};

  const makeColl = (name) => {
    /** @type {any} */
    const q = {};
    q.orderBy = vi.fn(() => q);
    q.where = vi.fn(() => q);
    q.limit = vi.fn(() => q);
    q.get = vi.fn(() => Promise.resolve({ docs: [], size: 0, empty: true }));
    q.add = vi.fn(() => Promise.resolve({ id: `new-${name}-id` }));
    q.doc = vi.fn((id) => ({
      get: vi.fn(() =>
        Promise.resolve({
          exists: Boolean(projects[id]),
          id,
          data: () => projects[id],
        }),
      ),
      set: vi.fn((data) => {
        projects[id] = data;
        return Promise.resolve();
      }),
      update: vi.fn((patch) => {
        projects[id] = { ...(projects[id] || {}), ...patch };
        if (name === "payoutLeads") {
          collections.payoutLeadUpdates = collections.payoutLeadUpdates || [];
          collections.payoutLeadUpdates.push({ id, patch });
        }
        return Promise.resolve();
      }),
    }));
    return q;
  };

  return {
    collections,
    projects,
    collection: vi.fn((name) => makeColl(name)),
  };
}

vi.mock("@/lib/firebase/serverOnly", () => {
  const db = makeDb();
  return { db, __db: db };
});
// Also mock the literal relative specifier payoutLeads.js uses.
vi.mock("../../firebase/serverOnly", () => {
  const db = makeDb();
  return { db, __db: db };
});

async function loadLib() {
  return import("@/lib/payoutLeads");
}

function leadDoc(overrides = {}) {
  const id = "abcd1234efgh5678";
  const data = {
    hackathonName: "ETHGlobal 2026",
    email: "winner@example.com",
    prizeAmount: 5000,
    wallet: null,
    announcementUrl: "https://x.com/win",
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
  // Firestore DocumentSnapshot shape: data() is a function.
  return { id, data: () => data, get: (f) => data[f] };
}

describe("convertLeadToClaim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a project with an evidence_attached claim when evidence exists", async () => {
    const { convertLeadToClaim } = await loadLib();
    const { db } = await import("@/lib/firebase/serverOnly");

    const result = await convertLeadToClaim(leadDoc());

    expect(result.slug).toBe("ethglobal-2026-lead-abcd1234");
    expect(result.created).toBe(true);

    const project = db.projects["ethglobal-2026-lead-abcd1234"];
    expect(project).toBeTruthy();
    expect(project.hackathons).toHaveLength(1);
    const claim = project.hackathons[0];
    expect(claim.verificationStatus).toBe("evidence_attached");
    expect(claim.evidenceUrl).toBe("https://x.com/win");
    expect(claim.source).toBe("payout-lead");
    expect(claim.leadId).toBe("abcd1234efgh5678");
    expect(claim.prizeAmount).toBe(5000);
  });

  it("marks the lead verified with the project slug", async () => {
    const { convertLeadToClaim } = await loadLib();
    const { db } = await import("@/lib/firebase/serverOnly");

    await convertLeadToClaim(leadDoc());

    const update = db.collections.payoutLeadUpdates.find(
      (u) => u.id === "abcd1234efgh5678",
    );
    expect(update.patch.status).toBe("verified");
    expect(update.patch.projectSlug).toBe("ethglobal-2026-lead-abcd1234");
  });

  it("leaves the claim pending when no evidence URL is present", async () => {
    const { convertLeadToClaim } = await loadLib();
    const { db } = await import("@/lib/firebase/serverOnly");

    await convertLeadToClaim(leadDoc({ announcementUrl: null, evidenceUrl: null }));

    const project = Object.values(db.projects)[0];
    expect(project.hackathons[0].verificationStatus).toBe("pending");
    expect(project.hackathons[0].evidenceUrl).toBeNull();
  });

  it("is idempotent per lead — re-conversion replaces, never duplicates", async () => {
    const { convertLeadToClaim } = await loadLib();
    const { db } = await import("@/lib/firebase/serverOnly");

    await convertLeadToClaim(leadDoc());
    await convertLeadToClaim(leadDoc());

    const project = db.projects["ethglobal-2026-lead-abcd1234"];
    expect(project.hackathons).toHaveLength(1);
  });

  it("throws when the lead has no hackathonName", async () => {
    const { convertLeadToClaim } = await loadLib();
    await expect(
      convertLeadToClaim(leadDoc({ hackathonName: null })),
    ).rejects.toThrow("Lead missing hackathonName");
  });
});
