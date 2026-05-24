const { v4: uuidv4 } = require('uuid');
const { CARD_APPROVAL, CARD_SOURCE } = require('./constants');
const { normalizeHashtag } = require('./projectionNormalizer');
const {
  connectMaster,
  getMasterDeckIntelligenceConfigModel,
} = require('../db');

async function isDeckAutoApprove(organizationId, deckRootTag) {
  await connectMaster();
  const DeckConfig = getMasterDeckIntelligenceConfigModel();
  const tag = normalizeHashtag(deckRootTag);
  const cfg = await DeckConfig.findOne({ organizationId, deckRootTag: tag });
  return cfg?.autoApprove === true;
}

async function setDeckAutoApprove(organizationId, deckRootTag, autoApprove) {
  await connectMaster();
  const DeckConfig = getMasterDeckIntelligenceConfigModel();
  const tag = normalizeHashtag(deckRootTag);
  return DeckConfig.findOneAndUpdate(
    { organizationId, deckRootTag: tag },
    { organizationId, deckRootTag: tag, autoApprove: autoApprove === true },
    { upsert: true, new: true }
  );
}

async function archiveCard(Card, card, replacedByCardId = null) {
  card.approvalStatus = CARD_APPROVAL.ARCHIVED;
  card.isActive = false;
  card.archivedAt = new Date();
  if (replacedByCardId) {
    card.replacedByCardId = replacedByCardId;
  }
  await card.save();
}

async function approveCard(_Card, card) {
  card.approvalStatus = CARD_APPROVAL.APPROVED;
  card.isActive = true;
  await card.save();
  return card;
}

async function createIntelligenceCard(models, organizationId, spec, options = {}) {
  const { Card } = models;
  const name = normalizeHashtag(spec.name);
  const existing = await Card.findOne({
    organizationId,
    name,
    isActive: true,
    approvalStatus: { $ne: CARD_APPROVAL.ARCHIVED },
  });

  if (existing && !options.allowReplace) {
    return { skipped: true, reason: 'tag_exists', name, existingUuid: existing.uuid };
  }

  if (existing && options.allowReplace) {
    const newUuid = uuidv4();
    const replacement = new Card({
      uuid: newUuid,
      organizationId,
      name,
      title: spec.title || existing.title,
      description: spec.description ?? existing.description ?? '',
      imageUrl: spec.imageUrl ?? existing.imageUrl ?? '',
      hashtags: spec.hashtags || existing.hashtags || [name],
      parentTag: spec.parentTag !== undefined ? spec.parentTag : existing.parentTag,
      isActive: true,
      isPlayable: spec.isPlayable !== false,
      isOnboarding: spec.isOnboarding === true,
      hierarchyLevel: spec.hierarchyLevel ?? existing.hierarchyLevel ?? 0,
      approvalStatus: CARD_APPROVAL.PENDING,
      source: CARD_SOURCE.INTELLIGENCE,
      generationJobId: options.generationJobId || null,
      topicSpecId: options.topicSpecId || null,
      replacesCardId: existing.uuid,
      globalScore: existing.globalScore ?? 1500,
    });
    await replacement.save();
    await archiveCard(Card, existing, newUuid);
    return { card: replacement, replaced: existing.uuid };
  }

  const card = new Card({
    uuid: uuidv4(),
    organizationId,
    name,
    title: spec.title || name.replace(/^#/, ''),
    description: spec.description || '',
    imageUrl: spec.imageUrl || '',
    hashtags: spec.hashtags || (spec.parentTag ? [name, spec.parentTag] : [name]),
    parentTag: spec.parentTag || null,
    isActive: true,
    isPlayable: spec.isPlayable !== false,
    isOnboarding: spec.isOnboarding === true,
    hierarchyLevel: spec.hierarchyLevel || 0,
    approvalStatus: CARD_APPROVAL.PENDING,
    source: CARD_SOURCE.INTELLIGENCE,
    generationJobId: options.generationJobId || null,
    topicSpecId: options.topicSpecId || null,
    globalScore: 1500,
  });
  await card.save();
  return { card, skipped: false };
}

async function maybeAutoApproveCard(organizationId, card, deckRootTag) {
  const root = deckRootTag || card.parentTag || card.name;
  const auto = await isDeckAutoApprove(organizationId, root);
  if (auto) {
    await approveCard(null, card);
    return true;
  }
  return false;
}

module.exports = {
  isDeckAutoApprove,
  setDeckAutoApprove,
  archiveCard,
  approveCard,
  createIntelligenceCard,
  maybeAutoApproveCard,
};
