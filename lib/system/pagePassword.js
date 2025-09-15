// FUNCTIONAL: Service helpers for page-specific passwords (create, regenerate, validate)
// STRATEGIC: Centralizes logic for secure salted hashing and shareable link creation,
// following the MVP-friendly pattern inspired by MessMass while fitting Narimato's Pages Router

const crypto = require('crypto');
const PagePassword = require('../models/PagePassword');
const { fieldNames } = require('../constants/fieldNames');

const ORG_KEY = fieldNames.OrganizationUUID; // 'organizationId'

function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashPassword(plain, salt) {
  // SHA-256(salt | plain) — simple, reproducible, and adequate for MVP scope
  return crypto.createHash('sha256').update(`${salt}|${plain}`).digest('hex');
}

async function getOrCreatePagePassword(organizationId, pageId, pageType, regenerate = false) {
  const query = { [ORG_KEY]: organizationId, pageId, pageType };
  let record = await PagePassword.findOne(query);

  // Generate new secret if missing or if regeneration requested
  if (!record || regenerate) {
    const salt = randomHex(16);
    const password = randomHex(16); // 32 hex chars
    const hash = hashPassword(password, salt);

    if (!record) {
      record = new PagePassword({
        [ORG_KEY]: organizationId,
        pageId,
        pageType,
        salt,
        hash,
        usageCount: 0,
      });
    } else {
      record.salt = salt;
      record.hash = hash;
      record.usageCount = 0; // reset metrics on regeneration
      record.lastUsedAt = null;
    }

    await record.save();
    return { password, pagePassword: record };
  }

  // Existing password — do not return the secret
  return { password: null, pagePassword: record };
}

async function validatePagePassword(organizationId, pageId, pageType, providedPassword) {
  const query = { [ORG_KEY]: organizationId, pageId, pageType };
  const record = await PagePassword.findOne(query);
  if (!record) return false;

  const computed = hashPassword(providedPassword || '', record.salt);
  const ok = crypto.timingSafeEqual(Buffer.from(record.hash, 'hex'), Buffer.from(computed, 'hex'));
  if (ok) {
    // Non-blocking updates for metrics
    try {
      record.usageCount = (record.usageCount || 0) + 1;
      record.lastUsedAt = new Date();
      await record.save();
    } catch {}
  }
  return ok;
}

function generateShareableLink(baseUrl, organizationId, pageType, pageId, plainPassword) {
  // FUNCTIONAL: Provides a direct link carrying a one-time sharable password
  // STRATEGIC: Useful for admins to distribute access quickly; consumers should
  // enter the password on the prompt; avoid permanently embedding secrets in URLs.
  const url = new URL('/play', baseUrl);
  url.searchParams.set('org', organizationId);
  url.searchParams.set('pt', pageType);
  url.searchParams.set('pid', pageId);
  if (plainPassword) url.searchParams.set('pp', plainPassword);
  return url.toString();
}

module.exports = {
  getOrCreatePagePassword,
  validatePagePassword,
  generateShareableLink,
};
