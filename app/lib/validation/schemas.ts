import { z } from 'zod';

export const SwipeRequestSchema = z.object({
  sessionId: z.string().uuid(),
  cardId: z.string().uuid(),
  direction: z.enum(['left', 'right'])
});

export const VoteRequestSchema = z.object({
  sessionId: z.string().uuid(),
  cardA: z.string().uuid(),
  cardB: z.string().uuid(),
  winner: z.string().uuid(),
  timestamp: z.string().datetime({ offset: true }).default(() => new Date().toISOString())
}).refine(data => data.winner === data.cardA || data.winner === data.cardB, {
  message: "Winner must be either cardA or cardB"
});

export const CreateCardSchema = z.object({
  type: z.enum(['text', 'media']),
  content: z.object({
    text: z.string().nullish(),
    mediaUrl: z.string().url().nullish()
  }).superRefine((data, ctx) => {
    if (ctx.path[0] === 'type') {
      const type = ctx.path[1];
      if (type === 'text' && !data.text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Text content is required for text type cards',
          path: ['content', 'text']
        });
      } else if (type === 'media' && !data.mediaUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Media URL is required for media type cards',
          path: ['content', 'mediaUrl']
        });
      }
    }
  }),
  title: z.string().optional(),
  tags: z.array(z.string()).optional()
});
