import { z } from 'zod';

export const voteSchema = z.object({
  winnerId: z.string().min(1),
  loserId: z.string().min(1),
  projectId: z.string().optional(),
  sessionId: z.string().optional(),
  sessionType: z.string().optional()
});
