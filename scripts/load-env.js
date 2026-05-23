/**
 * Load local env for Node scripts: .env.local (Vercel pull) then .env.
 */
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

module.exports = { root };
