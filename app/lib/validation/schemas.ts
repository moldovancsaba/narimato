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
  [CARD_FIELDS.UUID]: z.string().uuid().optional(), // UUID is generated server-side
  [CARD_FIELDS.TYPE]: z.enum(['text', 'media']),
  [CARD_FIELDS.CONTENT]: z.object({
    text: z.string().nullish(),
    mediaUrl: z.string().url().nullish()
  }),
  [CARD_FIELDS.TITLE]: z.string().optional(),
  [CARD_FIELDS.TAGS]: z.array(z.string()).optional()
}).superRefine((data, ctx) => {
  // Validate content based on card type
  const type = data[CARD_FIELDS.TYPE];
  const content = data[CARD_FIELDS.CONTENT];
  
  // Validate that at least one content type is provided
  if (type === 'text' && (!content.text || content.text.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Text content is required for text type cards',
      path: [CARD_FIELDS.CONTENT, 'text']
    });
  } else if (type === 'media' && !content.mediaUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Media URL is required for media type cards',
      path: [CARD_FIELDS.CONTENT, 'mediaUrl']
    });
  }
});
