// FUNCTIONAL: Check admin session status
// STRATEGIC: Client components can bypass password prompts when admin is authenticated

import { applyRateLimit } from '../../../../lib/middleware/rateLimit';
import { getAdminUser } from '../../../../lib/system/adminAuth';

export default async function handler(req, res) {
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 60, key: 'system:admin:auth' });
  if (limited) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = getAdminUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  return res.status(200).json({ user });
}
