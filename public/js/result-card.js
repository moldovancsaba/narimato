/**
 * NARIMATO — INFINITE GRID shareable session card.
 *
 * Renders a 1200×630 cyberpunk arcade card with pure Canvas 2D primitives:
 * neon horizon grid, an infinite recursive-triangle lattice, a faint geodesic
 * holo-sphere, glitch-echo tag, total score, rank and the session breakdown
 * (session points, clicks, breaks, claims, steals, faces held, depth).
 *
 * No images, no web fonts, no network — this module powers the in-page session
 * report preview and the PNG download (and any shared report page).
 *
 * Exports (frozen contract, SPEC_INFINITE §3):
 *   renderResultCard(canvas, result)  -> canvas
 *   downloadResultCard(result)        -> Promise<boolean>
 *   buildShareText(result, shareUrl)  -> string
 *
 * Result fields: { tag, color, score, sessionScore, clicks, breaks, claims,
 *   steals, facesHeld, depth, rank, totalPlayers, shareUrl }
 */

import { resourceById } from './shared/resources.js';

const CARD_W = 1200;
const CARD_H = 630;

const FONT_STACK =
  '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace';

const C = {
  void: '#05010f',
  void2: '#0a0320',
  cyan: '#00f0ff',
  magenta: '#ff2bd6',
  acid: '#d7ff00',
  violet: '#8a5cff',
  hot: '#ff3860',
  text: '#dff6ff',
  muted: '#9db2cc',
  dim: '#7387a3',
  white: '#f4fdff',
};

const ICOSA = (() => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const v = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1],
  ];
  const len = Math.hypot(1, phi);
  const verts = v.map(([x, y, z]) => ({ x: x / len, y: y / len, z: z / len }));
  const edges = [];
  const edge2 = 4 / (len * len);
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const a = verts[i];
      const b = verts[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      if (Math.abs(dx * dx + dy * dy + dz * dz - edge2) < 1e-9) edges.push([i, j]);
    }
  }
  return { verts, edges };
})();

/* ------------------------------------------------------------------ *
 * Export API
 * ------------------------------------------------------------------ */

/**
 * Draw the 1200×630 infinite-grid session card into a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {object} result session report result (see file header)
 * @returns {HTMLCanvasElement}
 */
export function renderResultCard(canvas, result) {
  if (!canvas || typeof canvas.getContext !== 'function') return canvas;
  let ctx = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return canvas;
  }
  if (!ctx) return canvas;

  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const r = normalizeResult(result);
  try {
    drawCard(ctx, r);
  } catch (err) {
    // Decorative failure must never break the page: fall back to plain text.
    try {
      ctx.fillStyle = C.void;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      ctx.fillStyle = C.cyan;
      setFont(ctx, 60, 800);
      ctx.fillText('NARIMATO // INFINITE GRID', 64, 220);
      ctx.fillStyle = C.text;
      setFont(ctx, 44, 800);
      ctx.fillText(`${r.tag} // ${formatNumber(r.score)} PTS`, 64, 300);
    } catch {
      /* ignore */
    }
    if (typeof console !== 'undefined') console.warn('[icosa] result card render failed', err);
  }
  return canvas;
}

/**
 * Render offscreen and trigger a PNG download named
 * narimato-<TAG>-<score>.png.
 * @param {object} result
 * @returns {Promise<boolean>}
 */
export async function downloadResultCard(result) {
  if (typeof document === 'undefined') return false;
  const r = normalizeResult(result);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  renderResultCard(canvas, result);

  const filename = `narimato-${r.tag}-${r.score}.png`;
  const blob = await new Promise((resolve) => {
    try {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((b) => resolve(b), 'image/png');
        return;
      }
    } catch {
      /* fall through */
    }
    resolve(null);
  });

  try {
    const link = document.createElement('a');
    link.download = filename;
    link.rel = 'noopener';
    let objectUrl = null;
    if (blob) {
      objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
    } else {
      link.href = canvas.toDataURL('image/png');
    }
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (objectUrl) setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
    }, 5000);
    return true;
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[icosa] result download failed', err);
    return false;
  }
}

/**
 * Clipboard / navigator.share copy for a finished session report.
 * @param {object} result
 * @param {string} [shareUrl]
 * @returns {string}
 */
