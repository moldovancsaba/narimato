const { SCHEMA_VERSION, CARD_APPROVAL } = require('./constants');
const { normalizeHashtag, normalizeCardForProjection } = require('./projectionNormalizer');
const {
  connectMaster,
  getMasterDeckIntelligenceConfigModel,
} = require('../db');

async function buildWebappProjection(organizationId, models) {
  const { Card } = models;
  const cards = await Card.find({
    organizationId,
    isActive: true,
    approvalStatus: { $in: [CARD_APPROVAL.APPROVED, null] },
  }).sort({ globalScore: -1 });

  await connectMaster();
  const DeckConfig = getMasterDeckIntelligenceConfigModel();
  const deckConfigs = await DeckConfig.find({ organizationId });
  const autoApproveMap = Object.fromEntries(
    deckConfigs.map((c) => [normalizeHashtag(c.deckRootTag), c.autoApprove === true])
  );

  const normalized = cards.map((c) => normalizeCardForProjection(c.toObject ? c.toObject() : c));

  const deckGroups = {};
  normalized.forEach((card) => {
    if (card.parentTag) {
      const tag = card.parentTag;
      if (!deckGroups[tag]) deckGroups[tag] = [];
      deckGroups[tag].push(card);
    }
  });

  const decks = Object.entries(deckGroups)
    .filter(([, grp]) => grp.length >= 2)
    .map(([rootTag, grpCards]) => {
      const parent = normalized.find((c) => c.name === rootTag);
      return {
        rootTag,
        title: parent?.title || rootTag,
        isPlayable: parent ? parent.isPlayable !== false : true,
        autoApprove: autoApproveMap[rootTag] === true,
        cardCount: grpCards.length,
        cards: grpCards,
      };
    });

  const builtAt = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    organizationId,
    builtAt,
    freshness: {
      status: 'fresh',
      lastRefreshAt: builtAt,
    },
    cards: normalized,
    decks,
  };
}

async function refreshOrgProjection(organizationId, models, sourceJobId = null) {
  const { IntelligenceSnapshot } = models;
  const projection = await buildWebappProjection(organizationId, models);
  await IntelligenceSnapshot.findOneAndUpdate(
    { organizationId, deckRootTag: null },
    {
      organizationId,
      deckRootTag: null,
      schemaVersion: SCHEMA_VERSION,
      webappProjection: projection,
      builtAt: new Date(),
      sourceJobId,
    },
    { upsert: true, new: true }
  );
  return projection;
}

module.exports = {
  buildWebappProjection,
  refreshOrgProjection,
};
