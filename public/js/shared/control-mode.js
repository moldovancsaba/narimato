/**
 * NARIMATO — control-mode derivation (CTL-05).
 *
 * One pure function states which control set is live, so the HUD indicator, the
 * surface overlay label, the action button and the tests cannot disagree.
 * Mode is derived from server-authoritative surface state and never persisted:
 * a reload always lands in orbit.
 */

export const CONTROL_MODES = Object.freeze(['offline', 'orbit', 'descending', 'surface', 'leaving']);

/**
 * @param {{joined?:boolean, surfaceActive?:boolean, surfacePhase?:string}} input
 * @returns {'offline'|'orbit'|'descending'|'surface'|'leaving'}
 */
export function deriveControlMode(input) {
  const source = input && typeof input === 'object' ? input : {};
  if (!source.joined) return 'offline';
  if (!source.surfaceActive) return 'orbit';
  if (source.surfacePhase === 'landing') return 'descending';
  if (source.surfacePhase === 'leaving') return 'leaving';
  return 'surface';
}

const LABELS = Object.freeze({
  offline: 'OFFLINE',
  orbit: 'ORBIT',
  descending: 'DESCENT',
  surface: 'SURFACE',
  leaving: 'LEAVING',
});

export function modeLabel(mode) {
  return LABELS[mode] || LABELS.offline;
}

/** Drag-direction text that is always visible next to the mode. */
export function dragLabel(dragInvert) {
  return dragInvert ? 'DRAG: REVERSE' : 'DRAG: FOLLOW CURSOR';
}

/** The only two states in which a surface action is meaningful. */
export function canToggle(mode) {
  return mode === 'orbit' || mode === 'surface';
}

export function actionLabel(mode) {
  return mode === 'surface' ? 'RETURN TO ORBIT' : 'ENTER SURFACE';
}

/** Why the action is unavailable; rendered through `aria-describedby`. */
export function actionReason(mode) {
  if (mode === 'offline') return 'Join a world to control the camera.';
  if (mode === 'descending') return 'Descending to the surface.';
  if (mode === 'leaving') return 'Leaving the surface.';
  return '';
}

/** One polite sentence per mode transition (never on join without a change). */
export function modeSentence(mode, dragInvert) {
  const drag = dragLabel(dragInvert).replace('DRAG: ', '').toLowerCase();
  if (mode === 'offline') return 'Controls offline.';
  if (mode === 'descending') return 'Descending to the surface.';
  if (mode === 'surface') return `Surface controls live. ${drag}.`;
  if (mode === 'leaving') return 'Leaving the surface.';
  return `Orbit controls live. ${drag}.`;
}
