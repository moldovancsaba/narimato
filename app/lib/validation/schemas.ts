import { z } from 'zod';
import { SESSION_FIELDS, CARD_FIELDS, VOTE_FIELDS } from '../constants/fieldNames';

export const SwipeRequestSchema = z.object({
  [SESSION_FIELDS.ID]: z.string().uuid(),
  [CARD_FIELDS.ID]: z.string().uuid(),
  [VOTE_FIELDS.DIRECTION]: z.enum(['left', 'right'])
});

export const VoteRequestSchema = z.object({
  [SESSION_FIELDS.ID]: z.string().uuid(),
  [VOTE_FIELDS.CARD_A]: z.string().uuid(),
  [VOTE_FIELDS.CARD_B]: z.string().uuid(),
  [VOTE_FIELDS.WINNER]: z.string().uuid(),
  [VOTE_FIELDS.TIMESTAMP]: z.string().datetime({ offset: true }).default(() => new Date().toISOString())
}).refine(data => data[VOTE_FIELDS.WINNER] === data[VOTE_FIELDS.CARD_A] || data[VOTE_FIELDS.WINNER] === data[VOTE_FIELDS.CARD_B], {
  message: "Winner must be either cardA or cardB"
});

export const CreateCardSchema = z.object({
  uuid: z.string().uuid().optional(), // UUID is generated server-side or provided by client
  name: z.string().min(2).refine((name) => {
    return name.startsWith('#') && /^#[A-Z0-9_-]+$/i.test(name);
  }, {
    message: 'Name must be a valid hashtag starting with # and containing only letters, numbers, hyphens, and underscores'
  }),
  body: z.object({
    imageUrl: z.string().url().optional(),
    textContent: z.string().optional(),
    background: z.object({
      type: z.enum(['color', 'gradient', 'pattern']),
      value: z.string(),
      textColor: z.string().optional()
    }).optional()
  }).optional(),
  hashtags: z.array(z.string().refine((hashtag) => {
    return hashtag.startsWith('#') && /^#[A-Z0-9_-]+$/i.test(hashtag);
  }, {
    message: 'Each hashtag must start with # and contain only letters, numbers, hyphens, and underscores'
  })).optional(),
  isActive: z.boolean().optional()
});
