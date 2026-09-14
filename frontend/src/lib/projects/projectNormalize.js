import { parseGitHubRepoUrl } from './githubRepo';

// Accent color palette constrained to the design system
// Builders can pick from these to personalize without breaking consistency
export const ACCENT_COLORS = [
  { name: 'Indigo', value: '#6366f1', gradient: 'from-indigo-500 to-purple-600', textClass: 'text-indigo-700', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200', heroFrom: 'from-indigo-600', heroTo: 'to-purple-600' },
  { name: 'Emerald', value: '#059669', gradient: 'from-emerald-500 to-teal-600', textClass: 'text-emerald-700', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', heroFrom: 'from-emerald-600', heroTo: 'to-teal-600' },
  { name: 'Blue', value: '#2563eb', gradient: 'from-blue-500 to-indigo-600', textClass: 'text-blue-700', bgClass: 'bg-blue-50', borderClass: 'border-blue-200', heroFrom: 'from-blue-600', heroTo: 'to-indigo-600' },
  { name: 'Violet', value: '#7c3aed', gradient: 'from-violet-500 to-purple-600', textClass: 'text-violet-700', bgClass: 'bg-violet-50', borderClass: 'border-violet-200', heroFrom: 'from-violet-600', heroTo: 'to-purple-600' },
  { name: 'Amber', value: '#d97706', gradient: 'from-amber-500 to-orange-600', textClass: 'text-amber-700', bgClass: 'bg-amber-50', borderClass: 'border-amber-200', heroFrom: 'from-amber-600', heroTo: 'to-orange-600' },
  { name: 'Rose', value: '#e11d48', gradient: 'from-rose-500 to-pink-600', textClass: 'text-rose-700', bgClass: 'bg-rose-50', borderClass: 'border-rose-200', heroFrom: 'from-rose-600', heroTo: 'to-pink-600' },
  { name: 'Cyan', value: '#0891b2', gradient: 'from-cyan-500 to-sky-600', textClass: 'text-cyan-700', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-200', heroFrom: 'from-cyan-600', heroTo: 'to-sky-600' },
  { name: 'Slate', value: '#475569', gradient: 'from-slate-600 to-slate-700', textClass: 'text-slate-700', bgClass: 'bg-slate-50', borderClass: 'border-slate-200', heroFrom: 'from-slate-600', heroTo: 'to-slate-700' },
  { name: 'Default', value: null, gradient: null, textClass: 'text-indigo-700', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200', heroFrom: 'from-indigo-600', heroTo: 'to-purple-600' },
];

export function getAccentColor(value) {
  if (!value) return ACCENT_COLORS.find(c => c.name === 'Default');
  return ACCENT_COLORS.find(c => c.value === value) || ACCENT_COLORS.find(c => c.name === 'Default');
}

export function generateProjectSlug(name = '') {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

export function cleanTags(tags) {
  if (Array.isArray(tags)) return tags.map(String).map((t) => t.trim()).filter(Boolean);
  return String(tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function cleanTeamMembers(teamMembers) {
  if (!Array.isArray(teamMembers)) return [];
  return teamMembers
    .map((member) => {
      if (typeof member === 'string') return { address: member.trim(), share: 0 };
      return {
        address: String(member?.address || '').trim(),
        share: Number.parseInt(member?.share, 10) || 0
      };
    })
    .filter((member) => member.address);
}

export function cleanMilestones(milestones) {
  if (!Array.isArray(milestones)) return [];
  return milestones.map((milestone) => String(milestone || '').trim()).filter(Boolean);
}

export function cleanMedia(media) {
  if (!Array.isArray(media)) return [];
  return media
    .map((item) => {
      const url = String(item?.url || '').trim();
      if (!url) return null;
      return {
        url,
        type: item?.type === 'video' ? 'video' : 'image',
        caption: String(item?.caption || '').trim(),
      };
    })
    .filter(Boolean);
}

export function cleanHackathons(hackathons) {
  if (!Array.isArray(hackathons)) return [];
  return hackathons
    .map((hackathon) => {
      const cleaned = {
        name: String(hackathon?.name || '').trim(),
        url: String(hackathon?.url || '').trim(),
        outcome: String(hackathon?.outcome || '').trim(),
        payoutAt: String(hackathon?.payoutAt || '').trim(),
        notes: String(hackathon?.notes || '').trim(),
        track: String(hackathon?.track || '').trim(),
        prizeAmount: String(hackathon?.prizeAmount || '').trim(),
        payoutWallet: String(hackathon?.payoutWallet || '').trim(),
        payoutTxHash: String(hackathon?.payoutTxHash || '').trim(),
        announcementUrl: String(hackathon?.announcementUrl || '').trim(),
        submissionUrl: String(hackathon?.submissionUrl || '').trim(),
        evidenceUrl: String(hackathon?.evidenceUrl || '').trim(),
        judgingNotes: String(hackathon?.judgingNotes || '').trim(),
        proofType: String(hackathon?.proofType || '').trim(),
        repoUrl: String(hackathon?.repoUrl || '').trim(),
        contractAddress: String(hackathon?.contractAddress || '').trim(),
      };

      // Optional hackathon date range for payout speed computation
      if (hackathon.hackathonEndDate) cleaned.hackathonEndDate = String(hackathon.hackathonEndDate).trim();

      const hasAnyEvidence = cleaned.name || cleaned.url || cleaned.outcome || cleaned.payoutAt || cleaned.notes || cleaned.track || cleaned.prizeAmount || cleaned.payoutWallet || cleaned.payoutTxHash || cleaned.announcementUrl || cleaned.submissionUrl || cleaned.evidenceUrl || cleaned.judgingNotes || cleaned.proofType || cleaned.repoUrl || cleaned.contractAddress;
      return hasAnyEvidence ? cleaned : null;
    })
    .filter(Boolean);
}

const HACKATHON_VERIFICATION_FIELDS = [
  'verificationStatus', 'payoutVerifiedAt', 'payoutVerified', 'payoutConfidence',
  'payoutActualAmount', 'payoutAttestationId', 'payoutProvider',
  'juryVerdict', 'juryConfidence', 'juryReason', 'juryCreditBoost', 'juryResolvedAt', 'juryContract',
];

export function mergeHackathonsWithVerification(hackathons, existing = []) {
  return cleanHackathons(hackathons).map((hackathon) => {
    const prior = existing.find((entry) => (
      String(entry?.name || '').trim().toLowerCase() === hackathon.name.toLowerCase()
      && String(entry?.url || '').trim().toLowerCase() === hackathon.url.toLowerCase()
    )) || {};
    const verification = {};
    for (const field of HACKATHON_VERIFICATION_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(prior, field)) verification[field] = prior[field];
    }
    return { ...hackathon, ...verification };
  });
}

export function normalizeProjectInput(input = {}) {
  const github = parseGitHubRepoUrl(input.githubUrl);

  return {
    name: String(input.name || '').trim(),
    description: String(input.description || '').trim(),
    githubUrl: github?.url || String(input.githubUrl || '').trim(),
    owner: github?.owner || input.owner || '',
    repo: github?.repo || input.repo || '',
    ecosystem: String(input.ecosystem || '').trim(),
    category: String(input.category || '').trim(),
    otherCategoryDetail: input.category === 'other' ? String(input.otherCategoryDetail || '').trim() : null,
    contractAddress: String(input.contractAddress || '').trim(),
    deploymentTxHash: String(input.deploymentTxHash || '').trim() || null,
    liveUrl: String(input.liveUrl || '').trim() || null,
    website: String(input.website || '').trim() || null,
    twitter: String(input.twitter || '').trim() || null,
    discord: String(input.discord || '').trim() || null,
    imageUrl: input.imageUrl || null,
    teamMembers: cleanTeamMembers(input.teamMembers),
    tags: cleanTags(input.tags),
    isOpenSource: Boolean(input.isOpenSource),
    lookingForFunding: Boolean(input.lookingForFunding),
    fundingAmount: input.lookingForFunding ? input.fundingAmount || null : null,
    milestones: cleanMilestones(input.milestones),
    hackathons: cleanHackathons(input.hackathons),
    launchOnBags: Boolean(input.launchOnBags),
    bagsTokenMetadata: input.bagsTokenMetadata || null,
    bagsTokenAddress: String(input.bagsTokenAddress || '').trim() || null,
    solanaProjectPda: String(input.solanaProjectPda || '').trim() || null,
    builderSnsDomain: String(input.builderSnsDomain || '').trim() || null,
    builderSnsNameAccount: String(input.builderSnsNameAccount || '').trim() || null,
    // Quick win: per-project accent color (constrained palette)
    accentColor: input.accentColor || null,
    // Quick win: archive state (soft-delete)
    archived: Boolean(input.archived),
    // Media gallery: [{ url, type: 'image'|'video', caption }]
    media: cleanMedia(input.media),
  };
}

export function validateProjectInput(project) {
  const errors = [];

  if (!project.name) errors.push('Project name is required');
  if (project.name && project.name.length > 120) errors.push('Project name must be 120 characters or fewer');
  if (!project.description) errors.push('Description is required');
  if (project.description && project.description.length > 5000) errors.push('Description must be 5000 characters or fewer');
  if (!parseGitHubRepoUrl(project.githubUrl)) errors.push('A valid GitHub URL is required');
  if (!project.ecosystem) errors.push('Chain / ecosystem is required');
  if (!project.category) errors.push('Category is required');
  if (project.category === 'other' && !project.otherCategoryDetail) {
    errors.push('Please specify what kind of project this is');
  }
  if (project.contractAddress && !project.contractAddress.startsWith('0x')) {
    errors.push('Contract address must start with 0x');
  }
  if (cleanTags(project.tags).length > 20) errors.push('Projects can have at most 20 tags');
  if (cleanMilestones(project.milestones).length > 30) errors.push('Projects can have at most 30 milestones');
  if (cleanHackathons(project.hackathons).length > 30) errors.push('Projects can have at most 30 hackathon entries');
  if (cleanMedia(project.media).length > 20) errors.push('Projects can have at most 20 media items');

  // accentColor must be one of the allowed palette values
  if (project.accentColor) {
    const valid = ACCENT_COLORS.some(c => c.value === project.accentColor);
    if (!valid) errors.push('Invalid accent color — must be one of the allowed palette colors');
  }

  const members = cleanTeamMembers(project.teamMembers);
  const totalShares = members.reduce((sum, member) => sum + member.share, 0);
  if (members.length > 0 && totalShares !== 100) {
    errors.push(`Total team shares must equal 100% (currently ${totalShares}%)`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Quick win: check if a project with the same GitHub URL already exists.
 * Used by the editor before submission to warn builders about duplicates.
 */
export async function checkDuplicateGitHubUrl(githubUrl, excludeSlug = null) {
  if (!githubUrl || !parseGitHubRepoUrl(githubUrl)) return null;
  try {
    const { db } = await import('@/lib/firebase/clientApp');
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const q = query(collection(db, 'projects'), where('githubUrl', '==', parseGitHubRepoUrl(githubUrl).url));
    const snap = await getDocs(q);
    const matches = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => excludeSlug ? p.slug !== excludeSlug : true);
    return matches.length > 0 ? matches[0] : null;
  } catch {
    return null;
  }
}

export function createProjectDocument(input, userId, options = {}) {
  const normalized = normalizeProjectInput(input);
  const now = options.now || new Date().toISOString();
  const slug = options.slug || generateProjectSlug(normalized.name);

  return {
    slug,
    ...normalized,
    liveUrl: normalized.liveUrl || normalized.website,
    submittedBy: userId,
    owners: Array.isArray(options.owners) && options.owners.length ? options.owners : [userId].filter(Boolean),
    submittedAt: options.submittedAt || now,
    status: options.status || 'pending_review',
    createdAt: options.createdAt || now,
    updatedAt: now,
    verified: Boolean(options.verified),
    featured: Boolean(options.featured),
    stats: {
      views: 0,
      stars: 0,
      forks: 0,
      commits: 0,
      issues: 0,
      pulls: 0,
      velocity: 5 + normalized.milestones.length * 10,
      ...(options.stats || {})
    }
  };
}
