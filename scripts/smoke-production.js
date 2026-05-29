#!/usr/bin/env node
/**
 * Lightweight production smoke (no auth): HTTP 200 on public routes.
 *   PRODUCTION_URL=https://www.narimato.com node scripts/smoke-production.js
 */
const base = (process.env.PRODUCTION_URL || 'https://www.narimato.com').replace(/\/$/, '');

const paths = ['/', '/play', '/privacy', '/terms', '/admin/login'];

async function check(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  if (html.includes('Application error') || html.includes('client-side exception')) {
    throw new Error(`${path} → error page in HTML`);
  }
  return { path, status: res.status };
}

async function main() {
  const results = [];
  for (const path of paths) {
    results.push(await check(path));
  }
  console.log(`smoke-production OK (${base})`);
  for (const r of results) {
    console.log(`  ${r.path} ${r.status}`);
  }
}

main().catch((err) => {
  console.error('smoke-production failed:', err.message);
  process.exit(1);
});
