// FUNCTIONAL: Header validation schemas (e.g., organization scoping)
// STRATEGIC: Enforces multi-tenant context at API boundaries
import { z } from 'zod';

export const orgHeaderSchema = z.object({
  'x-organization-uuid': z.string().min(1)
});

