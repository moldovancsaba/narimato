import path from 'node:path';

/**
 * NARIMATO — browser-facing security policy (SEC-01).
 *
 * Pure helpers shared by `server.js` and the tests:
 *   - `SECURITY_MODE=compat|enforce` configuration resolution (env + overrides);
 *   - exact-origin allowlist (never a suffix match or `*`);
 *   - CSP/header assembly with and without `ASSET_BASE_URL`;
 *   - path-safety helpers (dotfiles, containment) and proxy-aware client IP.
 *
 * No identifier is stored or logged: IPs are used only as in-memory limiter keys
 * and never exported through metrics or logs.
 */

export const SECURITY_MODES = Object.freeze(['compat', 'enforce']);

/** Default per-route rules (SEC-01 §12). `action` is per token, `actionIp` per address. */
export const DEFAULT_LIMITS = Object.freeze({
  // 10 joins/minute, full burst: the 11th join inside a minute is refused.
  join: Object.freeze({ max: 10, windowMs: 60_000, burst: 10, scope: 'ip' }),
  // Per-token ceiling derived from the server click cooldown (50/s at 40 ms).
  action: Object.freeze({ max: 50, windowMs: 1_000, burst: 50, scope: 'token' }),
  actionIp: Object.freeze({ max: 200, windowMs: 1_000, burst: 200, scope: 'ip' }),
  telemetry: Object.freeze({ max: 30, windowMs: 60_000, burst: 30, scope: 'ip' }),
  // Failed-token attempts (SSE 401s): token guessing is rate limited per IP.
  auth: Object.freeze({ max: 30, windowMs: 60_000, burst: 30, scope: 'ip' }),
});

export const DEFAULT_MAX_SSE_PER_IP = 4;
export const DEFAULT_MAX_SSE_GLOBAL = 2000;
export const DEFAULT_CLICK_COOLDOWN_MS = 40;

/**
 * Env prefix per limiter rule: `LIMIT_<PREFIX>_MAX`, `_WINDOW_MS`, `_BURST`
 * (e.g. `LIMIT_JOIN_MAX=200`, `LIMIT_ACTION_IP_WINDOW_MS=1000`). Env values are
 * overridden by explicit `startServer({ security: { limits } })` options.
 */
export const LIMIT_ENV_PREFIXES = Object.freeze({
  join: 'JOIN',
  action: 'ACTION',
  actionIp: 'ACTION_IP',
  telemetry: 'TELEMETRY',
  auth: 'AUTH',
});

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function truthy(value) {
  return value === true || ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

/** Normalise one configured origin to `scheme://host[:port]`, or null when invalid. */
export function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  const origins = [];
  for (const entry of list) {
    const origin = normalizeOrigin(entry);
    if (origin && !origins.includes(origin)) origins.push(origin);
  }
  return origins;
}

/**
 * Resolve the effective security config.
 * Default mode: `SECURITY_MODE` when set; otherwise `enforce` when
 * `NODE_ENV=production`, `compat` elsewhere (so the test suite and local dev
 * reproduce the previous behaviour unless hardening is requested).
 */
