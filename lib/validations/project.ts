import { z } from 'zod';
import { CardSchema } from './card';

// User identifier types
const UserIdentifierSchema = z.string();

// Helper to validate UUID format
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Project settings schema
const ProjectSettingsSchema = z.object({
  visibility: z.enum(['public', 'private']).default('public'),
  allowComments: z.boolean().default(true),
  cardOrder: z.enum(['manual', 'date', 'popularity']).default('manual'),
  isFeatured: z.boolean().default(false), // For featuring projects
});

// Project categories/tags schema
const ProjectTagSchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

// Project activity schema
const ProjectActivitySchema = z.object({
  type: z.enum([
    'created',
    'updated',
    'deleted',
    'card_added',
    'card_removed',
    'collaborator_added',
    'collaborator_removed',
    'comment_added'
  ]),
  timestamp: z.date(),
  userId: z.string(),
  details: z.record(z.any()).optional(),
});

// Base project schema
export const ProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be 100 characters or less'),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  identifierMD5: z.string().regex(/^[a-f0-9]{32}$/i, 'Invalid MD5 format'),
  isAnonymous: z.boolean().default(false),
  anonymousId: z.string().optional(),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  cards: z.array(z.string()).default([]), // Array of card IDs
  tags: z.array(ProjectTagSchema).default([]), // Project categories/tags
  settings: ProjectSettingsSchema.default({}),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  lastViewedAt: z.date().optional(), // For recently viewed tracking
  viewCount: z.number().int().min(0).default(0), // For popularity tracking
  createdBy: UserIdentifierSchema,
  collaborators: z.array(z.string()).default([]), // Array of user IDs
  activity: z.array(ProjectActivitySchema).default([]), // Project activity feed
});

// Type for incoming project creation/update
export type ProjectInput = z.input<typeof ProjectSchema>;
// Type for validated project data
export type ProjectOutput = z.output<typeof ProjectSchema>;

// Validation function for project creation
export const validateProject = (data: unknown): ProjectOutput => {
  const result = ProjectSchema.parse(data);
  return result;
};

// Validation function for project updates (partial data)
export const validateProjectUpdate = (
  data: unknown,
  existingProject?: ProjectOutput
): Partial<ProjectOutput> => {
  const updates = ProjectSchema.partial().parse(data);
  return updates;
};

// Helper function to generate a URL-friendly slug
export const generateProjectSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Schema for validating card addition to a project
 * - projectId: Required string identifier for the project
 * - cardId: Required string identifier for the card
 * - position: Optional number for card ordering within project
 */
export const AddCardSchema = z.object({
  projectId: z.string().min(1, { message: 'Project ID is required' }),
  cardId: z.string().min(1, { message: 'Card ID is required' }),
  position: z.number().optional()
});

// Type inference for the schema
export type AddCardInput = z.infer<typeof AddCardSchema>;
