import { z } from 'zod';

export const playIdParamSchema = z.object({
  playId: z.string().uuid()
});

