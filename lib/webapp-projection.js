/**
 * Single adapter for IntelligenceSnapshot.webappProjection (issue #33).
 * All API routes should use these helpers instead of ad-hoc JSON parsing.
 */
const { SCHEMA_VERSION, CARD_APPROVAL } = require('./intelligence/constants');
const {
  normalizeHashtag,
  normalizeCardForProjection,
  normalizeProjection,
} = require('./intelligence/projectionNormalizer');
const { validateWebappProjection } = require('./intelligence/projectionSchema');

const FRESHNESS_MS = {
  FRESH: Number(process.env.PROJECTION_FRESH_MS || 5 * 60 * 1000),
  AGING: Number(process.env.PROJECTION_AGING_MS || 60 * 60 * 1000),
};

/**
 * @typedef {'fresh'|'aging'|'stale'|'missing'|'unknown'} ProjectionFreshnessStatus
 */

/**
 * Compute freshness from builtAt and dirty flag (WEBAPP_READ_MODEL_LLD).
 * @param {string|null} builtAt ISO timestamp
 * @param {{ isDirty?: boolean }} [options]
 * @returns {{ status: ProjectionFreshnessStatus, lastRefreshAt: string|null }}
 */
function getProjectionFreshness(builtAt, options = {}) {
  if (options.isDirty) {
    return { status: 'stale', lastRefreshAt: builtAt || null };
  }
  if (!builtAt) {
    return { status: 'missing', lastRefreshAt: null };
  }
  const age = Date.now() - new Date(builtAt).getTime();
  if (age <= FRESHNESS_MS.FRESH) {
    return { status: 'fresh', lastRefreshAt: builtAt };
  }
  if (age <= FRESHNESS_MS.AGING) {
    return { status: 'aging', lastRefreshAt: builtAt };
  }
  return { status: 'stale', lastRefreshAt: builtAt };
}

/**
 * Validate and normalize raw projection JSON with defaults.
 * @param {object|null} raw
 * @param {{ organizationId?: string, isDirty?: boolean }} [options]
 * @returns {object|null}
 */
function normalizeWebappProjection(raw, options = {}) {
  const base = normalizeProjection(raw);
  if (!base) return null;

  const builtAt = base.builtAt || raw?.builtAt || null;
  const freshness =
    raw?.freshness?.status && raw.freshness.status !== 'fresh' && !options.isDirty
      ? raw.freshness
      : getProjectionFreshness(builtAt, { isDirty: options.isDirty });

  const normalized = {
    schemaVersion: base.schemaVersion ?? SCHEMA_VERSION,
    organizationId: base.organizationId || options.organizationId || raw?.organizationId,
    builtAt: builtAt || new Date().toISOString(),
    freshness,
    cards: base.cards,
    decks: base.decks,
    rankingsSummary: raw?.rankingsSummary || null,
  };

  try {
    return validateWebappProjection(normalized);
  } catch {
    return normalized;
  }
}

function getFreshnessLabel(freshness) {
  if (!freshness) return 'unknown';
  return freshness.status || 'unknown';
}

module.exports = {
  FRESHNESS_MS,
  normalizeHashtag,
  normalizeCardForProjection,
  normalizeWebappProjection,
  getProjectionFreshness,
  getFreshnessLabel,
};