export function resolveSecurityConfig(env = {}, overrides = {}) {
  const source = env || {};
  const requestedMode = String(overrides.mode ?? source.SECURITY_MODE ?? '').trim().toLowerCase();
  const mode = SECURITY_MODES.includes(requestedMode)
    ? requestedMode
    : String(source.NODE_ENV ?? '').trim().toLowerCase() === 'production'
      ? 'enforce'
      : 'compat';

  const clickCooldownMs = clampInt(
    overrides.clickCooldownMs ?? source.CLICK_COOLDOWN_MS,
    DEFAULT_CLICK_COOLDOWN_MS,
    1,
    60_000,
  );
  const perTokenMax = Math.max(1, Math.ceil(1000 / clickCooldownMs) * 2);
  const overrideLimits = overrides.limits && typeof overrides.limits === 'object' ? overrides.limits : {};
  // A partial override that changes `max` without naming `burst` keeps the
  // documented "full window of credit at boot" semantics (burst = max).
  const mergeRule = (base, override = {}) => {
    const merged = { ...base, ...(override || {}) };
    if (override && override.max !== undefined && override.burst === undefined) merged.burst = merged.max;
    return merged;
  };
  const defaults = {
    join: DEFAULT_LIMITS.join,
    action: { ...DEFAULT_LIMITS.action, max: perTokenMax, burst: perTokenMax },
    actionIp: { ...DEFAULT_LIMITS.actionIp, max: perTokenMax * 4, burst: perTokenMax * 4 },
    telemetry: DEFAULT_LIMITS.telemetry,
    auth: DEFAULT_LIMITS.auth,
  };
  // Limits are env-configurable (SEC-01): LIMIT_<RULE>_{MAX,WINDOW_MS,BURST}.
  // Precedence: defaults < env < explicit startServer({security:{limits}}) options.
  const envLimit = (ruleName) => {
    const prefix = LIMIT_ENV_PREFIXES[ruleName];
    const rule = {};
    const envMax = source[`LIMIT_${prefix}_MAX`];
    const envWindow = source[`LIMIT_${prefix}_WINDOW_MS`];
    const envBurst = source[`LIMIT_${prefix}_BURST`];
    if (envMax !== undefined && String(envMax).trim() !== '') rule.max = clampInt(envMax, defaults[ruleName].max, 1, 1_000_000);
    if (envWindow !== undefined && String(envWindow).trim() !== '') rule.windowMs = clampInt(envWindow, defaults[ruleName].windowMs, 1, 86_400_000);
    if (envBurst !== undefined && String(envBurst).trim() !== '') rule.burst = clampInt(envBurst, rule.max ?? defaults[ruleName].burst, 1, 1_000_000);
    return rule;
  };
  const limits = {};
  for (const ruleName of Object.keys(defaults)) {
    const withEnv = mergeRule(defaults[ruleName], envLimit(ruleName));
    limits[ruleName] = mergeRule(withEnv, overrideLimits[ruleName]);
  }
  const headersOverride = overrides.headers;
  const headersEnabled = headersOverride === undefined
    ? mode === 'enforce' && String(source.SECURITY_HEADERS ?? '').trim().toLowerCase() !== 'off'
    : typeof headersOverride === 'object'
      ? headersOverride.enabled !== false
      : truthy(headersOverride);

  return Object.freeze({
    mode,
    allowedOrigins: Object.freeze(
      parseAllowedOrigins(overrides.allowedOrigins ?? source.ALLOWED_ORIGINS ?? ''),
    ),
    limits: Object.freeze({
      join: Object.freeze(limits.join),
      action: Object.freeze(limits.action),
      actionIp: Object.freeze(limits.actionIp),
      telemetry: Object.freeze(limits.telemetry),
      auth: Object.freeze(limits.auth),
    }),
    maxSsePerIp: clampInt(overrides.maxSsePerIp ?? source.MAX_SSE_PER_IP, DEFAULT_MAX_SSE_PER_IP, 0, 10_000),
    maxSseGlobal: clampInt(overrides.maxSseGlobal ?? source.MAX_SSE_GLOBAL, DEFAULT_MAX_SSE_GLOBAL, 0, 1_000_000),
    trustProxy: overrides.trustProxy !== undefined ? truthy(overrides.trustProxy) : truthy(source.TRUST_PROXY),
    headers: Object.freeze({ enabled: headersEnabled }),
  });
}

/**
 * Origin verdict for a state-changing or streaming request.
 * compat: allow (previous behaviour; telemetry keeps its own same-origin check).
 * enforce: missing Origin is allowed only for safe methods; when an Origin is
 * present it must be an exact allowlisted origin or match the request host.
 */
