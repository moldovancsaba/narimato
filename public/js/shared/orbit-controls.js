/**
 * Shared orbit navigation primitives used by the game and the icosahedron
 * viewer. Direction is defined by the projected surface point, not by a guess.
 */

/** Direct mouse drag: drag right moves the surface right. */
export function applyScreenDrag(camera, dx, dy) {
  if (!camera || typeof camera.rotate !== 'function') return;
  camera.rotate(Number(dx) || 0, Number(dy) || 0);
}

/** Arrow-key rotation; explicit, no hidden inversion. */
export function applyArrowKey(camera, key, step = 28) {
  if (!camera || typeof camera.rotate !== 'function') return;
  const s = Number(step) || 28;
  switch (key) {
    case 'ArrowLeft': camera.rotate(s, 0); break;
    case 'ArrowRight': camera.rotate(-s, 0); break;
    case 'ArrowUp': camera.rotate(0, s); break;
    case 'ArrowDown': camera.rotate(0, -s); break;
    default: break;
  }
}
