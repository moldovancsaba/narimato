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
  // FUNCTIONAL: Legacy page-password API has been removed.
  // STRATEGIC: Replaced by credential-based admin and SSR guards; this endpoint now returns 410 Gone.
  return res.status(410).json({ error: 'Gone: page-password flow removed as of v7.2.0' });
}
