/**
 * GitHub Scoring Library — CANONICAL IMPLEMENTATION
 * Single source of truth for all GitHub-based credit scoring.
 * Used by both BFF routes and client services.
 *
 * Weights:
 * - Profile: 15%
 * - Activity: 25%
 * - Community: 25%
 * - Repositories: 20%
 * - Consistency: 15%
 *
 * @see scoringEngine.js - Project-focused scoring wrapper (uses this internally)
 */

export function calculateProfileScore(profile) {
  let score = 0;

  const accountAge =
    (Date.now() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24 * 365);
  score += Math.min(accountAge * 5, 20);

  if (profile.bio && profile.bio.length > 10) score += 10;
  if (profile.blog && profile.blog.length > 0) score += 5;
  if (profile.location && profile.location.length > 0) score += 5;
  if (profile.company && profile.company.length > 0) score += 5;
  if (profile.email && profile.email.length > 0) score += 5;

  score += Math.min(profile.followers / 10, 20);
  score += Math.min(profile.public_repos / 5, 10);

  if (profile.verified) score += 20;

  return Math.min(score, 100);
}

export function calculateActivityScore(commits, stats) {
  let score = 0;

  const recentCommits = commits.filter((commit) => {
    const commitDate = new Date(commit.commit.author.date);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return commitDate > thirtyDaysAgo;
  });

  score += Math.min(recentCommits.length * 2, 40);
  score += Math.min(stats.recentRepos * 5, 30);
  score += Math.min(commits.length, 30);

  return Math.min(score, 100);
}

export function calculateCommunityScore(pullRequests, issues, organizations) {
  let score = 0;

  score += Math.min(pullRequests.length * 2, 40);
  score += Math.min(issues.length * 1.5, 30);
  score += Math.min(organizations.length * 10, 30);

  return Math.min(score, 100);
}

export function calculateRepositoryScore(repos, stats) {
  const publicRepos = repos.filter((r) => !r.private);
  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
  const totalForks = repos.reduce((sum, r) => sum + r.forks_count, 0);
  const hasReadme = repos.filter((r) => r.has_readme).length;
  const hasLicense = repos.filter((r) => r.license).length;

  let score = 0;

  score += Math.min(publicRepos.length * 2, 25);
  score += Math.min(totalStars / 2, 25);
  score += Math.min(totalForks * 2, 20);
  score += Math.min(hasReadme * 2, 20);
  score += Math.min(hasLicense * 2, 10);

  return Math.min(score, 100);
}

export function calculateConsistencyScore(commits, repos) {
  let score = 0;

  const commitDates = commits.map((c) => new Date(c.commit.author.date));
  const uniqueDays = new Set(commitDates.map((d) => d.toDateString())).size;
  score += Math.min(uniqueDays * 2, 50);

  const recentlyUpdated = repos.filter((repo) => {
    const lastUpdate = new Date(repo.updated_at);
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    return lastUpdate > sixMonthsAgo;
  });

  score += Math.min(recentlyUpdated.length * 5, 50);

  return Math.min(score, 100);
}

/**
 * Full GitHub score — requires all GitHub API data
 */
export function calculateFullGitHubScore(userData, commits, pullRequests, issues, organizations) {
  const scores = {
    profile: calculateProfileScore(userData.profile),
    activity: calculateActivityScore(commits, userData.stats),
    community: calculateCommunityScore(pullRequests, issues, organizations),
    repositories: calculateRepositoryScore(userData.repos, userData.stats),
    consistency: calculateConsistencyScore(commits, userData.repos),
  };

  const totalScore = Math.round(
    scores.profile * 0.15 +
    scores.activity * 0.25 +
    scores.community * 0.25 +
    scores.repositories * 0.2 +
    scores.consistency * 0.15
  );

  return {
    totalScore: Math.min(totalScore, 100),
    breakdown: scores,
  };
}
