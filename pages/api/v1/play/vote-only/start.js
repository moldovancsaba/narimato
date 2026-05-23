import { validate } from '../../../../../lib/validation/util';
import { startSchema } from '../../../../../lib/validation/voteOnly';
import VoteOnlyService from '../../../../../lib/services/VoteOnlyService';
import { connectMaster } from '../../../../../lib/db';
import { withOrganization } from '../../../../../lib/tenantContext';
import { registerPlaySession } from '../../../../../lib/playSessionIndex';

const service = new VoteOnlyService();

export default async function handler(req, res) {
  const { applyRateLimit } = await import('../../../../../lib/middleware/rateLimit');
  const limited = await applyRateLimit(req, res, {
    windowMs: 60_000,
    max: 100,
    key: `vote-only:start:${req.headers['x-organization-uuid'] || 'unknown'}`,
  });
  if (limited) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectMaster();
    const { deckTag } = validate(startSchema, req.body || {});
    const orgId = req.headers['x-organization-uuid'] || req.body?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Missing organization context' });

    const result = await withOrganization(orgId, () => service.startSession(orgId, deckTag));
    await registerPlaySession(result.playId, orgId, 'vote_only');
    return res.status(200).json(result);
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Internal error' });
  }
}
