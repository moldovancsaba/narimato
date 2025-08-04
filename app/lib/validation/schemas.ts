import { z } from 'zod';

export const SwipeRequestSchema = z.object({
  sessionUUID: z.string().uuid(),
  cardUUID: z.string().uuid(),
  direction: z.enum(['left', 'right'])
});

export const VoteRequestSchema = z.object({
  sessionUUID: z.string().uuid(),
  cardA: z.string().uuid(),
  cardB: z.string().uuid(),
  winner: z.string().uuid(),
  timestamp: z.string().datetime({ offset: true }).default(() => new Date().toISOString())
}).refine(data => data.winner === data.cardA || data.winner === data.cardB, {
  message: "Winner must be either cardA or cardB"
});

// Enhanced Card Schema with comprehensive validation
export const CreateCardSchema = z.object({
  uuid: z.string().uuid().optional(), // UUID v4 generated server-side or provided by client
  name: z.string()
    .min(2, 'Card name must be at least 2 characters')
    .max(100, 'Card name cannot exceed 100 characters')
    .refine((name) => {
      return name.startsWith('#') && /^#[A-Z0-9_\-\s.]+$/i.test(name);
    }, {
      message: 'Name must be a valid hashtag starting with # and containing only letters, numbers, spaces, periods, hyphens, and underscores'
    }),
  body: z.object({
    imageUrl: z.string().url().optional().or(z.literal('')), // Allow empty string or valid URL
    textContent: z.string().optional().or(z.literal('')), // Allow empty string
    background: z.object({
      type: z.enum(['color', 'gradient', 'pattern']),
      value: z.string().optional(), // CSS value - optional for image-only cards
      textColor: z.string().regex(/^#[0-9a-fA-F]{3,6}$/, 'Text color must be a valid hex color').optional()
    }).optional()
  }).optional(),
  cardSize: z.string().regex(/^\d+:\d+$/, {
    message: 'Card size must be in format "width:height" (e.g., "300:400")'
  }),
  hashtags: z.array(z.string().refine((hashtag) => {
    return hashtag.startsWith('#') && /^#[A-Z0-9_\-\s.]+$/i.test(hashtag);
  }, {
    message: 'Each hashtag must start with # and contain only letters, numbers, spaces, periods, hyphens, and underscores'
  })).default([]),
  children: z.array(z.string()).optional(), // Optional children array
  isActive: z.boolean().default(true)
});

// Update Card Schema - for PATCH operations
export const UpdateCardSchema = CreateCardSchema.partial().extend({
  uuid: z.string().uuid(), // UUID is required for updates
}).omit({ uuid: true }); // Remove uuid from the schema since it's in the URL

// Standardized API Response Schema
export const CardResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  card: z.object({
    uuid: z.string().uuid(),
    name: z.string(),
    body: z.object({
      imageUrl: z.string().optional(),
      textContent: z.string().optional(),
      background: z.object({
        type: z.enum(['color', 'gradient', 'pattern']),
        value: z.string().optional(),
        textColor: z.string().optional()
      }).optional()
    }),
    cardSize: z.string(),
    hashtags: z.array(z.string()),
    children: z.array(z.string()).optional(),
    isActive: z.boolean(),
    // Meta fields computed by backend
    isPlayable: z.boolean().optional(),
    isRoot: z.boolean().optional(),
    childCount: z.number().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  }).optional(),
  error: z.string().optional(),
  details: z.any().optional()
});

// Cards List Response Schema
export const CardsListResponseSchema = z.object({
  success: z.boolean(),
  cards: z.array(CardResponseSchema.shape.card),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean()
  }).optional(),
  error: z.string().optional()
});
