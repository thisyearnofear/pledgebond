/**
 * Score Preview API — Public builder track-record preview
 * Returns GitHub signals (profile + repos only) for the track-record card.
 * No auth required. Skips expensive calls (commits, PRs, issues, orgs).
 *
 * Usage: GET /api/score/preview?username=octocat
 */

import { withApiMiddleware } from "@/utils/apiMiddleware";

const GITHUB_API = 'https://api.github.com';
const USERNAME_REGEX = /^[a-zA-Z0-9-]{1,39}$/;

async function handler(req, res) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(503).json({
      success: false,
      error: 'GitHub API not configured on server',
    });
  }

  const { username } = req.query;
  if (!username || !USERNAME_REGEX.test(username)) {
    return res.status(400).json({
      success: false,
      error:
        'Invalid or missing username. Must be 1-39 alphanumeric characters or hyphens.',
    });
  }

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'PledgeBond-BFF',
  };

  try {
    const [profileRes, reposRes] = await Promise.all([
      fetch(`${GITHUB_API}/users/${username}`, { headers }),
      fetch(
        `${GITHUB_API}/users/${username}/repos?per_page=100&sort=updated`,
        { headers }
      ),
    ]);

    if (!profileRes.ok) {
      const status = profileRes.status === 404 ? 404 : profileRes.status;
      return res.status(status).json({
        success: false,
        error:
          status === 404
            ? `GitHub user '${username}' not found`
            : `GitHub API error: ${profileRes.status} ${profileRes.statusText}`,
      });
    }

    if (!reposRes.ok) {
      return res.status(reposRes.status).json({
        success: false,
        error: `GitHub API error: ${reposRes.status} ${reposRes.statusText}`,
      });
    }

    const [profile, repos] = await Promise.all([
      profileRes.json(),
      reposRes.json(),
    ]);

    const publicRepos = repos.filter((r) => !r.private).length;
    const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24)
    );

    return res.status(200).json({
      success: true,
      data: {
        username: profile.login,
        stats: {
          publicRepos,
          totalStars,
          accountAgeDays,
          followers: profile.followers,
        },
      },
    });
  } catch (error) {
    console.error('Score preview error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate score preview',
    });
  }
}

export default withApiMiddleware(handler, {
  allowedMethods: ['GET'],
  rateLimit: 10,
  rateLimitKey: 'SCORE_PREVIEW',
});
