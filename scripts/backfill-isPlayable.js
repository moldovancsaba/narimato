#!/usr/bin/env node
/**
 * Deck Exposure Control Backfill Script
 *
 * FUNCTIONAL: Sets `isPlayable: true` on existing Card documents where the field is missing.
 * STRATEGIC: Ensures legacy data gets default exposure behavior, while new cards use schema default.
 *
 * Usage:
 *   node scripts/backfill-isPlayable.js
 *
 * Requirements:
 *   - MONGODB_URI must be set (Atlas only)
 */
const { connectDB } = require('../lib/db');
const Card = require('../lib/models/Card');

(async function main() {
  try {
    await connectDB();

    const criteria = { $or: [ { isPlayable: { $exists: false } }, { isPlayable: null } ] };
    const update = { $set: { isPlayable: true } };

    const res = await Card.updateMany(criteria, update);
    console.log(`✅ Backfill complete. Matched: ${res.matchedCount || res.n}, Modified: ${res.modifiedCount || res.nModified}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  }
})();

