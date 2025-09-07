import { z } from 'zod';

export function validate(schema, data) {
  const res = schema.safeParse(data);
  if (!res.success) {
    const msg = res.error.errors?.map(e => e.message).join(', ') || 'Validation failed';
    const err = new Error(msg);
    err.statusCode = 400;
    // FUNCTIONAL: Attach zod error details for standardized envelope
    // STRATEGIC: Enables consistent client diagnostics without leaking internals
    err.details = res.error.errors?.map(e => ({
      path: e.path?.join('.') || '',
      message: e.message,
      code: 'invalid',
    }));
    err.appCode = 1001; // VALIDATION_ERROR taxonomy
    throw err;
  }
  return res.data;
}

