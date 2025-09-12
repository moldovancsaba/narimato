// FUNCTIONAL: User auth utilities (hashing, verification, cookie session)
// STRATEGIC: Provides credential login aligned with MessMass-style session cookie

import crypto from 'crypto';
import { connectDB } from '../db';
const COOKIE_NAME = 'admin-session';
const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

export function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashPassword(plain, salt) {
  return crypto.createHash('sha256').update(`${salt}|${plain}`).digest('hex');
}

export function createSessionToken(user) {
  return {
    token: randomHex(16),
    userId: user._id?.toString() || 'admin',
    role: user.role || 'admin',
    email: user.email,
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
  } catch { return null; }
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

export function setSessionCookie(res, tokenData) {
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

export function clearSessionCookie(res) {
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

export function getSessionUser(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  const data = decodeToken(raw);
  if (!data) return null;
  const now = Date.now();
  const exp = Date.parse(data.expiresAt || '');
  if (!Number.isFinite(exp) || exp <= now) return null;
  return { id: data.userId, role: data.role, email: data.email, isAdmin: true };
}
