const { v4: uuidv4 } = require('uuid');
const { connectMaster, getMasterTopicSpecModel } = require('../db');
const { withOrganization, getTenantModels } = require('../tenantContext');
const { PLAY_FEEDBACK_SCHEMA_VERSION } = require('./constants');
const { normalizeHashtag } = require('./projectionNormalizer');
const { isPlayCompleted, normalizePlaySession } = require('./playFeedbackSession');
const { getDeckFeedbackConfig } = require('./deckFeedbackConfig');

async function resolveTopicSpecId(organizationId, deckRootTag) {
  if (!deckRootTag) return null;
  await connectMaster();
  const TopicSpec = getMasterTopicSpecModel();
  const tag = normalizeHashtag(deckRootTag);
  const topic = await TopicSpec.findOne({ organizationId, deckRootTag: tag }).sort({ updatedAt: -1 });
  return topic?.uuid || null;
}

async function buildCardSnapshots(organizationId, cardUuids) {
  const { Card } = getTenantModels();
  const cards = await Card.find({ organizationId, uuid: { $in: cardUuids } });
  return cards.map((c) => ({
    uuid: c.uuid,
    name: c.name,
    title: c.title,
    globalScore: c.globalScore ?? 1500,
    voteCount: c.voteCount ?? 0,
  }));
}

/**
 * Idempotent write of PlayFeedbackEvent when a session completes.
 */
async function recordPlayFeedbackEvent({ organizationId, play, results }) {
  if (!organizationId || !play?.uuid) {
    return { recorded: false, reason: 'missing_play' };
  }
  if (!isPlayCompleted(play, results)) {
    return { recorded: false, reason: 'not_completed' };
  }

  const session = normalizePlaySession(play, results);
  if (!session.deckRootTag) {
    return { recorded: false, reason: 'missing_deck' };
  }

  const deckConfig = await getDeckFeedbackConfig(organizationId, session.deckRootTag);
  if (deckConfig.playFeedbackEnabled === false) {
    return { recorded: false, reason: 'deck_disabled' };
  }

  const minCards = Number(process.env.PLAY_FEEDBACK_MIN_SESSION_CARDS) || 3;
  if (session.participationCount < minCards) {
    return { recorded: false, reason: 'below_min_cards', participation: session.participationCount };
  }

  return withOrganization(organizationId, async () => {
    const { PlayFeedbackEvent } = getTenantModels();
    const existing = await PlayFeedbackEvent.findOne({
      organizationId,
      playId: session.playId,
    });
    if (existing) {
      return { recorded: false, reason: 'duplicate', eventUuid: existing.uuid };
    }

    const topicSpecId = await resolveTopicSpecId(organizationId, session.deckRootTag);
    const cardSnapshots = await buildCardSnapshots(organizationId, session.cardUuids);

    const event = await PlayFeedbackEvent.create({
      schemaVersion: PLAY_FEEDBACK_SCHEMA_VERSION,
      uuid: uuidv4(),
      organizationId,
      playId: session.playId,
      deckRootTag: session.deckRootTag,
      mode: session.mode,
      completedAt: session.completedAt,
      personalRanking: session.personalRanking,
      swipes: session.swipes,
      votes: session.votes,
      cardSnapshots,
      topicSpecId,
    });

    return { recorded: true, eventUuid: event.uuid, deckRootTag: session.deckRootTag };
  });
}

module.exports = {
  recordPlayFeedbackEvent,
  resolveTopicSpecId,
};
