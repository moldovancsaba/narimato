// FUNCTIONAL: Admin Users API (list, create with generated password)
// STRATEGIC: Allows superadmins/admins to create users and share credentials securely

import { connectDB } from '../../../../lib/db';
import User from '../../../../lib/models/User';
import { z } from 'zod';
import { validate } from '../../../../lib/validation/util';
import { randomHex, hashPassword, getSessionUser } from '../../../../lib/system/userAuth';

export default async function handler(req, res) {
  await connectDB();
  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const users = await User.find({}).select('email role createdAt updatedAt').sort({ createdAt: -1 });
    return res.status(200).json({ users });
  }

  if (req.method === 'POST') {
    try {
      const schema = z.object({ email: z.string().email(), role: z.enum(['superadmin','admin','editor']).optional() });
      const { email, role } = validate(schema, req.body || {});
      const salt = randomHex(16);
      const plain = randomHex(16);
      const passwordHash = hashPassword(plain, salt);
      const user = new User({ email: email.toLowerCase(), role: role || 'admin', salt, passwordHash });
      await user.save();
      return res.status(201).json({ user: { email: user.email, role: user.role }, password: plain });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
