/**
 * NARIMATO — orbit zoom ladder SSOT (CTL-04).
 *
 * One module owns the ladder constants so tests and the runtime cannot disagree:
 *   zoomForLevel(L) = clamp(2 ** L, ORBIT_FAR_ZOOM, MAX_ZOOM)
 *   zoomLevelForZoom(ORBIT_FAR_ZOOM) = 0
 *
 * Entering the surface happens at SURFACE_ENTER_LEVEL; leaving it always ends at
 * ORBIT_FAR_ZOOM (maximum zoom-out), never at the depth the pilot entered from.
 *
 * NOTE (CTL-04 integration): the issue's §12 text also claims
 * `zoomForLevel(0) === ORBIT_FAR_ZOOM`. That is arithmetically impossible for
 * `clamp(2**0, 0.4, MAX) = 1`, and changing the ladder so level 0 becomes 0.4
 * would move every rung (and the landing threshold), which the same issue
 * forbids as a non-goal. The operationally meaningful invariant is therefore
 * kept: ORBIT_FAR_ZOOM is one rung *beyond* the ladder floor (level 0 = the
 * whole-sphere view), `zoomLevelForZoom(ORBIT_FAR_ZOOM) === 0`, and exit always
 * applies the far zoom. See ARCHITECTURE.md ("Zoom ladder").
 */

/** Farthest orbit zoom (ladder floor). Exported: it is a policy, not a magic number. */
export const ORBIT_FAR_ZOOM = 0.4;
/** Fourth zoom rung (D0..D3) triggers surface landing. */
export const SURFACE_ENTER_LEVEL = 3;
export const MAX_ZOOM = 16777216;
export const MAX_LEVEL = 12;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The exit-state zoom is exactly the far-orbit constant. */
export function isFarOrbitZoom(value) {
  return Number(value) === ORBIT_FAR_ZOOM;
}

export function zoomForLevel(level, maxLevel = MAX_LEVEL) {
  const bounded = clamp(Math.round(Number(level) || 0), 0, Math.max(1, Number(maxLevel) || MAX_LEVEL));
  return clamp(2 ** bounded, ORBIT_FAR_ZOOM, MAX_ZOOM);
}

export function zoomLevelForZoom(value, maxLevel = MAX_LEVEL) {
  const zoom = Number(value);
  const level = Math.max(0, Math.log2(Math.max(1, Number.isFinite(zoom) ? zoom : 1)));
  return clamp(Math.round(level), 0, Math.max(1, Number(maxLevel) || MAX_LEVEL));
}

/**
 * Apply the exit policy through one idempotent function. `camera.reset()` first,
 * then the far zoom, so correctness never depends on statement order.
 * @returns {number} the resulting zoom (always ORBIT_FAR_ZOOM)
 */
export function applyOrbitFarZoom(camera) {
  if (!camera || typeof camera !== 'object') return ORBIT_FAR_ZOOM;
  if (typeof camera.reset === 'function') camera.reset();
  camera.zoom = ORBIT_FAR_ZOOM;
  return camera.zoom;
}
