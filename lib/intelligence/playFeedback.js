const { enqueueJob } = require('./jobQueue');
const { JOB_TYPES, JOB_STATUS } = require('./constants');
const { connectMaster, getMasterPipelineJobModel } = require('../db');
const { recordPlayFeedbackEvent } = require('./playFeedbackRecorder');

function isPlayFeedbackReconciliationEnabled() {
  return process.env.INTELLIGENCE_PLAY_FEEDBACK_ENABLED === '1';
}

async function hasRecentReconcileJob(organizationId, playId) {
  const hours = Number(process.env.PLAY_FEEDBACK_RECONCILE_COOLDOWN_H) || 24;
  const since = new Date(Date.now() - hours * 3600 * 1000);
  await connectMaster();
  const PipelineJob = getMasterPipelineJobModel();
  const existing = await PipelineJob.findOne({
    organizationId,
    type: JOB_TYPES.RECONCILE_PLAY_FEEDBACK,
    status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RUNNING, JOB_STATUS.COMPLETED] },
    'payload.playId': playId,
    createdAt: { $gte: since },
  });
  return Boolean(existing);
}

/**
 * Record play feedback event and enqueue reconcile job when enabled.
 */
async function processPlayFeedbackOnComplete({ organizationId, play, results }) {
  const record = await recordPlayFeedbackEvent({ organizationId, play, results });
  if (!isPlayFeedbackReconciliationEnabled()) {
    return { ...record, reconcile: { enqueued: false, reason: 'disabled' } };
  }
  if (!record.recorded) {
    return { ...record, reconcile: { enqueued: false, reason: record.reason } };
  }
  if (await hasRecentReconcileJob(organizationId, play.uuid)) {
    return { ...record, reconcile: { enqueued: false, reason: 'cooldown' } };
  }
  const reconcile = await enqueuePlayFeedbackReconciliation({
    organizationId,
    playId: play.uuid,
    deckRootTag: record.deckRootTag,
    mode: play.mode,
    eventUuid: record.eventUuid,
  });
  return { ...record, reconcile };
}

async function enqueuePlayFeedbackReconciliation({
  organizationId,
  playId,
  deckRootTag,
  mode,
  eventUuid,
}) {
  if (!isPlayFeedbackReconciliationEnabled()) {
    return { enqueued: false, reason: 'disabled' };
  }
  const job = await enqueueJob({
    organizationId,
    type: JOB_TYPES.RECONCILE_PLAY_FEEDBACK,
    payload: {
      playId,
      deckRootTag: deckRootTag || null,
      mode: mode || null,
      eventUuid: eventUuid || null,
    },
    priority: -1,
  });
  return { enqueued: true, jobUuid: job.uuid };
}

module.exports = {
  isPlayFeedbackReconciliationEnabled,
  hasRecentReconcileJob,
  recordPlayFeedbackEvent,
  processPlayFeedbackOnComplete,
  enqueuePlayFeedbackReconciliation,
};
