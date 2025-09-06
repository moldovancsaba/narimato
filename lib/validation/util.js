import { z } from 'zod';

export function validate(schema, data) {
  const res = schema.safeParse(data);
  if (!res.success) {
    const msg = res.error.errors?.map(e => e.message).join(', ') || 'Validation failed';
    const err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
  return res.data;
}

