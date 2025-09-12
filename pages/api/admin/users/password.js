// FUNCTIONAL: Regenerate password for a user
// STRATEGIC: Allows secure credential rotation with server-generated passwords

import { connectDB } from '../../../../lib/db';
import User from '../../../../lib/models/User';
import { z } from 'zod';
import { validate } from '../../../../lib/validation/util';
import { randomHex, hashPassword, getSessionUser } from '../../../../lib/system/userAuth';

export default async function handler(req, res) {
  await connectDB();
  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = validate(schema, req.body || {});
    const doc = await User.findOne({ email: email.toLowerCase() });
    if (!doc) return res.status(404).json({ error: 'User not found' });
    const salt = randomHex(16);
    const plain = randomHex(16);
    doc.salt = salt;
    doc.passwordHash = hashPassword(plain, salt);
    doc.updatedAt = new Date();
    await doc.save();
    return res.status(200).json({ success: true, password: plain });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' });
  }
}
