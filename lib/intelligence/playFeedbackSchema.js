const { z } = require('zod');

const reconcileOutputSchema = z.object({
  insights: z.array(z.string()).default([]),
  proposedMemories: z
    .array(
      z.object({
        kind: z.enum(['episodic', 'distilled', 'operator_note']).default('distilled'),
        content: z.string(),
        weight: z.number().optional(),
      })
    )
    .default([]),
  proposedRules: z
    .array(
      z.object({
        ruleType: z
          .enum(['must_include', 'must_avoid', 'style', 'factual', 'safety'])
          .default('style'),
        text: z.string(),
        priority: z.number().optional(),
      })
    )
    .default([]),
  personaDeltas: z
    .object({
      tone: z.string().optional(),
      audience: z.string().optional(),
      constraintsAdd: z.array(z.string()).optional(),
      vocabularyAdd: z.array(z.string()).optional(),
      changelog: z.string().optional(),
    })
    .optional(),
  contentActions: z
    .array(
      z.object({
        type: z.enum(['archive_card', 'regenerate_tag', 'append_cards']),
        cardUuid: z.string().optional(),
        tag: z.string().optional(),
        parentTag: z.string().optional(),
        count: z.number().optional(),
        reason: z.string().optional(),
      })
    )
    .default([]),
  topicSpecConversationEntry: z.string().optional(),
});

function validateReconcileOutput(data) {
  return reconcileOutputSchema.parse(data);
}

module.exports = {
  reconcileOutputSchema,
  validateReconcileOutput,
};