export function checkOrigin({ origin, host, method = 'GET', config }) {
  const mode = config?.mode === 'enforce' ? 'enforce' : 'compat';
  if (mode === 'compat') return { ok: true, mode };
  const verb = String(method || 'GET').toUpperCase();
  if (!origin) {
    if (verb === 'GET' || verb === 'HEAD') return { ok: true, mode };
    return { ok: false, mode, reason: 'missing-origin' };
  }
  let url;
  try {
    url = new URL(origin);
  } catch {
    return { ok: false, mode, reason: 'invalid-origin' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, mode, reason: 'invalid-scheme' };
  const normalized = url.origin.toLowerCase();
  const allowlist = config?.allowedOrigins || [];
  if (allowlist.length > 0) {
    return allowlist.includes(normalized) ? { ok: true, mode } : { ok: false, mode, reason: 'origin-not-allowed' };
  }
  const requestHost = typeof host === 'string' ? host.trim().toLowerCase() : '';
  if (!requestHost) return { ok: false, mode, reason: 'missing-host' };
  return url.host.toLowerCase() === requestHost ? { ok: true, mode } : { ok: false, mode, reason: 'origin-host-mismatch' };
}

/** Telemetry keeps same-origin in every mode (browser beacon); missing Origin allowed. */
export function checkTelemetryOrigin({ origin, host }) {
  if (!origin) return { ok: true };
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'invalid-scheme' };
    return url.host.toLowerCase() === String(host || '').trim().toLowerCase()
      ? { ok: true }
      : { ok: false, reason: 'origin-host-mismatch' };
  } catch {
    return { ok: false, reason: 'invalid-origin' };
  }
}

/** Extract the asset origin from `ASSET_BASE_URL` (ignores paths); '' when unset/invalid. */
export function assetOrigin(assetBaseUrl) {
  if (typeof assetBaseUrl !== 'string' || !assetBaseUrl.trim()) return '';
  try {
    const url = new URL(assetBaseUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Content-Security-Policy. `'self'` only, plus the exact asset origin when an
 * external asset base is configured — never `*` or a suffix match.
 */
export function buildCsp({ assetBaseUrl = '' } = {}) {
  const asset = assetOrigin(assetBaseUrl);
  const mediaAndConnect = asset ? `'self' ${asset}` : "'self'";
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `media-src ${mediaAndConnect}`,
    `connect-src ${mediaAndConnect}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}

/** Security headers; HSTS is emitted only over HTTPS. */
export function buildSecurityHeaders({ assetBaseUrl = '', https = false } = {}) {
  const headers = {
    'Content-Security-Policy': buildCsp({ assetBaseUrl }),
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
  if (https) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return headers;
}

/** Request-scoped header map (empty when the policy is disabled, e.g. compat). */
export function securityHeadersFor(config, { assetBaseUrl = '', https = false } = {}) {
  if (!config || !config.headers || !config.headers.enabled) return {};
  return buildSecurityHeaders({ assetBaseUrl, https });
}

/** HTTPS detection, honouring a trusted reverse proxy. */
export function requestIsHttps(req, { trustProxy = false } = {}) {
  if (req?.socket?.encrypted === true) return true;
  if (!trustProxy) return false;
  const forwarded = req?.headers?.['x-forwarded-proto'];
  return typeof forwarded === 'string' && forwarded.split(',')[0].trim().toLowerCase() === 'https';
}

/** Client address for limiter keys; X-Forwarded-For is ignored unless TRUST_PROXY. */
export function clientIp(req, { trustProxy = false } = {}) {
  if (trustProxy) {
    const forwarded = req?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      const first = forwarded.split(',')[0].trim();
      if (first) return first;
    }
  }
  return (req?.socket && req.socket.remoteAddress) || 'unknown';
}

/** True when any decoded path segment names a hidden file (`.env`, `.git`, …). */
export function hasDotfileSegment(pathname) {
  return String(pathname || '')
    .split('/')
    .some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..');
}

/** True when `target` is inside `root` (case-sensitive, resolved paths). */
export function isPathInside(root, target) {
  const base = String(root || '');
  const candidate = String(target || '');
  if (!base || !candidate) return false;
  if (candidate === base) return true;
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  return candidate.startsWith(prefix);
}

/** One-line human summary used by tests/docs (no identifiers). */
export function describeSecurityConfig(config) {
  return `${config.mode}: join ${config.limits.join.max}/${config.limits.join.windowMs}ms ip, action ${config.limits.action.max}/${config.limits.action.windowMs}ms token, telemetry ${config.limits.telemetry.max}/${config.limits.telemetry.windowMs}ms ip, sse ${config.maxSsePerIp}/ip`;
}

export default {
  SECURITY_MODES,
  DEFAULT_LIMITS,
  resolveSecurityConfig,
  checkOrigin,
  checkTelemetryOrigin,
  buildCsp,
  buildSecurityHeaders,
  securityHeadersFor,
  assetOrigin,
  requestIsHttps,
  clientIp,
  hasDotfileSegment,
  isPathInside,
};
