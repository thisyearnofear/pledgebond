/**
 * Project-focused scoring wrapper
 * Combines GitHub scoring (from scoring.js) with project-specific metrics.
 * 
 * @see scoring.js - Canonical GitHub scoring implementation
 */

// Re-export GitHub scoring for backward compatibility
export {
  calculateProfileScore,
  calculateActivityScore,
  calculateCommunityScore,
  calculateRepositoryScore,
  calculateConsistencyScore,
  calculateFullGitHubScore,
} from './scoring';

// Scoring weights for project scoring
const W = { github: 0.4, completeness: 0.3, community: 0.3 };

// Thresholds
export const MIN_SCORE_TO_BACK = 60;
// Scout priority tiers. The scout flags bridge-loan candidates for lenders to
// read — it never sizes or stakes capital itself.
const CANDIDATE_TIERS = [
  { min: 90, priority: "A", note: "strong candidate — worth a lender's attention once a win is declared" },
  { min: 80, priority: "B", note: "solid candidate — review alongside its payout history" },
  { min: 70, priority: "C", note: "promising candidate — watch for a first declared win" },
  { min: 60, priority: "D", note: "borderline candidate — fund only against a declared win" },
];

/**
 * Legacy GitHub scoring - delegates to scoring.js for unified calculation
 * @deprecated Use calculateFullGitHubScore from scoring.js for new code
 */
export function scoreGithub(stats) {
  if (!stats) return 0;
  // Use simple heuristic for quick scoring, delegate to scoring.js for full calculation
  const commits = Math.min((stats.commits || 0) / 100, 1) * 40;
  const stars = Math.min((stats.stars || 0) / 20, 1) * 20;
  const forks = Math.min((stats.forks || 0) / 10, 1) * 15;
  const issues = Math.min((stats.issues || 0) / 30, 1) * 10;
  const pulls = Math.min((stats.pulls || 0) / 20, 1) * 15;
  return commits + stars + forks + issues + pulls;
}

export function scoreCompleteness(project) {
  let score = 0;
  if (project.description && project.description.length > 50) score += 20;
  // Support both EVM contractAddress and Solana programId/address
  if (project.contractAddress || project.programId || project.deploymentProof) score += 25;
  if (project.website) score += 10;
  if (project.milestones && project.milestones.length > 0) score += 25;
  if (project.hackathons && project.hackathons.length > 0) score += 10;
  if (project.isOpenSource) score += 10;
  return score;
}

export function scoreCommunity(project) {
  let score = 0;
  if (project.teamMembers && project.teamMembers.length > 1) score += 30;
  if (project.twitter) score += 15;
  if (project.discord) score += 15;
  const daysSinceSubmit = project.submittedAt
    ? (Date.now() - new Date(project.submittedAt).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  if (daysSinceSubmit < 7) score += 25;
  else if (daysSinceSubmit < 30) score += 15;
  else if (daysSinceSubmit < 90) score += 5;
  if (project.lookingForFunding) score += 15;
  return score;
}

/**
 * Full project scoring - combines GitHub metrics with project completeness and community
 */
export function computeScore(project) {
  const g = scoreGithub(project.stats);
  const c = scoreCompleteness(project);
  const s = scoreCommunity(project);
  const total = Math.round(g * W.github + c * W.completeness + s * W.community);
  return { 
    total: Math.min(total, 100), 
    breakdown: { github: Math.round(g), completeness: Math.round(c), community: Math.round(s) } 
  };
}

export function getRecommendation(score) {
  const tier = CANDIDATE_TIERS.find((t) => score >= t.min);
  if (!tier) return null;
  return { priority: tier.priority, label: `priority ${tier.priority}`, note: tier.note };
}
