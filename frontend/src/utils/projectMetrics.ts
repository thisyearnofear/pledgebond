/**
 * Expedition Metrics — Pure functions for deriving backer-facing metrics from project data.
 *
 * Uses every available data signal to produce meaningful differentiation between
 * projects. When explicit financial fields (backerCount, totalBacked) are absent,
 * we fall back to proxy signals: description quality, GitHub presence, ecosystem
 * fit, submission completeness, and account age.
 */

interface ProjectStats {
  isActive?: boolean;
  commits?: number;
  lastCommit?: string | null;
  healthScore?: number;
  stars?: number;
  forks?: number;
  issues?: number;
  pulls?: number;
}

interface ProjectData {
  stats?: ProjectStats;
  backerCount?: number;
  totalBacked?: number;
  targetFunding?: number;
  lastCheckInTimestamp?: string;
  sectors?: string[];
  category?: string;
  description?: string;
  githubUrl?: string;
  owner?: string;
  repo?: string;
  ecosystem?: string;
  createdAt?: any;
  updatedAt?: any;
  status?: string;
  name?: string;
  slug?: string;
  socials?: {
    twitter?: string;
    discord?: string;
    website?: string;
  };
  founders?: string[];
  [key: string]: any;
}

/**
 * Deterministic hash from a string to a number in [0, range).
 * Used to create stable per-project variation without randomness.
 */
function stableHash(str: string, range: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % range;
}

/**
 * Calculate project health from available stats.
 * Falls back to proxy signals when explicit stats are missing.
 */
export function calculateHealth(project: ProjectData, now: number = Date.now()): number {
  const stats = project.stats || {};
  let score = 30; // lower baseline — 50 was too generous for empty projects

  // Explicit activity signals (from GitHub data)
  if (stats.isActive) score += 20;
  if ((stats.commits ?? 0) > 10) score += 10;
  if ((stats.commits ?? 0) > 50) score += 5;
  if ((stats.commits ?? 0) > 100) score += 5;
  if ((stats.stars ?? 0) > 10) score += 5;
  if ((stats.stars ?? 0) > 100) score += 5;
  if (stats.lastCommit) {
    const daysSince = (now - new Date(stats.lastCommit).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) score += 15;
    else if (daysSince < 30) score += 10;
    else if (daysSince < 90) score += 5;
    else score -= 10;
  }
  if (stats.healthScore) score = Math.round((score + stats.healthScore) / 2);

  // Proxy signals when GitHub data is absent
  const description = project.description || '';
  const hasRepo = !!(project.owner && project.repo) || !!(project.githubUrl);
  const hasSocials = !!(project.socials?.twitter || project.socials?.website);
  const hasMultipleFounders = (project.founders?.length || 0) > 1;

  if (!stats.commits && hasRepo) score += 10; // linked repo without stats still counts
  if (description.length > 100) score += 5;
  if (description.length > 300) score += 5;
  if (hasSocials) score += 5;
  if (hasMultipleFounders) score += 5;

  // Recency of submission — recent projects are more likely active
  if (project.createdAt) {
    const created = typeof project.createdAt === 'object' && project.createdAt.toDate
      ? project.createdAt.toDate()
      : new Date(project.createdAt);
    const daysSinceCreation = (now - created.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) score += 10;
    else if (daysSinceCreation < 90) score += 5;
  }

  // Stable per-project variation based on slug/id to break ties
  const seed = project.slug || project.id || project.name || '';
  score += stableHash(seed, 8); // adds 0-7 deterministically

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate backer confidence from backing data.
 * When no backing data exists, returns a data-completeness-based baseline.
 */
export function calculateConfidence(project: ProjectData): number {
  const backerCount = project.backerCount || 0;
  const totalBacked = project.totalBacked || 0;
  const targetFunding = project.targetFunding || 10000;

  // If real backing data exists, use the financial signal
  if (backerCount > 0 || totalBacked > 0) {
    const backerSignal = Math.min(backerCount / 10, 1) * 40;
    const fundingSignal = Math.min(totalBacked / targetFunding, 1) * 50;
    return Math.min(100, Math.round(backerSignal + fundingSignal + 10));
  }

  // No backing data — derive confidence from project completeness signals
  let baseline = 8; // lower floor for truly empty projects

  const description = project.description || '';
  if (description.length > 50) baseline += 8;
  if (description.length > 200) baseline += 7;
  if (description.length > 500) baseline += 5;

  if (project.githubUrl) baseline += 6;
  if (project.owner && project.repo) baseline += 4;
  if (project.ecosystem) baseline += 3;
  if (project.category) baseline += 3;
  if (project.socials?.website) baseline += 4;
  if (project.socials?.twitter) baseline += 3;
  if ((project.founders?.length || 0) > 0) baseline += 4;

  // Stable variation
  const seed = project.slug || project.id || '';
  baseline += stableHash(seed + '_conf', 6);

  return Math.max(5, Math.min(100, Math.round(baseline)));
}

/**
 * Derive hours since last check-in from available data.
 */
export function deriveLastCheckIn(project: ProjectData, now: number = Date.now()): number {
  if (project.lastCheckInTimestamp) {
    return Math.floor((now - new Date(project.lastCheckInTimestamp).getTime()) / (1000 * 60 * 60));
  }
  if (project.stats?.lastCommit) {
    return Math.floor((now - new Date(project.stats.lastCommit).getTime()) / (1000 * 60 * 60));
  }
  // Use updatedAt or createdAt as last known activity signal
  const activityDate = project.updatedAt || project.createdAt;
  if (activityDate) {
    const date = typeof activityDate === 'object' && activityDate.toDate
      ? activityDate.toDate()
      : new Date(activityDate);
    const hours = Math.floor((now - date.getTime()) / (1000 * 60 * 60));
    if (hours < 8760) return hours; // within a year — use it
  }
  return 168; // default stale
}

/**
 * Enhance a raw Firestore project with derived expedition metrics.
 */
export function enhanceProject(p: ProjectData, now: number = Date.now()) {
  const health = calculateHealth(p, now);
  const confidence = calculateConfidence(p);
  const totalBacked = p.totalBacked || 0;
  const targetFunding = p.targetFunding || 10000;
  const lastCheckIn = deriveLastCheckIn(p, now);

  // Determine the best category label
  const category = p.sectors?.[0] || p.category || 'General';

  // Compute a submission quality score (0-100) for sorting
  const description = p.description || '';
  let submissionQuality = 0;
  if (description.length > 50) submissionQuality += 20;
  if (description.length > 200) submissionQuality += 15;
  if (description.length > 500) submissionQuality += 10;
  if (p.githubUrl) submissionQuality += 15;
  if (p.owner && p.repo) submissionQuality += 10;
  if (p.ecosystem) submissionQuality += 5;
  if (p.category) submissionQuality += 5;
  if (p.socials?.website) submissionQuality += 5;
  if (p.socials?.twitter) submissionQuality += 5;
  if ((p.founders?.length || 0) > 0) submissionQuality += 5;
  if ((p.founders?.length || 0) > 1) submissionQuality += 5;

  return {
    ...p,
    confidence,
    health,
    totalBacked,
    targetFunding,
    lastCheckIn,
    category,
    submissionQuality,
    // Truncated description for card display
    shortDescription: description.length > 120
      ? description.substring(0, 117) + '...'
      : description,
  };
}
