import { validate } from '../../../../lib/validation/util';
import { applyRateLimit } from '../../../../lib/middleware/rateLimit';
import { z } from 'zod';
import { getEngineByMode } from '../../../../lib/services/play/PlayDispatcher';

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
      mode: z.enum(['vote_only', 'swipe_only', 'swipe_more', 'vote_more']) // extendable
    });
    const { organizationId, deckTag, mode } = validate(schema, req.body || {});

    const engine = await getEngineByMode(mode);
    const started = await engine.startSession(organizationId, deckTag);

    return res.status(200).json({
      playId: started.playId,
      mode,
      cards: started.initial.cards,
      comparison: started.initial.comparison,
      currentCardId: started.initial.currentCardId,
      currentCard: started.initial.currentCard,
      familyLevel: started.initial.familyLevel,
      familyContext: started.initial.familyContext
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Internal error' });
  }
}

