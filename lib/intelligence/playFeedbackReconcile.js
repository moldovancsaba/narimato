const {
  queueAiInference,
  ollamaGenerate,
  parseJsonResponse,
} = require('./ollama');
const { validateReconcileOutput } = require('./playFeedbackSchema');
const { mergeEventIntoAggregate, buildTrainingBundle } = require('./playFeedbackExtractor');
const {
  createMemory,
  createRule,
  upsertPersona,
  ensureTopicSpecForDeck,
  appendTopicConversation,
} = require('./intelligenceStore');
const { enqueueJob } = require('./jobQueue');
const { JOB_TYPES, REGEN_MODES } = require('./constants');
const { withOrganization } = require('../tenantContext');
const { markOrgDirty } = require('./dirtyQueue');
const { getDeckFeedbackConfig } = require('./deckFeedbackConfig');
const { archiveCard } = require('./cardMaterializer');
const { normalizeHashtag } = require('./projectionNormalizer');
const { recordPlayFeedbackEvent } = require('./playFeedbackRecorder');

function fixtureReconcileOutput(bundle) {
  const topTitle = bundle.topCards?.[0]?.title || 'top choice';
  const bottomTitle = bundle.bottomCards?.[0]?.title || 'weak option';
  return {
    insights: [
      `Participants ranked "${topTitle}" highest across ${bundle.sessionCount} session(s).`,
      `"${bottomTitle}" was often rejected or ranked low.`,
    ],
    proposedMemories: [
      {
        kind: 'distilled',
        content: `Prefer content similar to "${topTitle}"; de-emphasize themes like "${bottomTitle}".`,
        weight: 1.2,
      },
    ],
    proposedRules: [
      {
        ruleType: 'must_avoid',
        text: `Avoid new cards that repeat the weaknesses of "${bottomTitle}".`,
        priority: 5,
      },
    ],
    personaDeltas: {
      constraintsAdd: ['Ground card copy in observed participant rankings'],
      changelog: 'Fixture play-feedback training pass',
    },
    contentActions: [],
    topicSpecConversationEntry: `Play learnings (${bundle.mode}): favor "${topTitle}", reduce "${bottomTitle}".`,
  };
}

function buildReconcilePrompt(bundle, topicSummary) {
  return `You are Narimato intelligence training. Analyze participant play feedback and return ONLY valid JSON with keys:
insights (string[]), proposedMemories ({kind, content, weight}[]), proposedRules ({ruleType, text, priority}[]),
personaDeltas ({tone?, audience?, constraintsAdd?, vocabularyAdd?, changelog?}),
contentActions ({type: archive_card|regenerate_tag|append_cards, cardUuid?, tag?, parentTag?, count?, reason?}[]),
topicSpecConversationEntry (string).

Deck: ${bundle.deckRootTag}
Mode: ${bundle.mode}
Sessions in aggregate: ${bundle.sessionCount}
Confidence: ${bundle.confidence}
Topic summary: ${topicSummary || 'n/a'}
Personal ranking (card uuids): ${JSON.stringify(bundle.personalRanking)}
Top cards: ${JSON.stringify(bundle.topCards)}
Bottom cards: ${JSON.stringify(bundle.bottomCards)}
Swipe summary: ${JSON.stringify(bundle.swipeRates)}
Be conservative: prefer memories and rules over destructive contentActions.`;
}

async function loadFeedbackEvent(organizationId, payload, models) {
  const { PlayFeedbackEvent } = models;
  if (payload.eventUuid) {
    const byUuid = await PlayFeedbackEvent.findOne({ uuid: payload.eventUuid, organizationId });
    if (byUuid) return byUuid;
  }
  if (payload.playId) {
    const byPlay = await PlayFeedbackEvent.findOne({ organizationId, playId: payload.playId });
    if (byPlay) return byPlay;
  }
  return null;
}

async function applyContentActions({
  organizationId,
  actions,
  deckRootTag,
  topicSpecId,
  jobUuid,
  autoApply,
}) {
  const enqueued = [];
  const applied = [];

  for (const action of actions || []) {
    if (!autoApply) {
      applied.push({ ...action, status: 'pending_hitl' });
      continue;
    }

    if (action.type === 'archive_card' && action.cardUuid) {
      await withOrganization(organizationId, async () => {
        const { getTenantModels } = require('../tenantContext');
        const { Card } = getTenantModels();
        const card = await Card.findOne({ uuid: action.cardUuid, organizationId });
        if (card) {
          await archiveCard(Card, card);
          applied.push({ type: action.type, cardUuid: action.cardUuid, status: 'archived' });
        }
      });
      continue;
    }

    if (action.type === 'regenerate_tag' && action.tag && topicSpecId) {
      const job = await enqueueJob({
        organizationId,
        type: JOB_TYPES.REGENERATE_TAG,
        payload: {
          topicSpecId,
          regenerateTag: normalizeHashtag(action.tag),
          useFixture: process.env.OLLAMA_SKIP === '1',
        },
      });
      enqueued.push(job.uuid);
      applied.push({ type: action.type, tag: action.tag, status: 'enqueued', jobUuid: job.uuid });
      continue;
    }

    if (action.type === 'append_cards' && topicSpecId) {
      const job = await enqueueJob({
        organizationId,
        type: JOB_TYPES.APPEND_CARDS,
        payload: {
          topicSpecId,
          useFixture: process.env.OLLAMA_SKIP === '1',
        },
      });
      enqueued.push(job.uuid);
      applied.push({ type: action.type, status: 'enqueued', jobUuid: job.uuid });
    }
  }

  if (applied.some((a) => a.status === 'archived') || enqueued.length) {
    await markOrgDirty(organizationId, deckRootTag);
  }

  return { applied, enqueued };
}

