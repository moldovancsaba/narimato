const { CARD_APPROVAL } = require('./constants');

function normalizeHashtag(tag) {
  if (!tag) return null;
  const trimmed = String(tag).trim();
  if (!trimmed) return null;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function normalizeCardForProjection(card) {
  return {
    uuid: card.uuid,
    organizationId: card.organizationId,
    name: normalizeHashtag(card.name) || card.name,
    title: card.title || '',
    description: card.description || '',
    imageUrl: card.imageUrl || '',
    hashtags: (card.hashtags || []).map((h) => normalizeHashtag(h) || h),
    parentTag: normalizeHashtag(card.parentTag),
    isActive: card.isActive !== false,
    isPlayable: card.isPlayable !== false,
    isOnboarding: card.isOnboarding === true,
    isParent: card.isParent === true,
    hasChildren: card.hasChildren === true,
    childrenPlayMode: card.childrenPlayMode || 'conditional',
    hierarchyLevel: card.hierarchyLevel || 0,
    globalScore: card.globalScore ?? 1500,
    approvalStatus: card.approvalStatus || CARD_APPROVAL.APPROVED,
    source: card.source || 'manual',
  };
}

function normalizeProjection(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cards = Array.isArray(raw.cards)
    ? raw.cards.map((c) => normalizeCardForProjection(c))
    : [];
  const decks = Array.isArray(raw.decks)
    ? raw.decks.map((d) => ({
        rootTag: normalizeHashtag(d.rootTag),
        title: d.title || d.rootTag || '',
        isPlayable: d.isPlayable !== false,
        autoApprove: d.autoApprove === true,
        cardCount: d.cardCount ?? (d.cards?.length || 0),
        cards: Array.isArray(d.cards) ? d.cards.map((c) => normalizeCardForProjection(c)) : [],
      }))
    : [];
  return {
    schemaVersion: raw.schemaVersion ?? 1,
    organizationId: raw.organizationId,
    builtAt: raw.builtAt || null,
    freshness: raw.freshness || { status: 'unknown' },
    cards,
    decks,
  };
}

module.exports = {
  normalizeHashtag,
  normalizeCardForProjection,
  normalizeProjection,
};
