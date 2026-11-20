/**
 * NARIMATO — share text and URL safety (UI-03).
 *
 * Pure, dependency-free helpers used by `public/js/result-card.js` and the
 * node:test suite. The report share text never includes tokens, internal ids,
 * hidden deposits or other players' private data; URLs are scheme and length
 * validated before they can reach `navigator.share`, the clipboard or an anchor.
 */

export const MAX_SHARE_TEXT = 280;
export const MAX_SHARE_URL = 2048;
export const ALLOWED_SCHEMES = Object.freeze(['https:', 'http:']);

const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const WHITESPACE_RE = /\s+/g;

/** Collapse control characters and whitespace without dropping user text. */
export function sanitizeText(value, max = MAX_SHARE_TEXT) {
  const text = String(value == null ? '' : value)
    .replace(CONTROL_RE, ' ')
    .replace(WHITESPACE_RE, ' ')
    .trim();
  const limit = Math.max(1, Math.trunc(Number(max) || MAX_SHARE_TEXT));
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

/**
 * Allow only https/http (or a same-origin relative URL) up to 2048 chars.
 * Returns '' for anything that fails so callers render "LINK UNAVAILABLE".
 */
export function sanitizeShareUrl(value, { origin = null, max = MAX_SHARE_URL } = {}) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw || raw.length > Math.max(1, Math.trunc(Number(max) || MAX_SHARE_URL))) return '';
  if (raw.startsWith('//')) return '';
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) {
    // Relative URLs are same-origin by definition; reject control characters.
    return CONTROL_RE.test(raw) ? '' : raw;
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }
  if (!ALLOWED_SCHEMES.includes(url.protocol)) return '';
  if (url.username || url.password) return '';
  if (origin) {
    let expected = '';
    try {
      expected = new URL(origin).origin;
    } catch {
      expected = '';
    }
    if (expected && url.origin !== expected) return '';
  }
  return url.toString();
}

/** Multi-line report copy, capped so a share target never rejects it. */
export function sanitizeShareText(value, max = MAX_SHARE_TEXT) {
  const text = String(value == null ? '' : value)
    .replace(CONTROL_RE, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
  const limit = Math.max(1, Math.trunc(Number(max) || MAX_SHARE_TEXT));
  if (text.length <= limit) return text;
  // Prefer keeping whole lines: drop trailing lines until the text fits, then
  // hard-truncate the final line with an ellipsis.
  const lines = text.split('\n');
  while (lines.length > 1 && lines.join('\n').length > limit) lines.pop();
  const joined = lines.join('\n');
  if (joined.length <= limit) return joined;
  return `${joined.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}
