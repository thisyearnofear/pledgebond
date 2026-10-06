/**
 * Scoring Engine Tests
 * Validates project scoring, recommendation tiers, and strategic advice.
 */
import { describe, it, expect } from 'vitest';
import {
  computeScore,
  getRecommendation,
  scoreGithub,
  scoreCompleteness,
  scoreCommunity,
  computeStrategicAdvice,
  MIN_SCORE_TO_BACK,
} from '../scoringEngine';

describe('scoreGithub', () => {
  it('returns 0 for null/undefined stats', () => {
    expect(scoreGithub(null)).toBe(0);
    expect(scoreGithub(undefined)).toBe(0);
    expect(scoreGithub({})).toBe(0);
  });

  it('scales commits up to 40', () => {
    expect(scoreGithub({ commits: 100 })).toBe(40);
    expect(scoreGithub({ commits: 50 })).toBe(20);
  });

  it('combines multiple metrics', () => {
    const score = scoreGithub({ commits: 100, stars: 20, forks: 10, issues: 30, pulls: 20 });
    expect(score).toBe(100); // 40+20+15+10+15
  });

  it('caps individual metrics', () => {
    expect(scoreGithub({ commits: 10000 })).toBe(40); // capped at 40
    expect(scoreGithub({ stars: 10000 })).toBe(20); // capped at 20
  });
});

describe('scoreCompleteness', () => {
  it('returns 0 for empty project', () => {
    expect(scoreCompleteness({})).toBe(0);
  });

  it('awards 20 for long description', () => {
    expect(scoreCompleteness({ description: 'a'.repeat(51) })).toBe(20);
  });

  it('awards 25 for contract/program address', () => {
    expect(scoreCompleteness({ contractAddress: '0x123' })).toBe(25);
    expect(scoreCompleteness({ programId: 'abc123' })).toBe(25);
    expect(scoreCompleteness({ deploymentProof: true })).toBe(25);
  });

  it('awards 25 for milestones', () => {
    expect(scoreCompleteness({ milestones: [{ desc: 'm1' }] })).toBe(25);
  });

  it('maxes at 100', () => {
    const full = {
      description: 'a'.repeat(51),
      contractAddress: '0x123',
      website: 'https://example.com',
      milestones: [{ desc: 'm1' }],
      hackathons: ['h1'],
      isOpenSource: true,
    };
    expect(scoreCompleteness(full)).toBe(100);
  });
});

describe('scoreCommunity', () => {
  it('returns 0 for empty project', () => {
    expect(scoreCommunity({})).toBe(0);
  });

  it('awards 30 for team members', () => {
    expect(scoreCommunity({ teamMembers: ['a', 'b'] })).toBe(30);
  });

  it('awards 15 each for twitter and discord', () => {
    expect(scoreCommunity({ twitter: '@test' })).toBe(15);
    expect(scoreCommunity({ discord: 'test' })).toBe(15);
    expect(scoreCommunity({ twitter: '@t', discord: 'd' })).toBe(30);
  });
});

describe('computeScore', () => {
  it('returns total capped at 100 with breakdown', () => {
    const result = computeScore({
      stats: { commits: 100, stars: 20, forks: 10, issues: 30, pulls: 20 },
      description: 'a'.repeat(51),
      contractAddress: '0x123',
      milestones: [{ desc: 'm1' }],
      teamMembers: ['a', 'b'],
      submittedAt: new Date().toISOString(),
    });
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.breakdown).toHaveProperty('github');
    expect(result.breakdown).toHaveProperty('completeness');
    expect(result.breakdown).toHaveProperty('community');
  });

  it('handles minimal project', () => {
    const result = computeScore({ stats: {} });
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });
});

describe('getRecommendation', () => {
  it('returns null for low scores', () => {
    expect(getRecommendation(30)).toBeNull();
    expect(getRecommendation(59)).toBeNull();
  });

  it('returns a priority tier for qualifying scores', () => {
    const rec = getRecommendation(75);
    expect(rec).not.toBeNull();
    expect(rec.priority).toBe('C');
    expect(rec.label).toBe('priority C');
    expect(typeof rec.note).toBe('string');
  });

  it('returns the top tier for top scores', () => {
    const rec = getRecommendation(95);
    expect(rec.priority).toBe('A');
  });

  it('carries no stake amount or multiplier', () => {
    expect(getRecommendation(95)).not.toHaveProperty('amount');
    expect(getRecommendation(95)).not.toHaveProperty('multiplier');
  });

  it('boundary: exactly MIN_SCORE_TO_BACK', () => {
    const rec = getRecommendation(MIN_SCORE_TO_BACK);
    expect(rec).not.toBeNull();
  });
});

describe('computeStrategicAdvice', () => {
  it('returns advice object with ecosystemFit', () => {
    const advice = computeStrategicAdvice({ stats: {} });
    expect(advice).toHaveProperty('ecosystemFit');
    expect(advice).toHaveProperty('tradeOffMatrix');
    expect(advice.tradeOffMatrix.solanaBags).toHaveProperty('suitability');
    expect(advice.tradeOffMatrix.circleArc).toHaveProperty('suitability');
  });

  it('recommends Bags for high-star consumer projects', () => {
    const advice = computeStrategicAdvice({
      stats: { stars: 100 },
      description: 'A social game on Solana',
    });
    expect(advice.bagsRecommendation?.recommended).toBe(true);
  });

  it('recommends Circle for infra projects', () => {
    const advice = computeStrategicAdvice({
      stats: { commits: 300 },
      description: 'B2B SDK infrastructure toolkit',
    });
    expect(advice.tradeOffMatrix.circleArc.suitability).toBeGreaterThan(50);
  });
});
