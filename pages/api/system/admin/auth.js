// FUNCTIONAL: Legacy env-admin session check removed.
// STRATEGIC: Use credential session via /api/admin/login; this endpoint now returns 410 Gone.
export default async function handler(req, res) {
  return res.status(410).json({ error: 'Gone: env-admin auth removed as of v7.2.0. Use /api/admin/login (GET) for status.' });
}
