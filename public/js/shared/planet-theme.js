/**
 * NARIMATO — planet visual identities.
 *
 * Every planet gets a major/secondary colour derived from its index + seed so
 * the same world looks like itself each visit while neighbouring worlds read as
 * clearly different places. Colours are plain hex so Canvas, CSS and the HUD
 * share them without conversion.
 */

const PALETTES = Object.freeze([
  { id: 'ember', accent: '#ff6b2b', secondary: '#ffd166', atmosphere: '#ff9a55', ocean: '#2a0f14', land: '#7a3a1d' },
  { id: 'verdant', accent: '#6dff9a', secondary: '#d4ff3f', atmosphere: '#9dffd1', ocean: '#072b2b', land: '#20562d' },
  { id: 'glacial', accent: '#72d7ff', secondary: '#d8f7ff', atmosphere: '#a9e9ff', ocean: '#08263d', land: '#3e6475' },
  { id: 'violet', accent: '#c77dff', secondary: '#ff8ce0', atmosphere: '#e0b3ff', ocean: '#170a37', land: '#4d2a6b' },
  { id: 'amber', accent: '#ffb347', secondary: '#ffe08a', atmosphere: '#ffd18a', ocean: '#2b1a06', land: '#7a5a1f' },
  { id: 'abyss', accent: '#3fffd2', secondary: '#6cc7ff', atmosphere: '#72ffe8', ocean: '#031f2b', land: '#1d4d55' },
  { id: 'rose', accent: '#ff5d8f', secondary: '#ffb3c9', atmosphere: '#ff9ab8', ocean: '#2a0b1e', land: '#6b253c' },
  { id: 'ashen', accent: '#b7c7df', secondary: '#ffe9c7', atmosphere: '#cfe0f5', ocean: '#101827', land: '#3c4655' },
]);

function mix32(n) {
  let x = (Number(n) >>> 0) || 0x9e3779b9;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function planetPalette(index, seed = 0) {
  const i = Math.max(0, Math.trunc(Number(index) || 0));
  const s = Number(seed) >>> 0;
  // Sequential worlds walk the palette ring so neighbours never repeat a major
  // colour; the seed only rotates the starting point.
  const pick = (s + i) % PALETTES.length;
  return PALETTES[pick];
}

export function planetTheme(index, seed = 0) {
  const palette = planetPalette(index, seed);
  const hue = mix32(Number(seed) ^ Math.imul(Math.max(0, Number(index) || 0) + 1, 0x85ebca6b)) % 360;
  return {
    ...palette,
    hue,
    angle: (hue % 360) - 180,
    glow: `${palette.accent}33`,
  };
}
