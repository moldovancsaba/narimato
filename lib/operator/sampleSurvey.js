const { connectMaster, resolveOrganization } = require('../db');
const { withOrganization, getTenantModels } = require('../tenantContext');
const { refreshOrgProjection } = require('../intelligence/projectionBuilder');
const { getOrCreateSurveyPassword, getSurveyPasswordStatus } = require('../system/surveyAccess');
const { getProjectedDecks } = require('../intelligence/projectionReader');

const SAMPLE_DECK_TAG = '#SampleDeck';

const SAMPLE_CARDS = [
  {
    uuid: '550e8400-e29b-41d4-a716-446655440001',
    name: SAMPLE_DECK_TAG,
    title: SAMPLE_DECK_TAG,
    description: 'Sample deck for testing survey access',
    hashtags: [SAMPLE_DECK_TAG],
    isParent: true,
    hasChildren: true,
    isPlayable: true,
    isActive: true,
  },
  {
    uuid: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Sample Card 1',
    title: 'Sample Card 1',
    description: 'First sample card for ranking',
    hashtags: [SAMPLE_DECK_TAG],
    parentTag: SAMPLE_DECK_TAG,
    isActive: true,
  },
  {
    uuid: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Sample Card 2',
    title: 'Sample Card 2',
    description: 'Second sample card for ranking',
    hashtags: [SAMPLE_DECK_TAG],
    parentTag: SAMPLE_DECK_TAG,
    isActive: true,
  },
  {
    uuid: '550e8400-e29b-41d4-a716-446655440004',
    name: 'Sample Card 3',
    title: 'Sample Card 3',
    description: 'Third sample card for ranking',
    hashtags: [SAMPLE_DECK_TAG],
    parentTag: SAMPLE_DECK_TAG,
    isActive: true,
  },
];

async function ensureSampleDeck(organizationId) {
  let cardsCreated = 0;

  await withOrganization(organizationId, async () => {
    const { Card } = getTenantModels();
    const existing = await Card.findOne({ organizationId, name: SAMPLE_DECK_TAG });
    if (existing) return;

    await Card.insertMany(
      SAMPLE_CARDS.map((card) => ({
        ...card,
        organizationId,
      }))
    );
    cardsCreated = SAMPLE_CARDS.length;

    const { markOrgDirty } = require('../intelligence/dirtyQueue');
    await markOrgDirty(organizationId);
  });

  return { deckTag: SAMPLE_DECK_TAG, cardsCreated };
}

async function getSurveyReadiness(organizationId) {
  if (!organizationId) {
    return {
      deckTag: SAMPLE_DECK_TAG,
      deckReady: false,
      cardCount: 0,
      playableDeckCount: 0,
      surveyConfigured: false,
      surveyUsageCount: 0,
    };
  }

  await connectMaster();
  await resolveOrganization(organizationId);

  let cardCount = 0;
  let playableDeckCount = 0;

  let pendingCount = 0;

  await withOrganization(organizationId, async () => {
    const { Card } = getTenantModels();
    const { CARD_APPROVAL } = require('../intelligence/constants');
    cardCount = await Card.countDocuments({ organizationId, isActive: { $ne: false } });
    pendingCount = await Card.countDocuments({
      organizationId,
      approvalStatus: CARD_APPROVAL.PENDING,
      isActive: { $ne: false },
    });
    const { decks } = await getProjectedDecks(organizationId, getTenantModels());
    playableDeckCount = (decks || []).filter((d) => d.isPlayable !== false).length;
  });

  const surveyStatus = await getSurveyPasswordStatus(organizationId);

  return {
    deckTag: SAMPLE_DECK_TAG,
    deckReady: playableDeckCount > 0,
    cardCount,
    playableDeckCount,
    surveyConfigured: surveyStatus.configured,
    surveyUsageCount: surveyStatus.usageCount || 0,
    pendingCount,
  };
}

async function bootstrapSampleSurvey(organizationId, { regeneratePassword = false } = {}) {
  if (!organizationId) {
    const err = new Error('organizationId required');
    err.statusCode = 400;
    throw err;
  }

  await connectMaster();
  const org = await resolveOrganization(organizationId);
  const deckResult = await ensureSampleDeck(organizationId);

  await withOrganization(organizationId, async () => {
    await refreshOrgProjection(organizationId, getTenantModels());
  });

  const surveyStatus = await getSurveyPasswordStatus(organizationId);
  const shouldCreatePassword = !surveyStatus.configured || regeneratePassword;
  const passwordResult = shouldCreatePassword
    ? await getOrCreateSurveyPassword(organizationId, regeneratePassword)
    : { password: null };

  const readiness = await getSurveyReadiness(organizationId);

  return {
    organizationId,
    organizationName: org.name,
    deckTag: deckResult.deckTag,
    cardsCreated: deckResult.cardsCreated,
    password: passwordResult.password,
    passwordCreated: !!passwordResult.password,
    surveyConfigured: readiness.surveyConfigured,
    deckReady: readiness.deckReady,
    playableDeckCount: readiness.playableDeckCount,
    publicEntryUrl: 'http://localhost:3000',
    productionEntryUrl: 'https://www.narimato.com',
  };
}

module.exports = {
  SAMPLE_DECK_TAG,
  ensureSampleDeck,
  getSurveyReadiness,
  bootstrapSampleSurvey,
};
