// FUNCTIONAL: Admin login/logout/status via credentialed users
// STRATEGIC: Centralizes admin session management for protected routes (MessMass-style)

import { connectDB } from '../../../lib/db';
import User from '../../../lib/models/User';
import { z } from 'zod';
import { validate } from '../../../lib/validation/util';
import { hashPassword, createSessionToken, setSessionCookie, clearSessionCookie, getSessionUser } from '../../../lib/system/userAuth';

export default async function handler(req, res) {
  await connectDB();

  if (req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    return res.status(200).json({ user });
  }

  if (req.method === 'POST') {
    try {
      const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
      const { email, password } = validate(schema, req.body || {});
      const doc = await User.findOne({ email: email.toLowerCase() });
      if (!doc) return res.status(401).json({ error: 'Invalid credentials' });
      const computed = hashPassword(password, doc.salt);
      if (computed !== doc.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
      const token = createSessionToken(doc);
      setSessionCookie(res, token);
      return res.status(200).json({ success: true, user: { email: doc.email, role: doc.role }, expiresAt: token.expiresAt });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' });
    }
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
