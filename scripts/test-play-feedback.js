#!/usr/bin/env node
/**
 * Smoke test: PlayFeedbackEvent → RECONCILE_PLAY_FEEDBACK → memories/persona.
 * Requires MONGODB_URI, OLLAMA_SKIP=1 recommended.
 *
 *   INTELLIGENCE_PLAY_FEEDBACK_ENABLED=1 OLLAMA_SKIP=1 node scripts/test-play-feedback.js
 */
require('./load-env');
process.env.INTELLIGENCE_PLAY_FEEDBACK_ENABLED = process.env.INTELLIGENCE_PLAY_FEEDBACK_ENABLED || '1';
process.env.OLLAMA_SKIP = process.env.OLLAMA_SKIP || '1';

const { v4: uuidv4 } = require('uuid');
const { connectMaster, getMasterOrganizationModel } = require('../lib/db');
const { withOrganization } = require('../lib/tenantContext');
const { reconcilePlayFeedback } = require('../lib/intelligence/playFeedbackReconcile');
const { PLAY_FEEDBACK_SCHEMA_VERSION } = require('../lib/intelligence/constants');
const { getMasterIntelligenceMemoryModel } = require('../lib/db');

async function main() {
  await connectMaster();
  const Organization = getMasterOrganizationModel();
  const org = await Organization.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!org) throw new Error('No active organization');
  const orgId = org.uuid;
  const deck = process.env.E2E_DECK_TAG || '#SampleDeck';
  const playId = `test-play-${uuidv4()}`;

  await withOrganization(orgId, async () => {
    const { PlayFeedbackEvent } = require('../lib/tenantContext').getTenantModels();
    await PlayFeedbackEvent.create({
      schemaVersion: PLAY_FEEDBACK_SCHEMA_VERSION,
      uuid: uuidv4(),
      organizationId: orgId,
      playId,
      deckRootTag: deck,
      mode: 'swipe_only',
      completedAt: new Date(),
      personalRanking: ['card-a', 'card-b', 'card-c'],
      swipes: [
        { cardId: 'card-a', direction: 'right', timestamp: new Date() },
        { cardId: 'card-b', direction: 'left', timestamp: new Date() },
        { cardId: 'card-c', direction: 'right', timestamp: new Date() },
      ],
      votes: [],
      cardSnapshots: [
        { uuid: 'card-a', name: '#A', title: 'Winner', globalScore: 1600, voteCount: 5 },
        { uuid: 'card-b', name: '#B', title: 'Loser', globalScore: 1400, voteCount: 2 },
        { uuid: 'card-c', name: '#C', title: 'Mid', globalScore: 1500, voteCount: 3 },
      ],
    });
  });

  const result = await reconcilePlayFeedback({
    organizationId: orgId,
    jobUuid: uuidv4(),
    payload: { playId, deckRootTag: deck, mode: 'swipe_only' },
  });

  console.log('Reconcile result:', JSON.stringify(result, null, 2));

  const Memory = getMasterIntelligenceMemoryModel();
  const memories = await Memory.find({ organizationId: orgId, deckRootTag: deck }).limit(5);
  console.log('Memories:', memories.length, memories.map((m) => m.content.slice(0, 60)));

  if (!result.memoriesCreated || result.memoriesCreated < 1) {
    throw new Error('Expected at least one memory created');
  }
  console.log('✅ Play feedback MVP smoke passed');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
