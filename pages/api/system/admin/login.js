// FUNCTIONAL: Minimal admin login/logout endpoint using env-based password
// STRATEGIC: Provides an MVP admin bypass and secure cookie session without a full user DB

import { applyRateLimit } from '../../../../lib/middleware/rateLimit';
import { z } from 'zod';
import { validate } from '../../../../lib/validation/util';
import { createSessionToken, setAdminSessionCookie, clearAdminSessionCookie } from '../../../../lib/system/adminAuth';

export default async function handler(req, res) {
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 10, key: 'system:admin:login' });
  if (limited) return;

  if (req.method === 'POST') {
    try {
      const schema = z.object({
        password: z.string().min(1),
      });
      const { password } = validate(schema, req.body || {});

      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
      if (!ADMIN_PASSWORD) {
        return res.status(501).json({ error: 'Admin login not configured (missing ADMIN_PASSWORD)' });
      }
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = createSessionToken('admin', 'super-admin');
      setAdminSessionCookie(res, token);
      return res.status(200).json({ success: true, user: { id: 'admin', role: 'super-admin' }, expiresAt: token.expiresAt });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' });
    }
  }

  if (req.method === 'DELETE') {
    clearAdminSessionCookie(res);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
