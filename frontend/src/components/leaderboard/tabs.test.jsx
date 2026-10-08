/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  truncateAddress,
  generateShareText,
  pickShareVariant,
  isShareableEntry,
  SHARE_TEXT_VARIANTS,
  TABS,
} from './tabs';

describe('truncateAddress', () => {
  it('returns "Unknown" for empty / nullish input', () => {
    expect(truncateAddress(null)).toBe('Unknown');
    expect(truncateAddress(undefined)).toBe('Unknown');
    expect(truncateAddress('')).toBe('Unknown');
  });

  it('truncates a 0x-style address to first4…last4', () => {
    expect(truncateAddress('0xabcdef1234567890')).toBe('0xab...7890');
  });

  it('truncates a Solana-style base58 address', () => {
    const addr = 'SoLanaAddr1234567890abcdef';
    expect(truncateAddress(addr)).toBe('SoLa...cdef');
  });
});

describe('generateShareText', () => {
  it('builds builder share text with velocity', () => {
    const text = generateShareText({ name: 'alice', velocity: 99 }, 3, 'builders');
    expect(text).toBe('#3 alice — 99 shipping velocity on @pledgebond');
  });

  it('falls back to score when velocity is missing for builders', () => {
    const text = generateShareText({ name: 'bob', score: 42 }, 1, 'builders');
    expect(text).toBe('#1 bob — 42 shipping velocity on @pledgebond');
  });

  it('builds lender share text with funding velocity', () => {
    const text = generateShareText({ name: 'carol', velocity: 5 }, 7, 'lenders');
    expect(text).toBe('#7 carol — 5 funding velocity on @pledgebond');
  });

  it('builds project share text with credibility + evidence coverage', () => {
    const text = generateShareText({ name: 'dexswap', score: 55, evidenceCoverage: 80 }, 2, 'projects');
    expect(text).toBe('#2 Proven Project: dexswap — 55 credibility · 80% evidence coverage on @pledgebond');
  });

  it('builds hackathon share text with payout data', () => {
    const text = generateShareText({ name: 'ETHGlobal', avgPayoutDays: 11, payoutCompletionRate: 94 }, 1, 'hackathons');
    expect(text).toBe('🏆 ETHGlobal pays winners in 11d avg with 94% payout rate — ranked #1 on @pledgebond');
  });

  it('falls back to truncated address when name is missing', () => {
    const text = generateShareText({ address: '0xabc1234567890def', score: 10, evidenceCoverage: 50 }, 4, 'projects');
    expect(text).toBe('#4 Proven Project: 0xab...0def — 10 credibility · 50% evidence coverage on @pledgebond');
  });

  it('returns distinct copy for each variant', () => {
    const entry = { name: 'alice', verifiedWins: 3 };
    const v0 = generateShareText(entry, 2, 'builder', 0);
    const v1 = generateShareText(entry, 2, 'builder', 1);
    const v2 = generateShareText(entry, 2, 'builder', 2);
    expect(new Set([v0, v1, v2]).size).toBe(3);
    for (const t of [v0, v1, v2]) expect(t).toContain('alice');
  });

  it('falls back to variant 0 for an out-of-range index', () => {
    const entry = { name: 'alice', velocity: 9 };
    expect(generateShareText(entry, 1, 'builder', 99)).toBe(generateShareText(entry, 1, 'builder', 0));
  });
});

describe('pickShareVariant', () => {
  it('returns a valid variant index for each entry type', () => {
    for (const type of Object.keys(SHARE_TEXT_VARIANTS)) {
      const v = pickShareVariant(type);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(SHARE_TEXT_VARIANTS[type].length);
    }
  });

  it('accepts plural tab ids', () => {
    const v = pickShareVariant('builders');
    expect(v).toBeLessThan(SHARE_TEXT_VARIANTS.builder.length);
  });
});

describe('isShareableEntry', () => {
  it('allows hackathon entries (API trust gate already applied)', () => {
    expect(isShareableEntry('hackathon', { name: 'ETHGlobal' })).toBe(true);
  });

  it('requires verified wins for builder/backer/proof-builder/project entries', () => {
    for (const t of ['builder', 'backer', 'proof-builder', 'project']) {
      expect(isShareableEntry(t, { name: 'x', verifiedWins: 0 })).toBe(false);
      expect(isShareableEntry(t, { name: 'x', verifiedWins: 2 })).toBe(true);
    }
  });

  it('normalizes plural tab ids before checking', () => {
    expect(isShareableEntry('builders', { verifiedWins: 1 })).toBe(true);
    expect(isShareableEntry('projects', { name: 'p' })).toBe(false);
  });

  it('rejects missing entries', () => {
    expect(isShareableEntry('builder', null)).toBe(false);
    expect(isShareableEntry('builder', undefined)).toBe(false);
  });
});

describe('TABS', () => {
  it('exposes the 5 leaderboard tabs with Payouts first', () => {
    expect(TABS.map((t) => t.id)).toEqual([
      'hackathons',
      'proof-builders',
      'projects',
      'builders',
      'lenders',
    ]);
  });

  it('every tab has a label and icon component', () => {
    for (const t of TABS) {
      expect(t.label).toBeTruthy();
      expect(typeof t.icon).toBe('object');
    }
  });
});
