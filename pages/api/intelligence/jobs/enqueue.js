const { connectMaster } = require('../../../../lib/db');
const { enqueueJob } = require('../../../../lib/intelligence/jobQueue');
const { JOB_TYPES } = require('../../../../lib/intelligence/constants');
const { resolveJobType } = require('../../../../scripts/lib/pipeline-jobs');

const ALLOWED_WEBAPP_JOBS = new Set([
  JOB_TYPES.INGEST_SOURCE,
  JOB_TYPES.GENERATE_DECK_CARDS,
  JOB_TYPES.REFRESH_PROJECTION,
  JOB_TYPES.RECONCILE_PLAY_FEEDBACK,
]);

/**
 * Enqueue pipeline jobs from webapp (master DB). Workers run on local Mac only.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await connectMaster();
    const { organizationId, type, payload = {}, priority = 0 } = req.body || {};
    if (!organizationId || !type) {
      return res.status(400).json({ error: 'organizationId and type required' });
    }

    const resolved = resolveJobType(type);
    if (!ALLOWED_WEBAPP_JOBS.has(resolved)) {
      return res.status(400).json({
        error: `Job type not allowed from webapp: ${type}`,
        allowed: [...ALLOWED_WEBAPP_JOBS],
      });
    }

    const job = await enqueueJob({
      organizationId,
      type: resolved,
      payload,
      priority,
    });

    return res.status(201).json({
      job: {
        uuid: job.uuid,
        type: job.type,
        status: job.status,
        organizationId: job.organizationId,
      },
      note: 'Job runs on local intelligence sync worker (127.0.0.1:10005)',
    });
  } catch (err) {
    console.error('Enqueue job API:', err);
    return res.status(500).json({ error: err.message || 'Enqueue failed' });
  }
}
