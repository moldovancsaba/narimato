import { validate } from '../../../../../lib/validation/util';
import { playIdParamSchema } from '../../../../../lib/validation/common';
import { connectMaster, getMasterPlaySessionIndexModel } from '../../../../../lib/db';
import { buildErrorEnvelope, ERROR_CODES } from '../../../../../lib/utils/errors';

// GET /api/v1/play/{playId}/meta — resolve tenant from master PlaySessionIndex
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectMaster();
    const { playId } = validate(playIdParamSchema, req.query || {});
    const PlaySessionIndex = getMasterPlaySessionIndexModel();
    const row = await PlaySessionIndex.findOne({ playId }).lean();
    if (!row) {
      const err = new Error('Play not found');
      err.statusCode = 404;
      err.appCode = ERROR_CODES.NOT_FOUND;
      throw err;
    }
    return res.status(200).json({
      playId: row.playId,
      organizationId: row.organizationId,
      mode: row.mode || '',
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const code =
      err.appCode || (status === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.SYSTEM_FAILURE);
    const envelope = buildErrorEnvelope({
      code,
      message: err.message || 'Internal error',
      details: err.details,
      requestId: req.headers['x-request-id']?.toString(),
    });
    return res.status(status).json(envelope);
  }
}
