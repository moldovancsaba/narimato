import { validate } from '../../../../lib/validation/util';
import { applyRateLimit } from '../../../../lib/middleware/rateLimit';
import { z } from 'zod';
import { getEngineByMode } from '../../../../lib/services/play/PlayDispatcher';
import { withApiVersion, resolveVersioned } from '../../../../lib/middleware/apiVersion';
import { buildErrorEnvelope, ERROR_CODES } from '../../../../lib/utils/errors';
// POST /api/v1/play/start
// body: { organizationId, deckTag, mode }
export default async function handler(req, res) {
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 60, key: 'play:start' });
  if (limited) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const schema = z.object({
      organizationId: z.string().uuid(),
      deckTag: z.string().min(1),
      mode: z.enum(['vote_only', 'swipe_only', 'onboarding', 'swipe_more', 'vote_more', 'rank_only', 'rank_more']) // extendable
    });
    const { organizationId, deckTag, mode } = validate(schema, req.body || {});

    const engine = await getEngineByMode(mode);
    const started = await engine.startSession(organizationId, deckTag);

    const v1 = () => ({
      playId: started.playId,
      mode,
      cards: started.initial.cards,
      comparison: started.initial.comparison,
      currentCardId: started.initial.currentCardId,
      currentCard: started.initial.currentCard,
      familyLevel: started.initial.familyLevel,
      familyContext: started.initial.familyContext
    });

    const v2 = () => ({
      ...v1(),
      meta: { apiVersion: 'v2' }
    });

    const handlerMap = { 1: v1, 2: v2 };
    const payload = resolveVersioned(handlerMap, req.apiVersion)();
    return res.status(200).json(payload);
  } catch (err) {
    const status = err.statusCode || 500;
    const code = err.appCode || (status === 400 ? ERROR_CODES.VALIDATION_ERROR : ERROR_CODES.SYSTEM_FAILURE);
    const envelope = buildErrorEnvelope({
      code,
      message: err.message || 'Internal error',
      details: err.details,
      requestId: req.headers['x-request-id']?.toString(),
    });
    return res.status(status).json(envelope);
  }
}

