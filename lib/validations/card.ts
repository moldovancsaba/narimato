import { z } from 'zod';

// Define reusable schema fragments
const commonCardFields = {
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  hashtags: z.array(z.string().startsWith('#')).default([]),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  isDeleted: z.boolean().default(false),
};

// Translations are optional for all card types
// This allows maximum flexibility while maintaining 
// internationalization support when needed

// Translation schema for text cards
export const TranslationSchema = z.object({
  locale: z.string().min(2).max(5), // e.g., 'en', 'en-US'
  title: z.string().min(1),
  content: z.string().min(1),
  description: z.string().optional(),
});

// Schema for project-specific rankings
export const ProjectRankingSchema = z.object({
  projectId: z.string(),
  rank: z.number().int(),
  votes: z.number().int().default(0),
  lastVotedAt: z.date().optional(),
});

// Base card schema without type-specific fields
const baseCardSchema = z.object({
  ...commonCardFields,
  globalScore: z.number().int().default(1500), // Initial ELO rating
  likes: z.number().int().min(0).default(0),
  dislikes: z.number().int().min(0).default(0),
  projectRankings: z.array(ProjectRankingSchema).default([]),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Image card specific validation
export const ImageCardSchema = baseCardSchema.extend({
  type: z.literal('image'),
  content: z.string().url('Image URL must be valid'),
  imageAlt: z.string().min(1, 'Alt text is required for accessibility'),
  translations: z.array(TranslationSchema).optional(),
});

// Text card specific validation
export const TextCardSchema = baseCardSchema.extend({
  type: z.literal('text'),
  content: z.string().min(1, 'Content is required'),
  translations: z.array(TranslationSchema).default([]),
});

// Combined card schema using discriminated union
export const CardSchema = z.discriminatedUnion('type', [
  ImageCardSchema,
  TextCardSchema,
]);

// Type for incoming card creation/update
export type CardInput = z.input<typeof CardSchema>;
// Type for validated card data
export type CardOutput = z.output<typeof CardSchema>;

// Validation function for card creation
export const validateCard = (data: unknown): CardOutput => {
  console.log('[Card Validation] Validating new card data');
  try {
    const validatedData = CardSchema.parse(data);
    console.log('[Card Validation] Card data validation successful');
    return validatedData;
  } catch (error) {
    console.error('[Card Validation] Card validation failed:', error);
    throw error;
  }
};

// Validation function for card updates (partial data)
export const validateCardUpdate = (data: unknown): Partial<CardOutput> => {
  console.log('[Card Validation] Validating card update data');
  const mergedSchema = z.object({
    type: z.string(),
    globalScore: z.number().int().default(1500),
    likes: z.number().int().min(0).default(0),
    dislikes: z.number().int().min(0).default(0),
    projectRankings: z.array(ProjectRankingSchema).default([]),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
    ...commonCardFields
  }).partial();

  if (typeof data === 'object' && data !== null && 'type' in data) {
    const cardData = data as any;
    if (cardData.type === 'image') {
      return mergedSchema.extend({
        type: z.literal('image'),
        content: z.string().url('Image URL must be valid'),
        imageAlt: z.string().min(1, 'Alt text is required for accessibility'),
        translations: z.array(TranslationSchema).optional(),
      }).parse(cardData);
    }

    if (cardData.type === 'text') {
      return mergedSchema.extend({
        type: z.literal('text'),
        content: z.string().min(1, 'Content is required'),
        translations: z.array(TranslationSchema).default([]),
      }).parse(cardData);
    }
  }

  console.error('[Card Validation] Invalid card type:', data);
  throw new Error('Invalid card type');
};

// Helper function to generate a URL-friendly slug
export const generateSlug = (title: string): string => {
  console.log('[Slug Generator] Generating slug from title:', title);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  console.log('[Slug Generator] Generated slug:', slug);
  return slug;
};
