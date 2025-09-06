import { validate } from '../../../../../../lib/validation/util';
import { playIdParamSchema } from '../../../../../../lib/validation/common';
import VoteOnlyService from '../../../../../../lib/services/VoteOnlyService';

const service = new VoteOnlyService();

export default async function handler(req, res) {
  const { applyRateLimit } = await import('../../../../../../lib/middleware/rateLimit');
  const keyPlay = req.query?.playId || 'unknown';
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 120, key: `vote-only:results:${keyPlay}` });
  if (limited) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { playId } = validate(playIdParamSchema, req.query || {});
    const result = await service.getResults(playId);
    return res.status(200).json(result);
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Internal error' });
  }
}

