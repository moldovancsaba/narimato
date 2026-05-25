const { v4: uuidv4 } = require('uuid');
const {
  connectMaster,
  getMasterIntelligenceMemoryModel,
  getMasterIntelligenceRuleModel,
  getMasterIntelligencePersonaModel,
  getMasterTopicSpecModel,
} = require('../db');
const { MEMORY_KIND, MEMORY_SOURCE, RULE_SCOPE, TOPIC_STATUS } = require('./constants');
const { normalizeHashtag } = require('./projectionNormalizer');

async function createMemory({
  organizationId,
  deckRootTag,
  topicSpecId,
  kind,
  content,
  weight,
  playIds,
  createdByJobId,
}) {
  await connectMaster();
  const Memory = getMasterIntelligenceMemoryModel();
  return Memory.create({
    uuid: uuidv4(),
    organizationId,
    deckRootTag: deckRootTag ? normalizeHashtag(deckRootTag) : null,
    topicSpecId: topicSpecId || null,
    kind: kind || MEMORY_KIND.DISTILLED,
    content,
    weight: weight ?? 1,
    playIds: playIds || [],
    source: MEMORY_SOURCE.PLAY,
    createdByJobId,
    active: true,
  });
}

async function createRule({
  organizationId,
  deckRootTag,
  topicSpecId,
  ruleType,
  text,
  priority,
  playIds,
  createdByJobId,
}) {
  await connectMaster();
  const Rule = getMasterIntelligenceRuleModel();
  return Rule.create({
    uuid: uuidv4(),
    organizationId,
    scope: deckRootTag ? RULE_SCOPE.DECK : RULE_SCOPE.ORG,
    deckRootTag: deckRootTag ? normalizeHashtag(deckRootTag) : null,
    topicSpecId: topicSpecId || null,
    ruleType: ruleType || 'style',
    text,
    priority: priority ?? 0,
    active: true,
    provenance: { playIds: playIds || [], jobId: createdByJobId },
  });
}

function compileSystemPreamble(persona) {
  const lines = [];
  if (persona.tone) lines.push(`Tone: ${persona.tone}`);
  if (persona.audience) lines.push(`Audience: ${persona.audience}`);
  if (persona.constraints?.length) {
    lines.push('Constraints:');
    persona.constraints.forEach((c) => lines.push(`- ${c}`));
  }
  if (persona.vocabulary?.length) {
    lines.push(`Preferred terms: ${persona.vocabulary.join(', ')}`);
  }
  if (persona.systemPreamble) lines.push(persona.systemPreamble);
  return lines.join('\n').trim();
}

async function upsertPersona({
  organizationId,
  deckRootTag,
  deltas,
  jobUuid,
}) {
  await connectMaster();
  const Persona = getMasterIntelligencePersonaModel();
  const tag = deckRootTag ? normalizeHashtag(deckRootTag) : '';
  let persona = await Persona.findOne({ organizationId, deckRootTag: tag });
  if (!persona) {
    persona = new Persona({
      uuid: uuidv4(),
      organizationId,
      deckRootTag: tag,
      version: 1,
      tone: 'professional',
      audience: 'survey participants',
      constraints: [],
      vocabulary: [],
    });
  }

  if (deltas?.tone) persona.tone = deltas.tone;
  if (deltas?.audience) persona.audience = deltas.audience;
  if (Array.isArray(deltas?.constraintsAdd)) {
    persona.constraints = [...new Set([...(persona.constraints || []), ...deltas.constraintsAdd])];
  }
  if (Array.isArray(deltas?.vocabularyAdd)) {
    persona.vocabulary = [...new Set([...(persona.vocabulary || []), ...deltas.vocabularyAdd])];
  }
  if (deltas?.changelog) persona.changelog = deltas.changelog;
  persona.version = (persona.version || 1) + 1;
  persona.updatedByJobId = jobUuid;
  persona.systemPreamble = compileSystemPreamble(persona);
  await persona.save();
  return persona;
}

async function ensureTopicSpecForDeck(organizationId, deckRootTag, jobUuid) {
  await connectMaster();
  const TopicSpec = getMasterTopicSpecModel();
  const tag = normalizeHashtag(deckRootTag);
  let topic = await TopicSpec.findOne({ organizationId, deckRootTag: tag }).sort({ updatedAt: -1 });
  if (topic) return topic;

  topic = await TopicSpec.create({
    uuid: uuidv4(),
    organizationId,
    title: `Play learnings — ${tag}`,
    status: TOPIC_STATUS.DRAFT,
    approvedSummary: `Participant feedback for ${tag}`,
    deckRootTag: tag,
    conversation: [
      {
        role: 'system',
        content: `Topic created from play feedback reconcile job ${jobUuid}`,
      },
    ],
  });
  return topic;
}

async function appendTopicConversation(topicSpecId, entry, role = 'assistant') {
  if (!topicSpecId || !entry) return null;
  await connectMaster();
  const TopicSpec = getMasterTopicSpecModel();
  const topic = await TopicSpec.findOne({ uuid: topicSpecId });
  if (!topic) return null;
  topic.conversation.push({ role, content: entry });
  await topic.save();
  return topic;
}

module.exports = {
  createMemory,
  createRule,
  upsertPersona,
  ensureTopicSpecForDeck,
  appendTopicConversation,
  compileSystemPreamble,
};
