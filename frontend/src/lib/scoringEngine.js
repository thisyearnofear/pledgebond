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
  calculatePreviewScore,
  getCreditTier,
} from './scoring';

// Scoring weights for project scoring
const W = { github: 0.4, completeness: 0.3, community: 0.3 };

// Thresholds
export const MIN_SCORE_TO_BACK = 60;
const STAKE_TIERS = [
  { min: 90, amount: 5.0, multiplier: 150 },
  { min: 80, amount: 3.0, multiplier: 150 },
  { min: 70, amount: 1.5, multiplier: 200 },
  { min: 60, amount: 0.5, multiplier: 300 },
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

/**
 * Strategic Advisor Logic (Phase 8: Bags Hackathon)
 * Generates comparative ecosystem insights and Bags launch recommendations.
 */
export function computeStrategicAdvice(project) {
  const { stats, ecosystem, description = "" } = project;
  const score = computeScore(project).total;
  
  const advice = {
    ecosystemFit: [],
    bagsRecommendation: null,
    tradeOffMatrix: {
      solanaBags: {
        pros: [],
        cons: [],
        suitability: 0
      },
      circleArc: {
        pros: [],
        cons: [],
        suitability: 0
      }
    }
  };

  // 1. Analyze for Solana/Bags
  let solanaSuitability = 50;
  if (stats?.stars > 50 || stats?.forks > 10) {
    advice.tradeOffMatrix.solanaBags.pros.push("High community viral potential");
    solanaSuitability += 20;
  }
  if (description.toLowerCase().includes("game") || description.toLowerCase().includes("social") || description.toLowerCase().includes("consumer")) {
    advice.tradeOffMatrix.solanaBags.pros.push("Perfect fit for high-throughput consumer apps");
    solanaSuitability += 20;
  }
  if (score > 80) {
    advice.tradeOffMatrix.solanaBags.pros.push("Strong health score signals high token confidence");
    solanaSuitability += 10;
  }
  advice.tradeOffMatrix.solanaBags.cons.push("Higher market volatility for new tokens");
  advice.tradeOffMatrix.solanaBags.suitability = Math.min(solanaSuitability, 100);

  // 2. Analyze for Circle/Arc
  let circleSuitability = 50;
  if (description.toLowerCase().includes("infra") || description.toLowerCase().includes("sdk") || description.toLowerCase().includes("b2b")) {
    advice.tradeOffMatrix.circleArc.pros.push("Stable environment for high-utility B2B apps");
    circleSuitability += 30;
  }
  if (stats?.commits > 200) {
    advice.tradeOffMatrix.circleArc.pros.push("Deep dev history favors milestone-based credit");
    circleSuitability += 15;
  }
  advice.tradeOffMatrix.circleArc.cons.push("Lower immediate retail community exposure");
  advice.tradeOffMatrix.circleArc.suitability = Math.min(circleSuitability, 100);

  // 3. Generate Bags Launch Recommendation
  if (solanaSuitability >= 70) {
    const teamSize = project.teamMembers?.length || 1;
    advice.bagsRecommendation = {
      recommended: true,
      reason: "High social/consumer signals suggest a community-led liquidity launch would be highly effective.",
      parameters: {
        feeSplit: teamSize > 2 ? "30/70" : "10/90",
        initialPurchase: score > 85 ? "500 USDC" : "100 USDC",
        launchStrategy: "Community-Led Liquidity"
      }
    };
  } else {
    advice.bagsRecommendation = {
      recommended: false,
      reason: "Project favors stable utility over viral growth. A bridge loan on Arc against a declared win fits better than a token launch.",
      parameters: null
    };
  }

  // 4. General Ecosystem Fit
  if (solanaSuitability > circleSuitability + 15) {
    advice.ecosystemFit = ["Best for Viral Growth", "Bags Boost Recommended"];
  } else if (circleSuitability > solanaSuitability + 15) {
    advice.ecosystemFit = ["Best for Stable Utility", "Arc Rails Recommended"];
  } else {
    advice.ecosystemFit = ["Hybrid Suitable", "User Discretion Recommended"];
  }

  return advice;
}

export function getRecommendation(score) {
  const tier = STAKE_TIERS.find((t) => score >= t.min);
  if (!tier) return null;
  return { amount: tier.amount, multiplier: tier.multiplier, label: `${tier.multiplier / 100}x` };
}
