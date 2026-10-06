import { createHash } from 'crypto';
import { db } from '../../../lib/firebase/serverOnly';
import { withApiMiddleware } from '../../../utils/apiMiddleware';
import { logActivity } from '../../../utils/activityLogger';
import { createProjectDocument, generateProjectSlug, normalizeProjectInput, validateProjectInput } from '../../../lib/projects/projectNormalize';
import { withDeveloperAuth } from '../../../lib/developerAuth/middleware';
import { completeReceipt, prepareIdempotency, readReceipt, recordMutationAudit } from '../../../lib/developerAuth/idempotency';

const ROUTE = '/api/projects';
const ALLOWED_INPUT_FIELDS = new Set([
  'name', 'description', 'githubUrl', 'ecosystem', 'category', 'otherCategoryDetail',
  'contractAddress', 'deploymentTxHash', 'liveUrl', 'website', 'twitter', 'discord',
  'imageUrl', 'teamMembers', 'tags', 'isOpenSource', 'lookingForFunding', 'fundingAmount',
  'milestones', 'hackathons',
  'builderSnsDomain', 'builderSnsNameAccount', 'accentColor', 'archived', 'media',
]);

function repositoryId(owner, repo) {
  return createHash('sha256').update(`${owner.toLowerCase()}/${repo.toLowerCase()}`).digest('hex');
}

async function handler(req, res) {
  try {
    const unknownFields = Object.keys(req.body || {}).filter((field) => !ALLOWED_INPUT_FIELDS.has(field));
    if (unknownFields.length) {
      return res.status(400).json({ error: `Forbidden or unknown fields: ${unknownFields.join(', ')}` });
    }
    const input = normalizeProjectInput(req.body || {});
    const validation = validateProjectInput(input);
    if (!validation.isValid) return res.status(400).json({ error: validation.errors[0], errors: validation.errors });
    const slug = generateProjectSlug(input.name);
    if (!slug) return res.status(400).json({ error: 'Project slug cannot be empty' });

    let oauthVerified = false;
    try {
      const userSnap = await db.collection('users').doc(req.developer.userId).get();
      const token = userSnap.exists ? String(userSnap.data().githubAccessToken || '').trim() : '';
      if (token) {
        const { realGitHubService } = await import('../../../services/RealGitHubService');
        oauthVerified = await realGitHubService.hasRepoPushAccess(input.owner, input.repo, token);
      }
    } catch (_) {
      oauthVerified = false;
    }

    const now = new Date();
    const project = createProjectDocument(input, req.developer.userId, {
      slug, now: now.toISOString(), status: oauthVerified ? 'submitted' : 'pending_review',
    });
    const projectRef = db.collection('projects').doc(slug);
    const repoRef = db.collection('project_repository_index').doc(repositoryId(input.owner, input.repo));
    const prepared = prepareIdempotency(db, req.developer, 'POST', ROUTE, req.headers['idempotency-key'], req.body);
    const responseBody = { success: true, projectSlug: slug, message: 'Project submitted successfully and is pending review' };

    const result = await db.runTransaction(async (transaction) => {
      const receipt = await readReceipt(transaction, prepared);
      if (receipt) return { replay: true, ...receipt };
      const [existingProject, existingRepo] = await Promise.all([
        transaction.get(projectRef), transaction.get(repoRef),
      ]);
      if (existingProject.exists) {
        const error = new Error('Project with this name already exists'); error.statusCode = 409; throw error;
      }
      if (existingRepo.exists) {
        const error = new Error('A project for this GitHub repository already exists'); error.statusCode = 409; throw error;
      }
      transaction.create(projectRef, project);
      transaction.create(repoRef, { projectSlug: slug, owner: input.owner.toLowerCase(), repo: input.repo.toLowerCase(), createdAt: now });
      completeReceipt(transaction, prepared, req.developer, 'POST', ROUTE, 201, responseBody, now);
      recordMutationAudit(transaction, db, req.developer, 'project_created', `projects/${slug}`, now);
      return { statusCode: 201, responseBody };
    });
    if (result.replay) return res.status(result.statusCode).json({ ...result.responseBody, idempotentReplay: true });

    try {
      await db.collection('admin_queue').add({
        type: 'project_submission', projectSlug: slug, ecosystem: input.ecosystem,
        submittedBy: req.developer.userId, submittedAt: now, status: oauthVerified ? 'info' : 'pending',
      });
      await logActivity({ type: 'project_submitted', projectSlug: slug, projectName: input.name, userHandle: req.developer.userId, description: `New project "${input.name}" was launched!`, ecosystem: input.ecosystem });
    } catch (error) {
      console.warn('Post-commit project notification failed:', error.message);
    }
    return res.status(201).json(responseBody);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' });
  }
}

export default withApiMiddleware(withDeveloperAuth(handler, { requiredScopes: ['projects:write'] }), {
  allowedMethods: ['POST'], rateLimit: 5, rateLimitKey: 'PROJECT_SUBMIT',
});
