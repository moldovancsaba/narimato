const { v4: uuidv4 } = require('uuid');
const {
  JOB_TYPES,
  TOPIC_STATUS,
  REGEN_MODES,
  CARD_APPROVAL,
} = require('./constants');
const { withOrganization } = require('../tenantContext');
const { markOrgDirty } = require('./dirtyQueue');
const { refreshOrgProjection } = require('./projectionBuilder');
const {
  createIntelligenceCard,
  approveCard,
  maybeAutoApproveCard,
  archiveCard,
  setDeckAutoApprove,
} = require('./cardMaterializer');
const { archiveDeckSubtree, archiveBranchSubtree } = require('./archiveHelpers');
const { normalizeHashtag } = require('./projectionNormalizer');
const {
  queueAiInference,
  ollamaGenerate,
  ollamaChat,
  parseJsonResponse,
} = require('./ollama');
const {
  connectMaster,
  getMasterTopicSpecModel,
} = require('../db');
const { ingestSource } = require('./sourceService');
const { isPlayFeedbackReconciliationEnabled } = require('./playFeedback');
const { reconcilePlayFeedback } = require('./playFeedbackReconcile');
const { buildGenerationContext, formatPromptSections } = require('./promptContext');

const FIXTURE_CARDS = [
  {
    name: '#SampleDeck',
    title: 'Sample Deck',
    description: 'Root deck for intelligence smoke tests',
    parentTag: null,
    hierarchyLevel: 0,
  },
  {
    name: '#Sample-A',
    title: 'Sample Card A',
    description: 'Generated option A',
    parentTag: '#SampleDeck',
    hierarchyLevel: 1,
  },
  {
    name: '#Sample-B',
    title: 'Sample Card B',
    description: 'Generated option B',
    parentTag: '#SampleDeck',
    hierarchyLevel: 1,
  },
];

async function buildGenerationPrompt(topicSpec, organizationId) {
  const c = topicSpec.planningConstraints || {};
  const ctx = await buildGenerationContext({
    organizationId,
    deckRootTag: topicSpec.deckRootTag,
    topicSpecId: topicSpec.uuid,
  });
  const training = formatPromptSections(ctx);
  return `${training}

You are a Narimato deck architect. Generate a JSON object with key "cards" (array).
Each card: name (#HASHTAG), title, description, imageUrl (optional string), parentTag (null or #PARENT), hierarchyLevel (number).
Topic: ${topicSpec.approvedSummary || topicSpec.title}
Constraints: cardCount=${c.cardCount ?? 6}, hierarchyLevels=${c.hierarchyLevels ?? 2}, limitations=${c.limitations || 'none'}
Deck root: ${topicSpec.deckRootTag || '#SampleDeck'}
Return ONLY valid JSON.`;
}

async function materializeGeneratedCards(organizationId, cards, context) {
  const results = [];
  await withOrganization(organizationId, async () => {
    const { getTenantModels } = require('../tenantContext');
    const { Card } = getTenantModels();
    for (const spec of cards) {
      const allowReplace =
        context.regenMode === REGEN_MODES.REGENERATE_TAG ||
        context.regenMode === REGEN_MODES.REPLACE_DECK ||
        context.regenMode === REGEN_MODES.REPLACE_BRANCH;
      const isAppendOrGenerate =
        context.regenMode === REGEN_MODES.APPEND || context.regenMode === REGEN_MODES.GENERATE;
      const outcome = await createIntelligenceCard(
        { Card },
        organizationId,
        {
          ...spec,
          name: normalizeHashtag(spec.name),
          parentTag: spec.parentTag ? normalizeHashtag(spec.parentTag) : null,
        },
        {
          allowReplace:
            context.regenMode === REGEN_MODES.REGENERATE_TAG && context.regenerateTag
              ? normalizeHashtag(spec.name) === normalizeHashtag(context.regenerateTag)
              : allowReplace && !isAppendOrGenerate,
          generationJobId: context.jobUuid,
          topicSpecId: context.topicSpecId,
        }
      );
      if (outcome.skipped) {
        results.push(outcome);
        continue;
      }
      if (outcome.card) {
        await maybeAutoApproveCard(
          organizationId,
          outcome.card,
          context.deckRootTag || outcome.card.parentTag
        );
        results.push({ uuid: outcome.card.uuid, name: outcome.card.name });
      }
    }
  });
  return results;
}

async function runTopicChat(topicSpecUuid, userMessage) {
  await connectMaster();
  const TopicSpec = getMasterTopicSpecModel();
  const topicSpec = await TopicSpec.findOne({ uuid: topicSpecUuid });
  if (!topicSpec) throw new Error('TopicSpec not found');

  topicSpec.conversation.push({ role: 'user', content: userMessage });
  const messages = topicSpec.conversation.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const ctx = await buildGenerationContext({
    organizationId: topicSpec.organizationId,
    deckRootTag: topicSpec.deckRootTag,
    topicSpecId: topicSpec.uuid,
  });
  const systemIntro = formatPromptSections(ctx);
  const reply = await queueAiInference(() =>
    ollamaChat(
      [
        {
          role: 'system',
          content: `${systemIntro}

You help operators clarify Narimato deck topics. Ask concise follow-ups. When ready, summarize the approved topic.`,
        },
        ...messages,
      ],
      { format: undefined }
    )
  );

  topicSpec.conversation.push({ role: 'assistant', content: reply });
  await topicSpec.save();
  return { topicSpec, reply };
}

