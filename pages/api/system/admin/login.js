// FUNCTIONAL: Legacy env-based admin login has been removed in favor of credential-based auth.
// STRATEGIC: Consolidates authentication to user accounts and avoids dual session mechanisms.
export default async function handler(req, res) {
  return res.status(410).json({ error: 'Gone: env-admin login removed as of v7.2.0. Use /api/admin/login.' });
}
