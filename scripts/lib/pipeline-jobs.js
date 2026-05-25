/**
 * Pipeline job registry — single source for types and handler routing (issue #38).
 */
const { JOB_TYPES } = require('../../lib/intelligence/constants');
const { handleJob } = require('../../lib/intelligence/jobHandlers');
const { enqueueJob } = require('../../lib/intelligence/jobQueue');

const JOB_REGISTRY = Object.freeze({
  [JOB_TYPES.PLAN_TOPIC]: { description: 'Topic planning via operator chat', localOnly: true },
  [JOB_TYPES.APPROVE_TOPIC]: { description: 'Approve topic spec for generation', localOnly: true },
  [JOB_TYPES.PLAN_DECK]: { description: 'Set deck planning constraints on topic', localOnly: true },
  [JOB_TYPES.GENERATE_DECK_CARDS]: { description: 'Generate cards from approved topic', localOnly: true },
  [JOB_TYPES.REPLACE_DECK]: { description: 'Archive deck subtree and regenerate', localOnly: true },
  [JOB_TYPES.REPLACE_BRANCH]: { description: 'Regenerate one branch', localOnly: true },
  [JOB_TYPES.APPEND_CARDS]: { description: 'Append cards without replacing', localOnly: true },
  [JOB_TYPES.REGENERATE_TAG]: { description: 'Regenerate single hashtag', localOnly: true },
  [JOB_TYPES.REFRESH_PROJECTION]: { description: 'Rebuild webapp projection (no LLM)', localOnly: true },
  [JOB_TYPES.INGEST_SOURCE]: { description: 'Process corpus Source into topic draft', localOnly: true },
  [JOB_TYPES.RECONCILE_FEEDBACK]: { description: 'Operator thumbs reconciliation', localOnly: true },
  [JOB_TYPES.RECONCILE_PLAY_FEEDBACK]: {
    description: 'Play session → memories, rules, persona, content refinement',
    localOnly: true,
    disabledByDefault: true,
  },
});

const LEGACY_ALIASES = {
  INGEST_SOURCE: JOB_TYPES.INGEST_SOURCE,
  RECONCILE_PLAY_FEEDBACK: JOB_TYPES.RECONCILE_PLAY_FEEDBACK,
};

function resolveJobType(type) {
  return LEGACY_ALIASES[type] || type;
}

function listJobTypes() {
  return Object.entries(JOB_REGISTRY).map(([type, meta]) => ({ type, ...meta }));
}

async function runJob(job) {
  const resolved = { ...job, type: resolveJobType(job.type) };
  return handleJob(resolved);
}

module.exports = {
  JOB_REGISTRY,
  LEGACY_ALIASES,
  listJobTypes,
  resolveJobType,
  runJob,
  enqueueJob,
};
