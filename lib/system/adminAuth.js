// FUNCTIONAL: Minimal admin session utilities using an HttpOnly cookie
// STRATEGIC: Provides an MVP-friendly admin bypass and protected operations
// without adding a full auth stack; modeled after MessMass patterns

import crypto from 'crypto';

const COOKIE_NAME = 'admin-session';
const ONE_DAY_S = 24 * 60 * 60;
const SEVEN_DAYS_S = 7 * ONE_DAY_S;

function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function createSessionToken(userId = 'admin', role = 'super-admin') {
  return {
    token: randomHex(16),
    userId,
    role,
    expiresAt: new Date(Date.now() + SEVEN_DAYS_S * 1000).toISOString(),
  };
}

function encodeToken(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

function decodeToken(base64) {
  try {
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

export function setAdminSessionCookie(res, tokenData) {
  const value = encodeToken(tokenData);
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SEVEN_DAYS_S}`,
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAdminSessionCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=deleted`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function getAdminUser(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  const data = decodeToken(raw);
  if (!data) return null;
  const now = Date.now();
  const exp = Date.parse(data.expiresAt || '');
  if (!Number.isFinite(exp) || exp <= now) return null;
  return {
    id: data.userId || 'admin',
    role: data.role || 'super-admin',
    isAdmin: true,
  };
}