async function handleJob(job) {
  const { type, organizationId, payload, uuid: jobUuid } = job;

  switch (type) {
    case JOB_TYPES.PLAN_TOPIC: {
      if (!payload.topicSpecId || !payload.message) {
        throw new Error('PLAN_TOPIC requires topicSpecId and message');
      }
      const { reply } = await runTopicChat(payload.topicSpecId, payload.message);
      return { topicSpecId: payload.topicSpecId, replyLength: reply?.length || 0 };
    }

    case JOB_TYPES.APPROVE_TOPIC: {
      await connectMaster();
      const TopicSpec = getMasterTopicSpecModel();
      const topicSpec = await TopicSpec.findOne({ uuid: payload.topicSpecId });
      if (!topicSpec) throw new Error('TopicSpec not found');
      topicSpec.status = TOPIC_STATUS.APPROVED;
      if (payload.approvedSummary) {
        topicSpec.approvedSummary = payload.approvedSummary;
      }
      if (payload.deckRootTag) {
        topicSpec.deckRootTag = normalizeHashtag(payload.deckRootTag);
      }
      await topicSpec.save();
      return { topicSpecId: topicSpec.uuid, status: topicSpec.status };
    }

    case JOB_TYPES.INGEST_SOURCE: {
      const result = await ingestSource(organizationId, payload.sourceUuid);
      await markOrgDirty(organizationId);
      return result;
    }

    case JOB_TYPES.PLAN_DECK: {
      await connectMaster();
      const TopicSpec = getMasterTopicSpecModel();
      const topicSpec = await TopicSpec.findOne({ uuid: payload.topicSpecId });
      if (!topicSpec) throw new Error('TopicSpec not found');
      topicSpec.status = TOPIC_STATUS.PLANNING;
      if (payload.cardCount != null) {
        topicSpec.planningConstraints.cardCount = payload.cardCount;
      }
      if (payload.hierarchyLevels != null) {
        topicSpec.planningConstraints.hierarchyLevels = payload.hierarchyLevels;
      }
      if (payload.limitations != null) {
        topicSpec.planningConstraints.limitations = payload.limitations;
      }
      if (payload.deckRootTag) {
        topicSpec.deckRootTag = normalizeHashtag(payload.deckRootTag);
      }
      await topicSpec.save();
      return { topicSpecId: topicSpec.uuid };
    }

    case JOB_TYPES.GENERATE_DECK_CARDS:
    case JOB_TYPES.REPLACE_DECK:
    case JOB_TYPES.REPLACE_BRANCH:
    case JOB_TYPES.APPEND_CARDS:
    case JOB_TYPES.REGENERATE_TAG: {
      await connectMaster();
      const TopicSpec = getMasterTopicSpecModel();
      const topicSpec = await TopicSpec.findOne({ uuid: payload.topicSpecId });
      if (!topicSpec) throw new Error('TopicSpec not found');
      const allowed = [TOPIC_STATUS.APPROVED, TOPIC_STATUS.COMPLETED];
      if (!allowed.includes(topicSpec.status) && !payload.useFixture) {
        throw new Error(`Topic must be approved before generation (status=${topicSpec.status})`);
      }

      topicSpec.status = TOPIC_STATUS.GENERATING;
      await topicSpec.save();

      const regenMode =
        type === JOB_TYPES.GENERATE_DECK_CARDS
          ? REGEN_MODES.GENERATE
          : type === JOB_TYPES.REPLACE_DECK
            ? REGEN_MODES.REPLACE_DECK
            : type === JOB_TYPES.REPLACE_BRANCH
              ? REGEN_MODES.REPLACE_BRANCH
              : type === JOB_TYPES.APPEND_CARDS
                ? REGEN_MODES.APPEND
                : type === JOB_TYPES.REGENERATE_TAG
                  ? REGEN_MODES.REGENERATE_TAG
                  : REGEN_MODES.GENERATE;

      let cards;
      if (process.env.OLLAMA_SKIP === '1' || payload.useFixture) {
        cards = FIXTURE_CARDS;
      } else {
        const genPrompt = await buildGenerationPrompt(topicSpec, organizationId);
        const raw = await queueAiInference(() => ollamaGenerate(genPrompt));
        const parsed = parseJsonResponse(raw);
        cards = Array.isArray(parsed.cards) ? parsed.cards : parsed;
      }

      if (regenMode === REGEN_MODES.REPLACE_DECK && topicSpec.deckRootTag) {
        await withOrganization(organizationId, async () => {
          const { getTenantModels } = require('../tenantContext');
          const { Card } = getTenantModels();
          await archiveDeckSubtree(Card, organizationId, topicSpec.deckRootTag);
        });
      }

      if (regenMode === REGEN_MODES.REPLACE_BRANCH) {
        const branchTag =
          topicSpec.targetBranchTag || payload.targetBranchTag || payload.branchTag;
        if (!branchTag) throw new Error('REPLACE_BRANCH requires targetBranchTag');
        await withOrganization(organizationId, async () => {
          const { getTenantModels } = require('../tenantContext');
          const { Card } = getTenantModels();
          await archiveBranchSubtree(Card, organizationId, branchTag);
        });
      }

      const materialized = await materializeGeneratedCards(organizationId, cards, {
        jobUuid,
        topicSpecId: topicSpec.uuid,
        regenMode,
        regenerateTag: topicSpec.regenerateTag || payload.regenerateTag,
        deckRootTag: topicSpec.deckRootTag,
      });

      topicSpec.status = TOPIC_STATUS.COMPLETED;
      await topicSpec.save();
      await markOrgDirty(organizationId, topicSpec.deckRootTag);
      return { cardsCreated: materialized.length, materialized };
    }

    case JOB_TYPES.REFRESH_PROJECTION: {
      let projection;
      await withOrganization(organizationId, async () => {
        const { getTenantModels } = require('../tenantContext');
        const models = getTenantModels();
        projection = await refreshOrgProjection(organizationId, models, jobUuid);
      });
      return { builtAt: projection.builtAt, cardCount: projection.cards.length };
    }

    case JOB_TYPES.RECONCILE_PLAY_FEEDBACK: {
      if (!isPlayFeedbackReconciliationEnabled()) {
        return {
          skipped: true,
          enabled: false,
          message: 'Set INTELLIGENCE_PLAY_FEEDBACK_ENABLED=1 to enable play reconciliation',
          playId: payload.playId,
        };
      }
      return reconcilePlayFeedback({ organizationId, jobUuid, payload });
    }

    case JOB_TYPES.RECONCILE_FEEDBACK: {
      let summary;
      await withOrganization(organizationId, async () => {
        const { getTenantModels } = require('../tenantContext');
        const { Card } = getTenantModels();
        const down = await Card.find({
          organizationId,
          operatorFeedback: 'down',
          source: 'intelligence',
        });
        const up = await Card.find({
          organizationId,
          operatorFeedback: 'up',
          source: 'intelligence',
        });
        summary = {
          thumbsUp: up.length,
          thumbsDown: down.length,
          flaggedCardUuids: down.map((c) => c.uuid),
        };
        if (payload.archiveDownvoted) {
          for (const card of down) {
            if (card.approvalStatus !== CARD_APPROVAL.ARCHIVED) {
              await archiveCard(Card, card);
            }
          }
          summary.archived = down.length;
          await markOrgDirty(organizationId);
        }
      });
      return summary;
    }

    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

async function approvePendingCards(organizationId, cardUuids, deckRootTag) {
  await withOrganization(organizationId, async () => {
    const { getTenantModels } = require('../tenantContext');
    const { Card } = getTenantModels();
    for (const uuid of cardUuids) {
      const card = await Card.findOne({ uuid, organizationId });
      if (card && card.approvalStatus === CARD_APPROVAL.PENDING) {
        await approveCard(null, card);
      }
    }
  });
  await markOrgDirty(organizationId, deckRootTag);
}

async function setCardFeedback(organizationId, cardUuid, feedback) {
  await withOrganization(organizationId, async () => {
    const { getTenantModels } = require('../tenantContext');
    const { Card } = getTenantModels();
    const card = await Card.findOne({ uuid: cardUuid, organizationId });
    if (!card) throw new Error('Card not found');
    card.operatorFeedback = feedback === 'up' || feedback === 'down' ? feedback : null;
    await card.save();
  });
}

async function rejectPendingCards(organizationId, cardUuids, deckRootTag) {
  let rejected = 0;
  let skipped = 0;
  await withOrganization(organizationId, async () => {
    const { getTenantModels } = require('../tenantContext');
    const { Card } = getTenantModels();
    for (const uuid of cardUuids) {
      const card = await Card.findOne({ uuid, organizationId });
      if (card && card.approvalStatus === CARD_APPROVAL.PENDING) {
        await archiveCard(Card, card);
        rejected += 1;
      } else {
        skipped += 1;
      }
    }
  });
  if (rejected > 0) {
    await markOrgDirty(organizationId, deckRootTag);
  }
  return { rejected, skipped };
}

module.exports = {
  handleJob,
  runTopicChat,
  approvePendingCards,
  rejectPendingCards,
  setCardFeedback,
  setDeckAutoApprove,
  FIXTURE_CARDS,
};