export function buildShareText(result, shareUrl) {
  const r = normalizeResult(result);
  const url = cleanString(shareUrl) || r.shareUrl;
  const lines = [
    'NARIMATO // INFINITE GRID',
    `${r.tag} — ${formatNumber(r.score)} PTS — RANK #${r.rank}/${r.totalPlayers}`,
    `SESSION +${formatNumber(r.sessionScore)} · CLICKS ${r.clicks} · BREAKS ${r.breaks}`,
    `FACES HELD ${r.facesHeld} · DEPTH D${r.depth} · CLAIMS ${r.claims} · STEALS ${r.steals}`,
    `ORES MINED ${r.ores} · ORE VALUE ${formatNumber(r.oreValue)} CR${
      r.bestFind ? ` · RICHEST FIND ${r.bestFind.name} +${formatNumber(r.bestFind.value)} CR` : ''
    }`,
  ];
  if (url) lines.push(url);
  lines.push('#INFINITEGRID');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

function normalizeResult(result) {
  const src = result && typeof result === 'object' ? result : {};
  const tag =
    cleanString(src.tag, 'PLAYER')
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 12) || 'PLAYER';
  return {
    tag,
    color: hexColor(cleanString(src.color)) || C.cyan,
    score: Math.max(0, Math.round(num(src.score))),
    sessionScore: Math.max(0, Math.round(num(src.sessionScore, num(src.score)))),
    clicks: Math.max(0, Math.round(num(src.clicks))),
    breaks: Math.max(0, Math.round(num(src.breaks))),
    claims: Math.max(0, Math.round(num(src.claims))),
    steals: Math.max(0, Math.round(num(src.steals))),
    facesHeld: Math.max(0, Math.round(num(src.facesHeld))),
    depth: Math.max(0, Math.min(24, Math.round(num(src.depth, num(src.depthReached))))),
    ores: Math.max(0, Math.round(num(src.ores))),
    oreValue: Math.max(0, Math.round(num(src.oreValue))),
    bestFind: normalizeBestFind(src.bestFind),
    rank: Math.max(1, Math.round(num(src.rank, 1))),
    totalPlayers: Math.max(1, Math.round(num(src.totalPlayers, 1))),
    resultId: cleanString(src.resultId),
    shareUrl: cleanString(src.shareUrl) || cleanString(src.url),
    bot: !!src.bot,
  };
}

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const cleanString = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const hexColor = (value) => (/^#[0-9a-f]{6}$/i.test(value) ? value : null);

function normalizeBestFind(value) {
  if (!value || typeof value !== 'object') return null;
  const byId = value.id ? resourceById(value.id) : null;
  const merged = { ...(byId || {}), ...value };
  if (!merged.name && !merged.glyph) return null;
  return {
    id: cleanString(merged.id),
    name: cleanString(merged.name) || cleanString(merged.id).toUpperCase(),
    glyph: cleanString(merged.glyph) || cleanString(merged.name).slice(0, 2),
    value: Math.max(0, Math.round(num(merged.value))),
    color: hexColor(cleanString(merged.color)) || C.acid,
  };
}

function formatNumber(value) {
  const n = Math.max(0, Math.round(num(value)));
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

function hexToRgba(hex, alpha) {
  const safe = hexColor(hex) || C.cyan;
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * Canvas helpers
 * ------------------------------------------------------------------ */

function setFont(ctx, size, weight = 700, family = FONT_STACK) {
  ctx.font = `${weight} ${Math.max(1, Math.round(size))}px ${family}`;
}

function trackedWidth(ctx, text, spacing) {
  const chars = Array.from(String(text));
  let w = 0;
  for (const ch of chars) w += ctx.measureText(ch).width + spacing;
  return Math.max(0, w - spacing);
}

/** Letter-spaced fillText (canvas letterSpacing is not universal). */
function tracked(ctx, text, x, y, spacing, align = 'left') {
  const str = String(text);
  const total = trackedWidth(ctx, str, spacing);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  for (const ch of str) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return total;
}

function truncated(ctx, text, maxWidth) {
  const str = String(text);
  if (ctx.measureText(str).width <= maxWidth) return str;
  let out = str;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function fitFont(ctx, text, maxWidth, startSize, weight = 800, minSize = 28) {
  let size = startSize;
  while (size > minSize) {
    setFont(ctx, size, weight);
    if (ctx.measureText(String(text)).width <= maxWidth) break;
    size -= 2;
  }
  setFont(ctx, size, weight);
  return size;
}

function cutRectPath(ctx, x, y, w, h, cut) {
  const c = Math.min(cut, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/* ------------------------------------------------------------------ *
 * Card composition
 * ------------------------------------------------------------------ */

function drawCard(ctx, r) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  drawBackdrop(ctx, r);
  drawInfiniteLattice(ctx);
  drawHoloSphere(ctx, r);
  drawHeader(ctx, r);
  drawIdentity(ctx, r);
  drawRankPanel(ctx, r);
  drawMetaPanel(ctx, r);
  drawStats(ctx, r);
  drawFooter(ctx, r);
  drawFrame(ctx, r);
  drawScanlines(ctx);
  drawNoise(ctx);
  drawVignette(ctx);

  ctx.restore();
}

function drawBackdrop(ctx, r) {
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const base = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  base.addColorStop(0, '#070114');
  base.addColorStop(0.55, C.void2);
  base.addColorStop(1, '#04000d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Player-coloured aura (the card feels personal).
  const aura = ctx.createRadialGradient(150, 90, 10, 150, 90, 720);
  aura.addColorStop(0, hexToRgba(r.color, 0.26));
  aura.addColorStop(0.45, hexToRgba(r.color, 0.06));
  aura.addColorStop(1, 'rgba(5,1,15,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const violet = ctx.createRadialGradient(1130, 40, 10, 1130, 40, 700);
  violet.addColorStop(0, 'rgba(138,92,255,0.2)');
  violet.addColorStop(1, 'rgba(5,1,15,0)');
  ctx.fillStyle = violet;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const acid = ctx.createRadialGradient(300, 640, 10, 300, 640, 620);
  acid.addColorStop(0, 'rgba(215,255,0,0.06)');
  acid.addColorStop(1, 'rgba(5,1,15,0)');
  ctx.fillStyle = acid;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawFloorGrid(ctx);

  // Magenta counter-glow on the right edge.
  const edge = ctx.createLinearGradient(CARD_W, 0, CARD_W - 180, 0);
  edge.addColorStop(0, 'rgba(255,43,214,0.16)');
  edge.addColorStop(1, 'rgba(255,43,214,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(CARD_W - 180, 0, 180, CARD_H);
}

function drawFloorGrid(ctx) {
  const horizon = 468;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, CARD_W, CARD_H - horizon);
  ctx.clip();

  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const y = horizon + Math.pow(t, 2.1) * (CARD_H - horizon);
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.03 + t * 0.1})`;
    ctx.lineWidth = 1;
    line(ctx, 0, y, CARD_W, y);
  }

  const vanishX = 640;
  for (let k = -14; k <= 14; k++) {
    const xBottom = vanishX + k * 86;
    const strength = 1 - Math.abs(k) / 18;
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.03 + strength * 0.07})`;
    ctx.lineWidth = 1;
    line(ctx, vanishX + k * 14, horizon, xBottom, CARD_H);
  }
  ctx.restore();

  const glowLine = ctx.createLinearGradient(0, 0, CARD_W, 0);
  glowLine.addColorStop(0, 'rgba(0,240,255,0)');
  glowLine.addColorStop(0.35, 'rgba(0,240,255,0.5)');
  glowLine.addColorStop(0.65, 'rgba(255,43,214,0.45)');
  glowLine.addColorStop(1, 'rgba(0,240,255,0)');
  ctx.strokeStyle = glowLine;
  ctx.lineWidth = 1.5;
  glow(ctx, C.cyan, 16);
  line(ctx, 0, horizon, CARD_W, horizon);
  noGlow(ctx);
}

/** Faint recursive 4-way triangle lattice = the infinite grid motif. */
function drawInfiniteLattice(ctx) {
  ctx.save();
  ctx.lineWidth = 1;
  const rand = mulberry32(0x105a11);
  const recurse = (x1, y1, x2, y2, x3, y3, depth) => {
    if (depth === 0) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.stroke();
      return;
    }
    const m12 = [(x1 + x2) / 2, (y1 + y2) / 2];
    const m23 = [(x2 + x3) / 2, (y2 + y3) / 2];
    const m31 = [(x3 + x1) / 2, (y3 + y1) / 2];
    recurse(x1, y1, m12[0], m12[1], m31[0], m31[1], depth - 1);
    recurse(m12[0], m12[1], x2, y2, m23[0], m23[1], depth - 1);
    recurse(m31[0], m31[1], m23[0], m23[1], x3, y3, depth - 1);
    recurse(m12[0], m12[1], m23[0], m23[1], m31[0], m31[1], depth - 1);
  };

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
  recurse(70, 620, 430, 620, 250, 300, 4);
  ctx.strokeStyle = 'rgba(255, 43, 214, 0.04)';
  recurse(1150, 120, 900, 120, 1025, -120, 4);
  ctx.strokeStyle = 'rgba(143, 92, 255, 0.035)';
  recurse(1100, 620, 880, 620, 990, 420, 3);

  // A few charged "hot" cells to hint at breakable nodes.
  for (let i = 0; i < 16; i++) {
    const x = 80 + rand() * 1040;
    const y = 60 + rand() * 500;
    const s = 1 + rand() * 2.4;
    const hot = i % 5 === 0;
    ctx.fillStyle = hot ? 'rgba(215, 255, 0, 0.22)' : 'rgba(0, 240, 255, 0.14)';
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

function drawHoloSphere(ctx, r) {
  const cx = 992;
  const cy = 306;
  const R = 232;
  const yaw = 0.62;
  const pitch = 0.3;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const project = (v) => {
    const x1 = v.x * cosY + v.z * sinY;
    const z1 = -v.x * sinY + v.z * cosY;
    const y2 = v.y * cosP - z1 * sinP;
    const z2 = v.y * sinP + z1 * cosP;
    return { x: cx + x1 * R, y: cy - y2 * R, z: z2 };
  };

  const pts = ICOSA.verts.map(project);
  const edges = ICOSA.edges
    .map(([a, b]) => ({ a: pts[a], b: pts[b], z: (pts[a].z + pts[b].z) / 2 }))
    .sort((p, q) => p.z - q.z);

  ctx.save();
  ctx.lineWidth = 1;
  for (const e of edges) {
    const front = (e.z + 1) / 2;
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.05 + front * 0.13})`;
    line(ctx, e.a.x, e.a.y, e.b.x, e.b.y);
  }

  ctx.strokeStyle = 'rgba(138, 92, 255, 0.16)';
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.005, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.99, R * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.54, R * 0.99, 0, 0, Math.PI * 2);
  ctx.stroke();

  for (const p of pts) {
    const front = (p.z + 1) / 2;
    ctx.fillStyle = `rgba(0, 240, 255, ${0.1 + front * 0.4})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6 + front * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const sweep = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  sweep.addColorStop(0, 'rgba(0,240,255,0)');
  sweep.addColorStop(0.5, 'rgba(0,240,255,0.05)');
  sweep.addColorStop(1, 'rgba(0,240,255,0)');
  ctx.fillStyle = sweep;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hexToRgba(r.color, 0.85);
  glow(ctx, r.color, 18);
  ctx.beginPath();
  ctx.arc(cx + 96, cy - 188, 3.4, 0, Math.PI * 2);
  ctx.fill();
  noGlow(ctx);
  ctx.restore();
}

function drawHeader(ctx, r) {
  const x = 64;

  // Hexagon brand glyph.
  ctx.save();
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 2;
  glow(ctx, C.cyan, 12);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + 11 + Math.cos(a) * 11;
    const py = 52 + Math.sin(a) * 11;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  noGlow(ctx);
  ctx.restore();

  // Wordmark.
  setFont(ctx, 30, 800);
  glow(ctx, C.cyan, 14);
  ctx.fillStyle = C.cyan;
  tracked(ctx, 'NARIMATO', x + 34, 62, 1.2);
  noGlow(ctx);

  setFont(ctx, 12, 600);
  ctx.fillStyle = C.muted;
  tracked(ctx, 'THE WAY BACK // INFINITE GRID', x + 1, 88, 3.2);

  // Session report labels on the right.
  setFont(ctx, 17, 700);
  ctx.fillStyle = C.acid;
  glow(ctx, C.acid, 12);
  tracked(ctx, 'SESSION REPORT', CARD_W - 64, 56, 2.2, 'right');
  noGlow(ctx);

  setFont(ctx, 12, 600);
  ctx.fillStyle = C.muted;
  tracked(ctx, `WORLD DEPTH D${r.depth}`, CARD_W - 64, 80, 1.8, 'right');

  // Divider.
  const grad = ctx.createLinearGradient(x, 0, CARD_W - 64, 0);
  grad.addColorStop(0, hexToRgba(r.color, 0.9));
  grad.addColorStop(0.45, 'rgba(0, 240, 255, 0.32)');
  grad.addColorStop(1, 'rgba(255, 43, 214, 0.08)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  line(ctx, x, 112, CARD_W - 64, 112);

  ctx.fillStyle = hexToRgba(r.color, 0.9);
  ctx.fillRect(x, 108, 3, 9);
  ctx.fillStyle = 'rgba(255, 43, 214, 0.7)';
  ctx.fillRect(CARD_W - 64 - 3, 108, 3, 9);

  setFont(ctx, 10, 500);
  ctx.fillStyle = 'rgba(157, 178, 204, 0.55)';
  tracked(ctx, '20 ROOT CELLS · 4-WAY BREAKS · LABELS STABLE FOREVER', x + 1, 131, 1.5);
}

function drawIdentity(ctx, r) {
  const x = 64;

  setFont(ctx, 13, 600);
  ctx.fillStyle = C.muted;
  tracked(ctx, 'OPERATOR', x, 186, 4);

  const size = fitFont(ctx, r.tag, 640, 116, 800, 46);
  const tagY = 186 + size * 0.86;

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = C.magenta;
  setFont(ctx, size, 800);
  ctx.fillText(r.tag, x - 1.4, tagY + 1);
  ctx.fillStyle = C.cyan;
  ctx.fillText(r.tag, x + 1.4, tagY - 1);
  ctx.restore();

  setFont(ctx, size, 800);
  ctx.fillStyle = C.white;
  glow(ctx, r.color, 22);
  ctx.fillText(r.tag, x, tagY);
  noGlow(ctx);

  const barY = tagY + 20;
  const barW = Math.min(400, Math.max(180, ctx.measureText(r.tag).width * 0.56));
  const bar = ctx.createLinearGradient(x, 0, x + barW, 0);
  bar.addColorStop(0, r.color);
  bar.addColorStop(0.7, hexToRgba(r.color, 0.5));
  bar.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.fillStyle = bar;
  ctx.fillRect(x, barY, barW, 5);
  ctx.fillStyle = 'rgba(255, 43, 214, 0.8)';
  ctx.fillRect(x, barY + 7, Math.min(84, barW), 2);

  // Total score.
  setFont(ctx, 13, 600);
  ctx.fillStyle = C.muted;
  tracked(ctx, 'TOTAL SCORE', x, barY + 56, 4);

  const scoreSize = 84;
  setFont(ctx, scoreSize, 800);
  const scoreText = formatNumber(r.score);
  const scoreW = ctx.measureText(scoreText).width;
  const scoreY = barY + 56 + scoreSize * 0.92;
  glow(ctx, C.acid, 16);
  ctx.fillStyle = C.acid;
  ctx.fillText(scoreText, x, scoreY);
  noGlow(ctx);

  setFont(ctx, 16, 600);
  ctx.fillStyle = 'rgba(215, 255, 0, 0.55)';
  tracked(ctx, 'PTS', x + scoreW + 16, scoreY, 2.5);

  // Session delta line.
  setFont(ctx, 11, 600);
  ctx.fillStyle = C.dim;
  tracked(ctx, 'THIS SESSION', x, scoreY + 30, 2.6);
  setFont(ctx, 20, 800);
  ctx.fillStyle = C.cyan;
  glow(ctx, C.cyan, 10);
  ctx.fillText(`+${formatNumber(r.sessionScore)}`, x + 128, scoreY + 31);
  noGlow(ctx);
}

function drawRankPanel(ctx, r) {
  const x = 764;
  const y = 152;
  const w = 372;
  const h = 148;

  ctx.save();
  cutRectPath(ctx, x, y, w, h, 18);
  ctx.fillStyle = 'rgba(7, 3, 22, 0.68)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = r.color;
  ctx.lineWidth = 2;
  line(ctx, x + 18, y + 1.5, x + 52, y + 1.5);
  line(ctx, x + 1.5, y + 18, x + 1.5, y + 52);
  ctx.restore();

  setFont(ctx, 12, 600);
  ctx.fillStyle = C.muted;
  tracked(ctx, 'SESSION RANK', x + 24, y + 34, 3.6);

  const isWinner = r.rank === 1;
  const rankColor = isWinner ? C.acid : C.cyan;
  const rankText = `#${r.rank}`;
  setFont(ctx, 82, 800);
  glow(ctx, rankColor, 24);
  ctx.fillStyle = rankColor;
  ctx.fillText(rankText, x + 22, y + 118);
  noGlow(ctx);

  const rankW = ctx.measureText(rankText).width;
  setFont(ctx, 20, 600);
  ctx.fillStyle = C.muted;
  ctx.fillText(`/ ${r.totalPlayers}`, x + 26 + rankW, y + 118);

  if (isWinner) {
    setFont(ctx, 11, 700);
    const chip = 'TOP OPERATOR';
    const cw = trackedWidth(ctx, chip, 2.2) + 20;
    const chipX = x + w - cw - 20;
    ctx.fillStyle = 'rgba(215, 255, 0, 0.12)';
    ctx.fillRect(chipX, y + 20, cw, 24);
    ctx.strokeStyle = 'rgba(215, 255, 0, 0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(chipX + 0.5, y + 20.5, cw - 1, 23);
    ctx.fillStyle = C.acid;
    tracked(ctx, chip, chipX + 10, y + 36, 2.2);
  } else {
    setFont(ctx, 11, 600);
    ctx.fillStyle = 'rgba(157, 178, 204, 0.8)';
    tracked(ctx, 'WORLD RANKED', x + w - 24, y + 36, 2.4, 'right');
  }

  // Richest ore find strip inside the rank panel.
  if (r.bestFind) {
    const bf = r.bestFind;
    setFont(ctx, 9.5, 600);
    ctx.fillStyle = C.dim;
    const labelW = trackedWidth(ctx, 'RICHEST FIND', 2.2);
    tracked(ctx, 'RICHEST FIND', x + 24, y + 138, 2.2);

    setFont(ctx, 10.5, 700);
    const full = `${bf.glyph} ${bf.name} +${formatNumber(bf.value)}`;
    const short = `${bf.glyph} +${formatNumber(bf.value)}`;
    const maxW = w - 48 - labelW - 14;
    const text = ctx.measureText(full).width <= maxW ? full : short;
    ctx.fillStyle = bf.color;
    glow(ctx, bf.color, 8);
    tracked(ctx, text, x + w - 24, y + 138, 1.1, 'right');
    noGlow(ctx);
  }

  const rail = ctx.createLinearGradient(0, y, 0, y + 330);
  rail.addColorStop(0, hexToRgba(r.color, 0.8));
  rail.addColorStop(1, hexToRgba(r.color, 0));
  ctx.fillStyle = rail;
  ctx.fillRect(736, y, 2, 330);
}

function drawMetaPanel(ctx, r) {
  const x = 764;
  const y = 322;
  const w = 372;
  const h = 148;

  ctx.save();
  cutRectPath(ctx, x, y, w, h, 18);
  ctx.fillStyle = 'rgba(7, 3, 22, 0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(138, 92, 255, 0.32)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const rows = [
    ['SESSION SCORE', `+${formatNumber(r.sessionScore)}`, C.cyan],
    ['WORLD DEPTH', `D${r.depth}`, C.acid],
    ['FACES HELD', formatNumber(r.facesHeld), C.text],
  ];
  rows.forEach(([label, value, color], i) => {
    const ry = y + 40 + i * 34;
    setFont(ctx, 11, 600);
    ctx.fillStyle = 'rgba(157, 178, 204, 0.85)';
    tracked(ctx, label, x + 24, ry, 2.6);
    setFont(ctx, 15, 700);
    ctx.fillStyle = color;
    tracked(ctx, value, x + w - 24, ry, 1.2, 'right');
    setFont(ctx, 11, 600);
  });

  ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 24, y + 54 + i * 34, w - 48, 1);
}

function drawStats(ctx, r) {
  const x = 64;
  const yTop = 500;
  const available = CARD_W - 64 - x;
  const gap = 12;
  const colW = (available - gap * 7) / 8;

  const sep = ctx.createLinearGradient(x, 0, x + 1060, 0);
  sep.addColorStop(0, hexToRgba(r.color, 0.7));
  sep.addColorStop(0.6, 'rgba(0, 240, 255, 0.16)');
  sep.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.strokeStyle = sep;
  ctx.lineWidth = 1;
  line(ctx, x, yTop - 14, x + 1060, yTop - 14);

  const stats = [
    ['CLICKS', formatNumber(r.clicks), C.text],
    ['BREAKS', formatNumber(r.breaks), C.acid],
    ['CLAIMS', formatNumber(r.claims), C.cyan],
    ['STEALS', formatNumber(r.steals), C.magenta],
    ['FACES HELD', formatNumber(r.facesHeld), C.text],
    ['DEPTH', `D${r.depth}`, C.violet],
    ['ORES MINED', formatNumber(r.ores), '#ffd166'],
    ['ORE VALUE', formatNumber(r.oreValue), '#ffd166'],
  ];

  stats.forEach(([label, value, color], i) => {
    const cx = x + i * (colW + gap);
    setFont(ctx, 9.5, 600);
    ctx.fillStyle = 'rgba(157, 178, 204, 0.9)';
    tracked(ctx, label, cx, yTop + 8, 1.8);
    setFont(ctx, 26, 800);
    ctx.fillStyle = color;
    if (i === 1 || i === 5 || i >= 6) glow(ctx, color, 12);
    ctx.fillText(value, cx, yTop + 46);
    noGlow(ctx);
    if (i < stats.length - 1) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.fillRect(cx + colW + gap / 2, yTop - 16, 1, 60);
    }
  });
}

function drawFooter(ctx, r) {
  const x = 64;
  const y = 574;

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
  ctx.lineWidth = 1;
  line(ctx, x, y, CARD_W - 64, y);

  setFont(ctx, 10, 600);
  ctx.fillStyle = 'rgba(157, 178, 204, 0.9)';
  tracked(ctx, 'SHARE', x, y + 30, 3);
  setFont(ctx, 15, 600);
  ctx.fillStyle = C.cyan;
  const url = (r.shareUrl || 'NARIMATO // THE WAY BACK').replace(/^https?:\/\//, '');
  ctx.fillText(truncated(ctx, url, 620), x + 66, y + 31);

  setFont(ctx, 15, 700);
  ctx.fillStyle = C.magenta;
  glow(ctx, C.magenta, 10);
  tracked(ctx, '#NARIMATO', CARD_W - 64, y + 31, 2.4, 'right');
  noGlow(ctx);

  setFont(ctx, 9.5, 500);
  ctx.fillStyle = 'rgba(157, 178, 204, 0.55)';
  tracked(ctx, 'ONE SPHERE // INFINITE CELLS // PERSISTENT WORLD', CARD_W / 2, 620, 1.8, 'center');
}

function drawFrame(ctx, r) {
  const m = 40;
  const len = 26;
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
  ctx.lineWidth = 1.5;
  const corners = [
    [m, m, 1, 1],
    [CARD_W - m, m, -1, 1],
    [m, CARD_H - m, 1, -1],
    [CARD_W - m, CARD_H - m, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    line(ctx, cx, cy, cx + len * sx, cy);
    line(ctx, cx, cy, cx, cy + len * sy);
  }

  ctx.fillStyle = r.color;
  glow(ctx, r.color, 14);
  ctx.fillRect(m, CARD_H - m - 4, 96, 3);
  noGlow(ctx);
  ctx.restore();
}

function drawScanlines(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.13)';
  for (let y = 0; y < CARD_H; y += 4) ctx.fillRect(0, y, CARD_W, 1.5);
  ctx.fillStyle = 'rgba(0, 240, 255, 0.012)';
  for (let y = 2; y < CARD_H; y += 8) ctx.fillRect(0, y, CARD_W, 1);
  ctx.restore();
}

function drawNoise(ctx) {
  const rand = mulberry32(0x1f1e1e);
  ctx.save();
  for (let i = 0; i < 2100; i++) {
    const x = rand() * CARD_W;
    const y = rand() * CARD_H;
    ctx.fillStyle = `rgba(223, 246, 255, ${rand() * 0.05})`;
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 90; i++) {
    const x = rand() * CARD_W;
    const y = rand() * CARD_H;
    ctx.fillStyle = `rgba(0, 240, 255, ${rand() * 0.08})`;
    ctx.fillRect(x, y, 2, 1);
  }
  ctx.restore();
}

function drawVignette(ctx) {
  const v = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, 200, CARD_W / 2, CARD_H / 2, 760);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(0.75, 'rgba(0, 0, 0, 0.18)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}
