const { z } = require('zod');
const { SCHEMA_VERSION } = require('./constants');

const cardProjectionSchema = z.object({
  uuid: z.string(),
  organizationId: z.string().optional(),
  name: z.string(),
  title: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  parentTag: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  isPlayable: z.boolean().optional(),
  isOnboarding: z.boolean().optional(),
  isParent: z.boolean().optional(),
  hasChildren: z.boolean().optional(),
  childrenPlayMode: z.string().optional(),
  hierarchyLevel: z.number().optional(),
  globalScore: z.number().optional(),
  approvalStatus: z.string().optional(),
  source: z.string().optional(),
});

const deckProjectionSchema = z.object({
  rootTag: z.string(),
  title: z.string(),
  isPlayable: z.boolean(),
  autoApprove: z.boolean().optional(),
  cardCount: z.number(),
  cards: z.array(cardProjectionSchema),
});

const webappProjectionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  organizationId: z.string(),
  builtAt: z.string(),
  freshness: z.object({
    status: z.enum(['fresh', 'aging', 'stale', 'missing', 'unknown']),
    lastRefreshAt: z.string().nullable().optional(),
  }),
  cards: z.array(cardProjectionSchema),
  decks: z.array(deckProjectionSchema),
  rankingsSummary: z
    .object({
      topCards: z.array(
        z.object({
          uuid: z.string(),
          name: z.string(),
          title: z.string(),
          globalScore: z.number(),
        })
      ),
      generatedAt: z.string(),
    })
    .optional(),
});

function validateWebappProjection(projection) {
  return webappProjectionSchema.parse(projection);
}

module.exports = {
  webappProjectionSchema,
  validateWebappProjection,
};
