/**
 * NARIMATO — orbit/surface view state (RND-02).
 *
 * Surface mode is a camera + control mode on the same renderer. Entering stores
 * the orbital camera and exiting restores it exactly; this module holds that
 * pure state so it is testable without a DOM, a canvas or a render loop.
 */

/** Snapshot the orbital camera pose so surface entry cannot mutate it. */
export function saveOrbit(camera) {
  if (!camera || typeof camera !== 'object') return null;
  return {
    yaw: Number(camera.yaw) || 0,
    pitch: Number(camera.pitch) || 0,
    zoom: Number.isFinite(camera.zoom) ? camera.zoom : 1,
    distance: Number.isFinite(camera.distance) ? camera.distance : 3.2,
  };
}

/**
 * Restore a stored orbital camera pose. Returns true when a pose was applied.
 * This is an exact restore (RND-02); CTL-04 owns any later "farthest orbit"
 * policy change.
 */
export function restoreOrbit(camera, saved) {
  if (!camera || !saved || typeof saved !== 'object') return false;
  camera.yaw = saved.yaw;
  camera.pitch = saved.pitch;
  camera.zoom = saved.zoom;
  camera.distance = saved.distance;
  return true;
}

/**
 * Parse the one-release rollback flag `?surface-renderer=overlay`.
 * The overlay renderer was removed in RND-02, so the flag fails closed to the
 * single-scene renderer and only exists so old links are recognised.
 */
export function parseSurfaceRenderer(search) {
  const raw = String(search == null ? '' : search);
  const query = raw.startsWith('?') ? raw.slice(1) : raw;
  let value = null;
  try {
    value = new URLSearchParams(query).get('surface-renderer');
  } catch (_) {
    value = null;
  }
  return String(value || '').trim().toLowerCase() === 'overlay' ? 'overlay' : 'scene';
}
