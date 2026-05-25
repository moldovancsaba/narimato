/** Shared intelligence pipeline constants (webapp + local workers). */

const SCHEMA_VERSION = 1;

const PORTS = {
  SYNC: Number(process.env.INTELLIGENCE_SYNC_PORT || 10005),
  STATUS: Number(process.env.INTELLIGENCE_STATUS_PORT || 10006),
  SNAPSHOT: Number(process.env.INTELLIGENCE_SNAPSHOT_PORT || 10007),
};

const JOB_TYPES = {
  PLAN_TOPIC: 'PLAN_TOPIC',
  APPROVE_TOPIC: 'APPROVE_TOPIC',
  PLAN_DECK: 'PLAN_DECK',
  GENERATE_DECK_CARDS: 'GENERATE_DECK_CARDS',
  REPLACE_DECK: 'REPLACE_DECK',
  REPLACE_BRANCH: 'REPLACE_BRANCH',
  APPEND_CARDS: 'APPEND_CARDS',
  REGENERATE_TAG: 'REGENERATE_TAG',
  REFRESH_PROJECTION: 'REFRESH_PROJECTION',
  INGEST_SOURCE: 'INGEST_SOURCE',
  RECONCILE_FEEDBACK: 'RECONCILE_FEEDBACK',
  RECONCILE_PLAY_FEEDBACK: 'RECONCILE_PLAY_FEEDBACK',
};

const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const TOPIC_STATUS = {
  DRAFT: 'draft',
  PLANNING: 'planning',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  GENERATING: 'generating',
  COMPLETED: 'completed',
};

const CARD_APPROVAL = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ARCHIVED: 'archived',
};

const CARD_SOURCE = {
  MANUAL: 'manual',
  INTELLIGENCE: 'intelligence',
};

const GLOBAL_KEYS = {
  PROJECTION_DIRTY: 'local_ai_webapp_projection_refresh_state',
  WORKER_HEARTBEAT: 'local_ai_worker_heartbeat',
};

const OLLAMA = {
  HOST: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  MODEL: process.env.OLLAMA_MODEL || 'llama3.2:1b',
};

const REGEN_MODES = {
  GENERATE: 'generate',
  REPLACE_DECK: 'replace_deck',
  REPLACE_BRANCH: 'replace_branch',
  APPEND: 'append',
  REGENERATE_TAG: 'regenerate_tag',
};

module.exports = {
  SCHEMA_VERSION,
  PORTS,
  JOB_TYPES,
  JOB_STATUS,
  TOPIC_STATUS,
  CARD_APPROVAL,
  CARD_SOURCE,
  GLOBAL_KEYS,
  OLLAMA,
  REGEN_MODES,
};
