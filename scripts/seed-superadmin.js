#!/usr/bin/env node
/*
FUNCTIONAL: One-off script to create or rotate the initial superadmin (admin@narimato.com) and print a generated password once.
STRATEGIC: Bootstrap MessMass-style credential login without exposing an HTTP endpoint. Keeps logic server-side and auditable.

Usage:
  node scripts/seed-superadmin.js           # create if missing; if exists, no change
  node scripts/seed-superadmin.js --reset   # rotate password if user already exists

Notes:
- Loads .env.local to get MONGODB_URI
- Uses the same hashing scheme as lib/system/userAuth.js: sha256(`${salt}|${plain}`)
- Prints the plaintext password ONCE to stdout; store securely after running
*/

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config(); // fallback

const mongoose = require('mongoose');
const { connectDB } = require('../lib/db');
const User = require('../lib/models/User');

function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashPassword(plain, salt) {
  return crypto.createHash('sha256').update(`${salt}|${plain}`).digest('hex');
}

async function main() {
  const email = 'admin@narimato.com';
  const shouldReset = process.argv.includes('--reset');

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set. Ensure .env.local contains a valid Atlas URI.');
    process.exit(1);
  }

  try {
    await connectDB();

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      const salt = randomHex(16);
      const plain = randomHex(16);
      const passwordHash = hashPassword(plain, salt);
      user = new User({ email: email.toLowerCase(), role: 'superadmin', salt, passwordHash });
      await user.save();
      console.log('✅ Created superadmin user');
      console.log(`Email: ${email}`);
      console.log(`Password: ${plain}`);
      process.exit(0);
    }

    if (user && !shouldReset) {
      console.log('ℹ️ Superadmin already exists. No changes made. Use --reset to rotate the password.');
      console.log(`Email: ${email}`);
      process.exit(0);
    }

    // Rotate existing password
    const salt = randomHex(16);
    const plain = randomHex(16);
    user.salt = salt;
    user.passwordHash = hashPassword(plain, salt);
    user.updatedAt = new Date();
    await user.save();
    console.log('🔁 Rotated superadmin password');
    console.log(`Email: ${email}`);
    console.log(`Password: ${plain}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed superadmin:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
}

main();
