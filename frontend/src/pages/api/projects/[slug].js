import { createHash } from 'crypto';
import { db } from '../../../lib/firebase/serverOnly';
import { withApiMiddleware } from '../../../utils/apiMiddleware';
import { authorizeProject, withDeveloperAuth } from '../../../lib/developerAuth/middleware';
import { completeReceipt, prepareIdempotency, readReceipt, recordMutationAudit } from '../../../lib/developerAuth/idempotency';
import { mergeHackathonsWithVerification, normalizeProjectInput, validateProjectInput } from '../../../lib/projects/projectNormalize';
import { parseGitHubRepoUrl } from '../../../lib/projects/githubRepo';

const ALLOWED = new Set([
  'name', 'description', 'githubUrl', 'ecosystem', 'category', 'contractAddress',
  'deploymentTxHash', 'website', 'twitter', 'discord', 'teamMembers', 'tags',
  'isOpenSource', 'lookingForFunding', 'fundingAmount', 'milestones', 'hackathons',
  'testerTasks', 'imageUrl', 'liveUrl', 'otherCategoryDetail', 'media',
  'builderSnsDomain',
  'builderSnsNameAccount', 'accentColor', 'archived',
]);

function cleanTesterTasks(value) {
  if (!Array.isArray(value) || value.length > 20) return null;
  const tasks = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const task = {
      id: String(item.id || '').trim().slice(0, 100),
      title: String(item.title || '').trim().slice(0, 200),
      description: String(item.description || '').trim().slice(0, 2000),
      rewardUSDC: Number(item.rewardUSDC || 0),
      evidenceRequirements: Array.isArray(item.evidenceRequirements)
        ? item.evidenceRequirements.slice(0, 20).map((entry) => String(entry).slice(0, 500))
        : [],
      startAt: item.startAt ? String(item.startAt) : null,
      endAt: item.endAt ? String(item.endAt) : null,
      limit: Number.isInteger(item.limit) && item.limit > 0 ? item.limit : null,
      reviewPolicy: item.reviewPolicy === 'auto' ? 'auto' : 'manual',
    };
    if (!task.title || !Number.isFinite(task.rewardUSDC) || task.rewardUSDC < 0) return null;
    tasks.push(task);
  }
  return tasks;
}

function repoId(githubUrl) {
  const parsed = parseGitHubRepoUrl(githubUrl);
  return parsed ? createHash('sha256').update(`${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`).digest('hex') : null;
}

function requireScope(developer, scope) {
  return developer.type !== 'api_key' || developer.scopes.includes(scope);
}

