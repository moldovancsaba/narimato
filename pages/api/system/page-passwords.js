// FUNCTIONAL: API for creating/regenerating and validating page-specific passwords
// STRATEGIC: Central endpoint to guard pages (e.g., Play) per-organization without a full auth stack

export default async function handler(req, res) {
  // FUNCTIONAL: Legacy page-password API has been removed.
  // STRATEGIC: Replaced by credential-based admin and SSR guards; this endpoint now returns 410 Gone.
  return res.status(410).json({ error: 'Gone: page-password flow removed as of v7.2.0' });
}
