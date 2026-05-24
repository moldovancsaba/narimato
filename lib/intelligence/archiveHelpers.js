const { CARD_APPROVAL } = require('./constants');
const { normalizeHashtag } = require('./projectionNormalizer');

async function archiveCardRecord(Card, card, replacedByCardId = null) {
  card.approvalStatus = CARD_APPROVAL.ARCHIVED;
  card.isActive = false;
  card.archivedAt = new Date();
  if (replacedByCardId) card.replacedByCardId = replacedByCardId;
  await card.save();
}

async function archiveDeckSubtree(Card, organizationId, deckRootTag) {
  const root = normalizeHashtag(deckRootTag);
  const toArchive = await Card.find({
    organizationId,
    $or: [{ name: root }, { parentTag: root }],
    approvalStatus: { $ne: CARD_APPROVAL.ARCHIVED },
  });
  for (const c of toArchive) {
    await archiveCardRecord(Card, c);
  }
  return toArchive.length;
}

async function archiveBranchSubtree(Card, organizationId, branchTag) {
  const branch = normalizeHashtag(branchTag);
  const all = await Card.find({
    organizationId,
    approvalStatus: { $ne: CARD_APPROVAL.ARCHIVED },
  });
  const toArchive = all.filter((c) => {
    if (c.name === branch) return true;
    if (c.parentTag === branch) return true;
    if ((c.hashtags || []).includes(branch)) return true;
    return false;
  });
  for (const c of toArchive) {
    await archiveCardRecord(Card, c);
  }
  return toArchive.length;
}

module.exports = {
  archiveCardRecord,
  archiveDeckSubtree,
  archiveBranchSubtree,
};