async function handler(req, res) {
  const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
  if (!slug) return res.status(400).json({ error: 'Slug is required' });
  const projectRef = db.collection('projects').doc(slug);
  if (req.method === 'GET') {
    const snap = await projectRef.get();
    return snap.exists ? res.status(200).json({ id: snap.id, ...snap.data() }) : res.status(404).json({ error: 'Project not found' });
  }

  const scope = req.method === 'DELETE' ? 'projects:delete' : 'projects:write';
  if (!requireScope(req.developer, scope)) return res.status(403).json({ error: 'Insufficient scope' });
  const route = `/api/projects/${encodeURIComponent(slug)}`;
  let activeBackings = 0;
  if (req.method === 'DELETE') {
    const snap = await db.collection('backings').where('projectSlug', '==', slug).where('status', '==', 'active').get();
    activeBackings = snap.size;
  }

  try {
    const prepared = prepareIdempotency(db, req.developer, req.method, route, req.headers['idempotency-key'], req.body);
    const now = new Date();
    const result = await db.runTransaction(async (transaction) => {
      const receipt = await readReceipt(transaction, prepared);
      if (receipt) return { replay: true, ...receipt };
      const existingSnap = await transaction.get(projectRef);
      if (!existingSnap.exists) { const error = new Error('Project not found'); error.statusCode = 404; throw error; }
      const existing = existingSnap.data();
      if (!await authorizeProject(db, req.developer.userId, existing, transaction)) { const error = new Error('Forbidden'); error.statusCode = 403; throw error; }

      if (req.method === 'DELETE') {
        let responseBody;
        if (activeBackings > 0) {
          const expiry = new Date(now.getTime() + 30 * 86400000);
          transaction.update(projectRef, {
            status: 'winding_down', windingDownAt: now, windingDownExpiry: expiry,
            windingDownReason: existing.windingDownReason || 'Builder requested deletion', updatedAt: now,
          });
          responseBody = { success: true, status: 'winding_down', activeBackings, expiresAt: expiry };
        } else {
          transaction.delete(projectRef);
          const oldRepoId = repoId(existing.githubUrl);
          if (oldRepoId) transaction.delete(db.collection('project_repository_index').doc(oldRepoId));
          responseBody = { success: true, status: 'deleted' };
        }
        completeReceipt(transaction, prepared, req.developer, req.method, route, 200, responseBody, now);
        recordMutationAudit(transaction, db, req.developer, 'project_deleted', `projects/${slug}`, now);
        return { statusCode: 200, responseBody };
      }

      const body = req.body || {};
      const invalid = Object.keys(body).filter((key) => !ALLOWED.has(key));
      if (invalid.length) { const error = new Error(`Forbidden or unknown update fields: ${invalid.join(', ')}`); error.statusCode = 400; throw error; }
      const normalized = normalizeProjectInput({ ...existing, ...body });
      const validation = validateProjectInput(normalized);
      if (!validation.isValid) { const error = new Error(validation.errors[0]); error.statusCode = 400; throw error; }
      const updates = { updatedAt: now };
      for (const key of Object.keys(body)) {
        if (Object.prototype.hasOwnProperty.call(normalized, key)) updates[key] = normalized[key];
      }
      if (Object.prototype.hasOwnProperty.call(body, 'testerTasks')) {
        const tasks = cleanTesterTasks(body.testerTasks);
        if (!tasks) { const error = new Error('Invalid testerTasks'); error.statusCode = 400; throw error; }
        updates.testerTasks = tasks;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'hackathons')) {
        updates.hackathons = mergeHackathonsWithVerification(body.hackathons, existing.hackathons);
      }
      if (Object.prototype.hasOwnProperty.call(body, 'githubUrl')) {
        const parsed = parseGitHubRepoUrl(body.githubUrl);
        if (!parsed) { const error = new Error('Invalid GitHub URL'); error.statusCode = 400; throw error; }
        updates.githubUrl = parsed.url; updates.owner = parsed.owner; updates.repo = parsed.repo;
        const newId = repoId(parsed.url);
        const oldId = repoId(existing.githubUrl);
        if (newId !== oldId) {
          const newRef = db.collection('project_repository_index').doc(newId);
          const indexSnap = await transaction.get(newRef);
          if (indexSnap.exists) { const error = new Error('A project for this GitHub repository already exists'); error.statusCode = 409; throw error; }
          transaction.create(newRef, { projectSlug: slug, owner: parsed.owner.toLowerCase(), repo: parsed.repo.toLowerCase(), createdAt: now });
          if (oldId) transaction.delete(db.collection('project_repository_index').doc(oldId));
        }
      }
      transaction.update(projectRef, updates);
      const responseBody = { success: true };
      completeReceipt(transaction, prepared, req.developer, req.method, route, 200, responseBody, now);
      recordMutationAudit(transaction, db, req.developer, 'project_updated', `projects/${slug}`, now);
      return { statusCode: 200, responseBody };
    });
    return res.status(result.statusCode).json(result.replay ? { ...result.responseBody, idempotentReplay: true } : result.responseBody);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' });
  }
}

const authenticatedMutations = withDeveloperAuth(handler);
export default withApiMiddleware(async (req, res) => req.method === 'GET' ? handler(req, res) : authenticatedMutations(req, res), {
  allowedMethods: ['GET', 'PUT', 'DELETE'], rateLimit: 30, rateLimitKey: 'PROJECT_DETAIL',
});
