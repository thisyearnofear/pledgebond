/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  CATEGORY_OPTIONS,
  SORT_OPTIONS,
  SORT_LABELS,
  BUILDER_SORT_OPTIONS,
  ECOSYSTEM_OPTIONS,
  ECOSYSTEM_FILTER_OPTIONS,
  ITEMS_PER_PAGE,
  BACKER_SORT_OPTIONS,
} from './constants';

describe('CATEGORY_OPTIONS', () => {
  it('contains the 10 expected categories', () => {
    expect(CATEGORY_OPTIONS).toHaveLength(10);
    const ids = CATEGORY_OPTIONS.map((o) => o.id);
    expect(ids).toEqual([
      'defi', 'gaming', 'rwa', 'infrastructure', 'social',
      'ai-agents', 'payments', 'nft', 'dao', 'other',
    ]);
  });

  it('every entry has a non-empty label and a unique id', () => {
    const ids = new Set();
    for (const o of CATEGORY_OPTIONS) {
      expect(o.id).toBeTruthy();
      expect(o.label).toBeTruthy();
      expect(ids.has(o.id)).toBe(false);
      ids.add(o.id);
    }
  });
});

describe('SORT_OPTIONS', () => {
  it('covers trending/created/health/name/recent', () => {
    const ids = SORT_OPTIONS.map((o) => o.id);
    expect(ids).toContain('trending');
    expect(ids).toContain('created');
    expect(ids).toContain('health');
    expect(ids).toContain('name');
    expect(ids).toContain('recent');
  });
});

describe('SORT_LABELS', () => {
  it('has a labelled entry for every SORT_OPTIONS id except "name"', () => {
    for (const o of SORT_OPTIONS) {
      if (o.id === 'name') continue;
      expect(SORT_LABELS[o.id]).toBeTruthy();
    }
  });
});

describe('BUILDER_SORT_OPTIONS', () => {
  it('has 6 options', () => {
    expect(BUILDER_SORT_OPTIONS).toHaveLength(6);
  });
});

describe('ECOSYSTEM_FILTER_OPTIONS', () => {
  it('starts with an "all" sentinel', () => {
    expect(ECOSYSTEM_FILTER_OPTIONS[0]).toEqual({ id: 'all', label: 'All Ecosystems' });
    expect(ECOSYSTEM_FILTER_OPTIONS.length).toBe(ECOSYSTEM_OPTIONS.length + 1);
  });
});

describe('ECOSYSTEM_OPTIONS', () => {
  it('every entry is "icon shortName"', () => {
    for (const o of ECOSYSTEM_OPTIONS) {
      expect(o.label).toMatch(/^.+\s\S+$/);
    }
  });
});

describe('ITEMS_PER_PAGE', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(ITEMS_PER_PAGE)).toBe(true);
    expect(ITEMS_PER_PAGE).toBeGreaterThan(0);
  });
});

describe('BACKER_SORT_OPTIONS', () => {
  it('includes health as the default sort id', () => {
    expect(BACKER_SORT_OPTIONS[0].id).toBe('health');
    expect(BACKER_SORT_OPTIONS).toHaveLength(3);
  });
});
