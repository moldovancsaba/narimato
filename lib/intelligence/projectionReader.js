const { CARD_APPROVAL } = require('./constants');
const { normalizeProjection } = require('./projectionNormalizer');

const MAX_FALLBACK_CARDS = 500;

async function getProjectedCards(organizationId, models, options = {}) {
  const { parentTag, includeHidden = false } = options;
  const { IntelligenceSnapshot, Card } = models;

  const snapshot = await IntelligenceSnapshot.findOne({
    organizationId,
    deckRootTag: null,
  });

  const projection = normalizeProjection(snapshot?.webappProjection);
  if (projection?.cards?.length) {
    let cards = projection.cards.filter((c) => c.isActive !== false);
    if (parentTag) {
      const tag = parentTag.startsWith('#') ? parentTag : `#${parentTag}`;
      cards = cards.filter(
        (c) =>
          c.name !== tag &&
          (c.parentTag === tag || (c.hashtags || []).includes(tag))
      );
    }
    if (!includeHidden) {
      cards = cards.filter((c) => c.approvalStatus !== CARD_APPROVAL.ARCHIVED);
    }
    return { cards, source: 'projection', freshness: projection.freshness };
  }

  const query = {
    organizationId,
    isActive: true,
    approvalStatus: { $in: [CARD_APPROVAL.APPROVED, null] },
  };
  if (parentTag) {
    const tag = parentTag.startsWith('#') ? parentTag : `#${parentTag}`;
    query.$and = [
      { name: { $ne: tag } },
      { $or: [{ parentTag: tag }, { hashtags: tag }] },
    ];
  }

  const cards = await Card.find(query).sort({ globalScore: -1 }).limit(MAX_FALLBACK_CARDS);
  return {
    cards: cards.map((c) => (c.toObject ? c.toObject() : c)),
    source: 'fallback',
    freshness: { status: 'missing', lastRefreshAt: null },
  };
}

async function getProjectedDecks(organizationId, models, options = {}) {
  const { includeHidden = false } = options;
  const { cards, source, freshness } = await getProjectedCards(organizationId, models, {
    includeHidden,
  });

  const deckGroups = {};
  cards.forEach((card) => {
    if (card.parentTag) {
      if (!deckGroups[card.parentTag]) deckGroups[card.parentTag] = [];
      deckGroups[card.parentTag].push(card);
    }
  });

  const decks = Object.entries(deckGroups)
    .filter(([, grp]) => grp.length >= 2)
    .filter(([tag]) => {
      const parent = cards.find((c) => c.name === tag);
      if (!parent) return true;
      return includeHidden ? true : parent.isPlayable !== false;
    })
    .map(([tag, grpCards]) => ({ tag, cards: grpCards }));

  return { decks, cards, source, freshness };
}

function getFreshnessLabel(freshness) {
  if (!freshness) return 'unknown';
  return freshness.status || 'unknown';
}

module.exports = {
  getProjectedCards,
  getProjectedDecks,
  getFreshnessLabel,
};
