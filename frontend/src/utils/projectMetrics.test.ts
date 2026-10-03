/**
 * Project Metrics Tests
 * Unit tests for pure derivation functions used by useProjectData
 */
import { describe, it, expect } from 'vitest';
import {
  calculateHealth,
  calculateConfidence,
  deriveLastCheckIn,
  enhanceProject,
} from './projectMetrics';

const NOW = new Date('2026-05-01T12:00:00Z').getTime();

describe('calculateHealth', () => {
  it('returns ~30-37 baseline for empty project (with stable hash variation)', () => {
    const h = calculateHealth({}, NOW);
    expect(h).toBeGreaterThanOrEqual(30);
    expect(h).toBeLessThanOrEqual(37);
  });

  it('adds 20 for active project', () => {
    const base = calculateHealth({}, NOW);
    const withActive = calculateHealth({ stats: { isActive: true } }, NOW);
    expect(withActive - base).toBe(20);
  });

  it('adds 10+5 for 50+ commits', () => {
    const base = calculateHealth({}, NOW);
    const result = calculateHealth({ stats: { commits: 60 } }, NOW);
    expect(result - base).toBe(15);
  });

  it('adds 10 for 10-50 commits', () => {
    const base = calculateHealth({}, NOW);
    const result = calculateHealth({ stats: { commits: 15 } }, NOW);
    expect(result - base).toBe(10);
  });

  it('adds 15 for commit within 7 days', () => {
    const base = calculateHealth({}, NOW);
    const recent = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateHealth({ stats: { lastCommit: recent } }, NOW);
    expect(result - base).toBe(15);
  });

  it('adds 10 for commit within 30 days', () => {
    const base = calculateHealth({}, NOW);
    const recent = new Date(NOW - 15 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateHealth({ stats: { lastCommit: recent } }, NOW);
    expect(result - base).toBe(10);
  });

  it('adds 5 for stale commit (30-90 days)', () => {
    const base = calculateHealth({}, NOW);
    const stale = new Date(NOW - 60 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateHealth({ stats: { lastCommit: stale } }, NOW);
    expect(result - base).toBe(5);
  });

  it('gives bonus for long description', () => {
    const base = calculateHealth({}, NOW);
    const result = calculateHealth({ description: 'A'.repeat(200) }, NOW);
    expect(result).toBeGreaterThan(base);
  });

  it('clamps to 0-100 range', () => {
    const recent = new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(calculateHealth({ stats: { isActive: true, commits: 100, lastCommit: recent, healthScore: 100 } }, NOW)).toBeLessThanOrEqual(100);
  });
});

describe('calculateConfidence', () => {
  it('returns a completeness-based baseline for zero backers (not flat 10)', () => {
    const bare = calculateConfidence({});
    expect(bare).toBeGreaterThanOrEqual(5);
    expect(bare).toBeLessThanOrEqual(15);

    // More complete project → higher confidence
    const complete = calculateConfidence({
      description: 'A'.repeat(100),
      githubUrl: 'https://github.com/owner/repo',
      ecosystem: 'solana',
      category: 'defi',
      socials: { website: 'https://example.com' },
      founders: ['alice', 'bob'],
    });
    expect(complete).toBeGreaterThan(bare + 20);
  });

  it('scales with backer count when backer data exists', () => {
    const c5 = calculateConfidence({ backerCount: 5, totalBacked: 5000 });
    const c10 = calculateConfidence({ backerCount: 10, totalBacked: 5000 });
    expect(c5).toBeLessThan(c10);
  });

  it('scales with funding progress when backer data exists', () => {
    const low = calculateConfidence({ backerCount: 5, totalBacked: 1000 });
    const high = calculateConfidence({ backerCount: 5, totalBacked: 8000 });
    expect(low).toBeLessThan(high);
  });

  it('caps at 100', () => {
    const result = calculateConfidence({ backerCount: 100, totalBacked: 50000, targetFunding: 10000 });
    expect(result).toBeLessThanOrEqual(100);
  });
});

describe('deriveLastCheckIn', () => {
  it('returns 168 (stale) when no data', () => {
    expect(deriveLastCheckIn({})).toBe(168);
  });

  it('calculates hours from lastCheckInTimestamp', () => {
    const twoHoursAgo = new Date(NOW - 2 * 60 * 60 * 1000).toISOString();
    expect(deriveLastCheckIn({ lastCheckInTimestamp: twoHoursAgo }, NOW)).toBe(2);
  });

  it('falls back to lastCommit', () => {
    const fourHoursAgo = new Date(NOW - 4 * 60 * 60 * 1000).toISOString();
    expect(deriveLastCheckIn({ stats: { lastCommit: fourHoursAgo } }, NOW)).toBe(4);
  });

  it('prefers lastCheckInTimestamp over lastCommit', () => {
    const oneHourAgo = new Date(NOW - 1 * 60 * 60 * 1000).toISOString();
    const tenHoursAgo = new Date(NOW - 10 * 60 * 60 * 1000).toISOString();
    expect(deriveLastCheckIn({
      lastCheckInTimestamp: oneHourAgo,
      stats: { lastCommit: tenHoursAgo },
    }, NOW)).toBe(1);
  });

  it('falls back to createdAt for activity signal', () => {
    const recentDate = new Date(NOW - 48 * 60 * 60 * 1000).toISOString();
    const result = deriveLastCheckIn({ createdAt: recentDate }, NOW);
    expect(result).toBe(48);
  });
});

describe('enhanceProject', () => {
  it('returns a complete enhanced project object', () => {
    const result = enhanceProject({ name: 'Test', description: 'A'.repeat(200), ecosystem: 'solana', category: 'defi', stats: { isActive: true, commits: 20 } }, NOW);
    expect(result.name).toBe('Test');
    expect(result.confidence).toBeGreaterThanOrEqual(5);
    expect(result.health).toBeGreaterThanOrEqual(30);
    expect(result.totalBacked).toBe(0);
    expect(result.targetFunding).toBe(10000);
    expect(result.category).toBe('defi');
    expect(result.submissionQuality).toBeGreaterThanOrEqual(0);
    expect(result.shortDescription).toBeTruthy();
  });

  it('uses first sector as category', () => {
    const result = enhanceProject({ sectors: ['ai-agents', 'defi'] });
    expect(result.category).toBe('ai-agents');
  });

  it('falls back to project category field', () => {
    const result = enhanceProject({ category: 'Payments' });
    expect(result.category).toBe('Payments');
  });

  it('defaults to General when no category', () => {
    const result = enhanceProject({});
    expect(result.category).toBe('General');
  });

  it('preserves original project fields', () => {
    const result = enhanceProject({ id: 'abc', slug: 'test-proj', name: 'Test' });
    expect(result.id).toBe('abc');
    expect(result.slug).toBe('test-proj');
  });

  it('truncates long descriptions', () => {
    const result = enhanceProject({ description: 'A'.repeat(300) });
    expect(result.shortDescription.length).toBeLessThanOrEqual(120);
    expect(result.shortDescription).toContain('...');
  });

  it('produces varied scores for different projects', () => {
    const a = enhanceProject({ slug: 'project-alpha', description: 'Short desc', ecosystem: 'solana' });
    const b = enhanceProject({ slug: 'project-beta', description: 'Different project description that is much longer and more detailed', ecosystem: 'celo', githubUrl: 'https://github.com/x/y', category: 'defi' });
    // They should NOT all be identical
    expect(a.health === b.health && a.confidence === b.confidence && a.submissionQuality === b.submissionQuality).toBe(false);
  });
});
