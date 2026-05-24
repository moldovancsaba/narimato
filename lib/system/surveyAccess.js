const crypto = require('crypto');
const { connectMaster, getMasterPagePasswordModel } = require('../db');
const {
  validatePagePassword,
  getOrCreatePagePassword,
} = require('./pagePassword');

const COOKIE_NAME = 'narimato-survey-access';
const SESSION_DAYS = 30;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;
const PAGE_TYPES = ['survey', 'play'];

function encodeToken(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function decodeToken(raw) {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req?.headers?.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

async function findOrganizationIdByPassword(providedPassword) {
  if (!providedPassword?.trim()) return null;
  await connectMaster();
  const PagePassword = getMasterPagePasswordModel();
  const records = await PagePassword.find({ pageType: { $in: PAGE_TYPES } });
  for (const record of records) {
    const orgId = record.organizationId;
    const ok = await validatePagePassword(orgId, record.pageId, record.pageType, providedPassword);
    if (ok) return orgId;
  }
  return null;
}

async function orgRequiresSurveyPassword(organizationId) {
  if (!organizationId) return false;
  await connectMaster();
  const PagePassword = getMasterPagePasswordModel();
  const record = await PagePassword.findOne({
    organizationId,
    pageType: { $in: PAGE_TYPES },
    pageId: organizationId,
  });
  return !!record;
}

function getSurveyAccess(req, organizationId) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  const data = decodeToken(raw);
  if (!data || data.organizationId !== organizationId) return null;
  const exp = Date.parse(data.expiresAt || '');
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  return data;
}

function setSurveyAccessCookie(res, organizationId) {
  const value = encodeToken({
    organizationId,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(),
  });
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_SECONDS}`,
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function getOrCreateSurveyPassword(organizationId, regenerate = false) {
  return getOrCreatePagePassword(organizationId, organizationId, 'survey', regenerate);
}

async function getSurveyPasswordStatus(organizationId) {
  await connectMaster();
  const PagePassword = getMasterPagePasswordModel();
  const record = await PagePassword.findOne({
    organizationId,
    pageType: 'survey',
    pageId: organizationId,
  });
  return {
    configured: !!record,
    usageCount: record?.usageCount || 0,
    lastUsedAt: record?.lastUsedAt || null,
  };
}

module.exports = {
  COOKIE_NAME,
  findOrganizationIdByPassword,
  orgRequiresSurveyPassword,
  getSurveyAccess,
  setSurveyAccessCookie,
  getOrCreateSurveyPassword,
  getSurveyPasswordStatus,
};
