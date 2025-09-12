// FUNCTIONAL: Minimal admin login/logout endpoint using env-based password
// STRATEGIC: Provides an MVP admin bypass and secure cookie session without a full user DB

import { applyRateLimit } from '../../../../lib/middleware/rateLimit';
import { z } from 'zod';
import { validate } from '../../../../lib/validation/util';
import { createSessionToken, setAdminSessionCookie, clearAdminSessionCookie } from '../../../../lib/system/adminAuth';

export default async function handler(req, res) {
  // FUNCTIONAL: Legacy env-based admin login has been removed in favor of credential-based auth.
  // STRATEGIC: Consolidates authentication to user accounts and avoids dual session mechanisms.
  return res.status(410).json({ error: 'Gone: env-admin login removed as of v7.2.0. Use /api/admin/login.' });
}
