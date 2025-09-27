// FUNCTIONAL: Mongoose model for page-specific passwords (per-organization, per-page)
// STRATEGIC: Enables lightweight access control to sensitive pages (e.g., Play) without
// introducing a full user system, aligned with MVP constraints and MessMass patterns

const mongoose = require('mongoose');
const { fieldNames } = require('../constants/fieldNames');

const orgKey = fieldNames.OrganizationUUID; // 'organizationId' per centralized constants

const pagePasswordSchema = new mongoose.Schema({
  // Tenant scoping (multi-tenant alignment)
  [orgKey]: { type: String, required: true, index: true },

  // Page scoping
  pageId: { type: String, required: true }, // e.g., organization UUID when guarding Play per-org
  pageType: { type: String, required: true }, // e.g., 'play'

  // Secret storage (never store plaintext; salt + hash)
  salt: { type: String, required: true },
  hash: { type: String, required: true },

  // Observability & lifecycle
  usageCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date },
  expiresAt: { type: Date, default: null },
}, {
  timestamps: true,
});

// Unique constraint to guarantee a single password record per (org, pageType, pageId)
pagePasswordSchema.index({ [orgKey]: 1, pageType: 1, pageId: 1 }, { unique: true });

module.exports = mongoose.models.PagePassword || mongoose.model('PagePassword', pagePasswordSchema);