/**
 * Full RECONCILE_PLAY_FEEDBACK pipeline (MVP).
 */
async function reconcilePlayFeedback({ organizationId, jobUuid, payload }) {
  let event;
  let aggregate;
  let topicSpecId;
  let skippedResult = null;

  await withOrganization(organizationId, async () => {
    const models = require('../tenantContext').getTenantModels();
    event = await loadFeedbackEvent(organizationId, payload, models);

    if (!event && payload.playId) {
      const { runWithPlay } = require('../services/play/PlayDispatcher');
      try {
        await runWithPlay(payload.playId, async ({ play, engine }) => {
          const results = await engine.getResults(payload.playId);
          await recordPlayFeedbackEvent({ organizationId, play, results });
        });
        event = await loadFeedbackEvent(organizationId, { playId: payload.playId }, models);
      } catch {
        /* play not found */
      }
    }

    if (!event) {
      throw new Error('PlayFeedbackEvent not found; complete play session first');
    }
    if (event.reconciledAt) {
      skippedResult = { skipped: true, reason: 'already_reconciled', eventUuid: event.uuid };
      return;
    }

    aggregate = await mergeEventIntoAggregate(event, models);
    topicSpecId = event.topicSpecId;
  });

  if (skippedResult) return skippedResult;

  const deckConfig = await getDeckFeedbackConfig(organizationId, event.deckRootTag);
  if (deckConfig.playFeedbackEnabled === false) {
    return { skipped: true, reason: 'deck_disabled' };
  }

  const cardsByUuid = Object.fromEntries(
    (event.cardSnapshots || []).map((c) => [c.uuid, c])
  );
  const bundle = buildTrainingBundle(event, aggregate, cardsByUuid);

  let topicSummary = '';
  if (topicSpecId) {
    const { connectMaster, getMasterTopicSpecModel } = require('../db');
    await connectMaster();
    const topic = await getMasterTopicSpecModel().findOne({ uuid: topicSpecId });
    topicSummary = topic?.approvedSummary || topic?.title || '';
  }

  let parsed;
  if (process.env.OLLAMA_SKIP === '1') {
    parsed = fixtureReconcileOutput(bundle);
  } else {
    const raw = await queueAiInference(() =>
      ollamaGenerate(buildReconcilePrompt(bundle, topicSummary))
    );
    parsed = validateReconcileOutput(parseJsonResponse(raw));
  }

  if (!topicSpecId) {
    const topic = await ensureTopicSpecForDeck(organizationId, event.deckRootTag, jobUuid);
    topicSpecId = topic.uuid;
    event.topicSpecId = topicSpecId;
    await withOrganization(organizationId, async () => {
      const { PlayFeedbackEvent } = require('../tenantContext').getTenantModels();
      await PlayFeedbackEvent.updateOne({ uuid: event.uuid }, { topicSpecId });
    });
  }

  const memoryIds = [];
  for (const mem of parsed.proposedMemories || []) {
    const row = await createMemory({
      organizationId,
      deckRootTag: event.deckRootTag,
      topicSpecId,
      kind: mem.kind,
      content: mem.content,
      weight: mem.weight,
      playIds: [event.playId],
      createdByJobId: jobUuid,
    });
    memoryIds.push(row.uuid);
  }

  const ruleIds = [];
  for (const rule of parsed.proposedRules || []) {
    const row = await createRule({
      organizationId,
      deckRootTag: event.deckRootTag,
      topicSpecId,
      ruleType: rule.ruleType,
      text: rule.text,
      priority: rule.priority,
      playIds: [event.playId],
      createdByJobId: jobUuid,
    });
    ruleIds.push(row.uuid);
  }

  let personaVersion = null;
  if (parsed.personaDeltas) {
    const persona = await upsertPersona({
      organizationId,
      deckRootTag: event.deckRootTag,
      deltas: parsed.personaDeltas,
      jobUuid,
    });
    personaVersion = persona.version;
  }

  if (parsed.topicSpecConversationEntry) {
    await appendTopicConversation(topicSpecId, parsed.topicSpecConversationEntry);
  }

  const { applied, enqueued } = await applyContentActions({
    organizationId,
    actions: parsed.contentActions,
    deckRootTag: event.deckRootTag,
    topicSpecId,
    jobUuid,
    autoApply: deckConfig.autoApplyPlayInsights,
  });

  await enqueueJob({
    organizationId,
    type: JOB_TYPES.REFRESH_PROJECTION,
    payload: {},
    priority: 0,
  });

  await withOrganization(organizationId, async () => {
    const { PlayFeedbackEvent } = require('../tenantContext').getTenantModels();
    await PlayFeedbackEvent.updateOne(
      { uuid: event.uuid },
      { reconciledAt: new Date(), reconcileJobId: jobUuid, topicSpecId }
    );
  });

  return {
    eventUuid: event.uuid,
    playId: event.playId,
    deckRootTag: event.deckRootTag,
    aggregateSessionCount: aggregate.sessionCount,
    insights: parsed.insights,
    memoriesCreated: memoryIds.length,
    rulesCreated: ruleIds.length,
    personaVersion,
    contentActions: applied,
    followUpJobs: enqueued,
    topicSpecId,
  };
}

module.exports = {
  reconcilePlayFeedback,
  fixtureReconcileOutput,
};
