import { validate } from '../../../../../lib/validation/util';
import { playIdParamSchema } from '../../../../../lib/validation/common';
import { applyRateLimit } from '../../../../../lib/middleware/rateLimit';
import { getPlayAndEngine } from '../../../../../lib/services/play/PlayDispatcher';
import { withApiVersion } from '../../../../../lib/middleware/apiVersion';
import { buildErrorEnvelope, ERROR_CODES } from '../../../../../lib/utils/errors';
import { connectDB } from '../../../../../lib/db';
// GET /api/v1/play/[playId]/results
export default withApiVersion(async function handler(req, res) {
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 120, key: 'play:results' });
  if (limited) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectDB();

    const { playId } = validate(playIdParamSchema, req.query || {});
    const { engine } = await getPlayAndEngine(playId);
    const result = await engine.getResults(playId);
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
}, { deprecations: { 1: true } });

