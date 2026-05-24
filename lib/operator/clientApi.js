const DEFAULT_BASE = 'http://127.0.0.1:10006';

/** API base when operator UI is served from status-server (:10006). */
export function resolveOperatorApiBase(override) {
  if (override !== undefined) return override;
  if (typeof window === 'undefined') return DEFAULT_BASE;
  if (window.location.port === '10006') return '';
  return DEFAULT_BASE;
}

export async function operatorApi(path, opts = {}, apiBase) {
  const base = resolveOperatorApiBase(apiBase);
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const OPERATOR_URL = DEFAULT_BASE;
