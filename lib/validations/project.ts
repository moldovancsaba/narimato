import { z } from 'zod';
import { CardSchema } from './card';

// Project settings schema
const ProjectSettingsSchema = z.object({
  visibility: z.enum(['public', 'private']).default('private'),
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
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  cards: z.array(z.string()).default([]), // Array of card IDs
  tags: z.array(ProjectTagSchema).default([]), // Project categories/tags
  settings: ProjectSettingsSchema.default({}),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  lastViewedAt: z.date().optional(), // For recently viewed tracking
  viewCount: z.number().int().min(0).default(0), // For popularity tracking
  createdBy: z.string(), // User ID
  collaborators: z.array(z.string()).default([]), // Array of user IDs
  activity: z.array(ProjectActivitySchema).default([]), // Project activity feed
});

// Type for incoming project creation/update
export type ProjectInput = z.input<typeof ProjectSchema>;
// Type for validated project data
export type ProjectOutput = z.output<typeof ProjectSchema>;

// Validation function for project creation
export const validateProject = (data: unknown): ProjectOutput => {
  return ProjectSchema.parse(data);
};

// Validation function for project updates (partial data)
export const validateProjectUpdate = (data: unknown): Partial<ProjectOutput> => {
  return ProjectSchema.partial().parse(data);
};

// Helper function to generate a URL-friendly slug
export const generateProjectSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};
