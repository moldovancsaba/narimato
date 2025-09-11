// FUNCTIONAL: Shared zod schemas for common parameters
// STRATEGIC: Reuse validation primitives across API routes for consistency
import { z } from 'zod';

export const playIdParamSchema = z.object({
  playId: z.string().uuid()
});

