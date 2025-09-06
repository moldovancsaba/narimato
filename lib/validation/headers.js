import { z } from 'zod';

export const orgHeaderSchema = z.object({
  'x-organization-uuid': z.string().min(1)
});

