const { enqueueJob } = require('./jobQueue');
const { JOB_TYPES } = require('./constants');

function isPlayFeedbackReconciliationEnabled() {
  return process.env.INTELLIGENCE_PLAY_FEEDBACK_ENABLED === '1';
}

/**
 * Enqueue play feedback reconciliation (stub handler; disabled unless env set).
 */
async function enqueuePlayFeedbackReconciliation({ organizationId, playId, deckRootTag, mode }) {
  if (!isPlayFeedbackReconciliationEnabled()) {
    return { enqueued: false, reason: 'disabled' };
  }
  const job = await enqueueJob({
    organizationId,
    type: JOB_TYPES.RECONCILE_PLAY_FEEDBACK,
    payload: { playId, deckRootTag: deckRootTag || null, mode: mode || null },
    priority: -1,
  });
  return { enqueued: true, jobUuid: job.uuid };
}

module.exports = {
  isPlayFeedbackReconciliationEnabled,
  enqueuePlayFeedbackReconciliation,
};
