import { validate } from '../../../../../lib/validation/util';
import { startSchema } from '../../../../../lib/validation/voteOnly';
import VoteOnlyService from '../../../../../lib/services/VoteOnlyService';

const service = new VoteOnlyService();

export default async function handler(req, res) {
  // Rate limit: 100 req/min per IP+org
  const { applyRateLimit } = await import('../../../../../lib/middleware/rateLimit');
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 100, key: `vote-only:start:${req.headers['x-organization-uuid']||'unknown'}` });
  if (limited) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { deckTag } = validate(startSchema, req.body || {});
    const orgId = req.headers['x-organization-uuid'] || req.body?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Missing organization context' });

    const result = await service.startSession(orgId, deckTag);
    return res.status(200).json(result);
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Internal error' });
  }
}

