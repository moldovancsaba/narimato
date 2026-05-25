const {
  connectMaster,
  getMasterIntelligenceMemoryModel,
  getMasterIntelligenceRuleModel,
  getMasterIntelligencePersonaModel,
} = require('../db');
const { normalizeHashtag } = require('./projectionNormalizer');
const { compileSystemPreamble } = require('./intelligenceStore');

const MAX_MEMORIES_CHARS = Number(process.env.PLAY_FEEDBACK_PROMPT_MEMORY_CHARS) || 2000;

async function buildGenerationContext({ organizationId, deckRootTag, topicSpecId }) {
  await connectMaster();
  const tag = deckRootTag ? normalizeHashtag(deckRootTag) : null;
  const Memory = getMasterIntelligenceMemoryModel();
  const Rule = getMasterIntelligenceRuleModel();
  const Persona = getMasterIntelligencePersonaModel();

  const personaTag = tag || '';
  let persona = await Persona.findOne({ organizationId, deckRootTag: personaTag });
  if (!persona && tag) {
    persona = await Persona.findOne({ organizationId, deckRootTag: '' });
  }

  const ruleQuery = { organizationId, active: true };
  if (tag) {
    ruleQuery.$or = [{ scope: 'org' }, { deckRootTag: tag }, ...(topicSpecId ? [{ topicSpecId }] : [])];
  }
  const rules = await Rule.find(ruleQuery).sort({ priority: -1 }).limit(20);

  const memoryQuery = { organizationId, active: true, kind: 'distilled' };
  if (tag) memoryQuery.deckRootTag = tag;
  const memories = await Memory.find(memoryQuery).sort({ weight: -1, updatedAt: -1 }).limit(15);

  let memoriesBlock = '';
  let used = 0;
  for (const m of memories) {
    const line = `- ${m.content}\n`;
    if (used + line.length > MAX_MEMORIES_CHARS) break;
    memoriesBlock += line;
    used += line.length;
  }

  const rulesBlock = rules.length
    ? rules.map((r) => `- [${r.ruleType}] ${r.text}`).join('\n')
    : '';

  const systemPreamble = persona
    ? compileSystemPreamble(persona)
    : 'You generate Narimato survey deck content aligned with observed participant preferences.';

  return {
    systemPreamble,
    rulesBlock: rulesBlock ? `Active rules:\n${rulesBlock}` : '',
    memoriesBlock: memoriesBlock ? `Play-learned memories:\n${memoriesBlock}` : '',
    personaVersion: persona?.version || null,
    memoryCount: memories.length,
    ruleCount: rules.length,
  };
}

function formatPromptSections(ctx) {
  return [ctx.systemPreamble, ctx.rulesBlock, ctx.memoriesBlock].filter(Boolean).join('\n\n');
}

module.exports = {
  buildGenerationContext,
  formatPromptSections,
};
