import { validate } from '../../../../../lib/validation/util';
import { playIdParamSchema } from '../../../../../lib/validation/common';
import { applyRateLimit } from '../../../../../lib/middleware/rateLimit';
import { z } from 'zod';
import { getPlayAndEngine } from '../../../../../lib/services/play/PlayDispatcher';
import { withApiVersion } from '../../../../../lib/middleware/apiVersion';
import { buildErrorEnvelope, ERROR_CODES } from '../../../../../lib/utils/errors';
import { connectDB } from '../../../../../lib/db';
// POST /api/v1/play/[playId]/input
// body: { action, payload }
export default async function handler(req, res) {
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 120, key: 'play:input' });
  if (limited) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectDB();

    const { playId } = validate(playIdParamSchema, req.query || {});
    const bodySchema = z.object({
      action: z.string(),
      payload: z.record(z.any()).optional()
    });
    const { action, payload } = validate(bodySchema, req.body || {});

    const { engine } = await getPlayAndEngine(playId);
    const result = await engine.handleInput(playId, { action, payload });
    return res.status(200).json(result);
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

