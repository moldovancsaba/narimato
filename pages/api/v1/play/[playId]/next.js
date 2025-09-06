import { validate } from '../../../../../lib/validation/util';
import { playIdParamSchema } from '../../../../../lib/validation/common';
import { applyRateLimit } from '../../../../../lib/middleware/rateLimit';
import { getPlayAndEngine } from '../../../../../lib/services/play/PlayDispatcher';

// GET /api/v1/play/[playId]/next
export default async function handler(req, res) {
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 120, key: 'play:next' });
  if (limited) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { playId } = validate(playIdParamSchema, req.query || {});
    const { engine } = await getPlayAndEngine(playId);
    const result = await engine.getNext(playId);
    return res.status(200).json(result);
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Internal error' });
  }
}

