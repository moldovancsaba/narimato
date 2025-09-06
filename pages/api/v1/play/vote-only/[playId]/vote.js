import { validate } from '../../../../../../lib/validation/util';
import { voteSchema } from '../../../../../../lib/validation/voteOnly';
import { playIdParamSchema } from '../../../../../../lib/validation/common';
import VoteOnlyService from '../../../../../../lib/services/VoteOnlyService';

const service = new VoteOnlyService();

export default async function handler(req, res) {
  const { applyRateLimit } = await import('../../../../../../lib/middleware/rateLimit');
  const keyPlay = req.query?.playId || 'unknown';
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 50, key: `vote-only:vote:${keyPlay}` });
  if (limited) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { playId } = validate(playIdParamSchema, req.query || {});
    const { winner, loser } = validate(voteSchema, req.body || {});
    const result = await service.submitVote(playId, winner, loser);
    return res.status(200).json(result);
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Internal error' });
  }
}

