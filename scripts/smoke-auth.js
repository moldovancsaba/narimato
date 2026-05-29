#!/usr/bin/env node
/**
 * Auth smoke: unauthenticated guards always; optional session when credentials are set.
 *
 *   PRODUCTION_URL=https://www.narimato.com npm run smoke:auth
 *   SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... npm run smoke:auth
 */
const base = (process.env.PRODUCTION_URL || 'https://www.narimato.com').replace(/\/$/, '');

function parseCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  return raw.split(/,(?=\s*\w+=)/).map((c) => c.split(';')[0].trim()).join('; ');
}

async function expectStatus(url, init, expected) {
  const res = await fetch(url, { redirect: 'manual', ...init });
  if (res.status !== expected) {
    throw new Error(`${url} → ${res.status}, expected ${expected}`);
  }
  return res;
}

async function checkUnauthenticated() {
  await expectStatus(`${base}/api/admin/login`, { method: 'GET' }, 401);

  const usersRes = await expectStatus(`${base}/admin/users`, { method: 'GET' }, 307);
  const location = usersRes.headers.get('location') || '';
  if (!location.includes('/admin/login')) {
    throw new Error(`/admin/users redirect missing login (${location})`);
  }

  const operatorRes = await fetch(`${base}/local-operator`, { redirect: 'manual' });
  if (operatorRes.status !== 307 && operatorRes.status !== 308 && operatorRes.status !== 302) {
    throw new Error(`/local-operator → ${operatorRes.status}, expected redirect on Vercel`);
  }
}

async function checkAuthenticated(email, password) {
  const loginRes = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`login POST → ${loginRes.status}: ${body}`);
  }

  const cookie = parseCookies(loginRes);
  if (!cookie) {
    throw new Error('login POST did not return session cookie');
  }

  const sessionRes = await fetch(`${base}/api/admin/login`, {
    headers: { Cookie: cookie },
  });
  if (!sessionRes.ok) {
    throw new Error(`session GET → ${sessionRes.status}`);
  }

  const usersRes = await fetch(`${base}/admin/users`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  if (usersRes.status !== 200) {
    throw new Error(`/admin/users with session → ${usersRes.status}`);
  }
  const html = await usersRes.text();
  if (html.includes('Application error') || html.includes('client-side exception')) {
    throw new Error('/admin/users → error page in HTML');
  }
}

async function main() {
  await checkUnauthenticated();
  console.log(`smoke-auth OK — unauthenticated guards (${base})`);

  const email = process.env.SMOKE_ADMIN_EMAIL;
  const password = process.env.SMOKE_ADMIN_PASSWORD;
  if (email && password) {
    await checkAuthenticated(email, password);
    console.log('smoke-auth OK — authenticated admin session');
  } else {
    console.log('smoke-auth: skip authenticated checks (set SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD)');
  }
}

main().catch((err) => {
  console.error('smoke-auth failed:', err.message);
  process.exit(1);
});
