// FUNCTIONAL: API for creating/regenerating and validating page-specific passwords
// STRATEGIC: Central endpoint to guard pages (e.g., Play) per-organization without a full auth stack

import { applyRateLimit } from '../../../lib/middleware/rateLimit';
import { z } from 'zod';
import { validate } from '../../../lib/validation/util';
const { connectDB } = require('../../../lib/db');
import { getAdminUser } from '../../../lib/system/adminAuth';
// Use CJS service to avoid ESM/CJS interop issues in existing codebase
const { getOrCreatePagePassword, validatePagePassword, generateShareableLink } = require('../../../lib/system/pagePassword');

function getBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'http').toString();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost').toString();
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  const key = `system:page-passwords:${req.method}`;
  const limited = await applyRateLimit(req, res, { windowMs: 60_000, max: 60, key });
  if (limited) return;

  if (!['POST', 'PUT'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  if (req.method === 'POST') {
    try {
      // Admin-only: create/regenerate
      const admin = getAdminUser(req);
      if (!admin) return res.status(403).json({ error: 'Admin privileges required' });

      const schema = z.object({
        organizationId: z.string().uuid(),
        pageId: z.string().min(1),
        pageType: z.string().min(1),
        regenerate: z.boolean().optional().default(false),
      });
      const { organizationId, pageId, pageType, regenerate } = validate(schema, req.body || {});

      const { password, pagePassword } = await getOrCreatePagePassword(organizationId, pageId, pageType, regenerate === true);
      const shareableLink = password ? generateShareableLink(getBaseUrl(req), organizationId, pageType, pageId, password) : null;
      return res.status(200).json({ success: true, organizationId, pageId, pageType, password, shareableLink, updatedAt: pagePassword.updatedAt });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const schema = z.object({
        organizationId: z.string().uuid(),
        pageId: z.string().min(1),
        pageType: z.string().min(1),
        password: z.string().min(1).optional(),
      });
      const { organizationId, pageId, pageType, password } = validate(schema, req.body || {});

      // Admin bypass
      const admin = getAdminUser(req);
      if (admin) return res.status(200).json({ success: true, isValid: true, isAdmin: true });

      const isValid = await validatePagePassword(organizationId, pageId, pageType, password || '');
      return res.status(200).json({ success: true, isValid, isAdmin: false });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' });
    }
  }
}
