import { PHASES, phaseCamera } from './camera.js';
import { V2Renderer } from './renderer.js';

const canvas = document.getElementById('planet-canvas');
const phaseLabel = document.getElementById('phase-label');
const detail = document.getElementById('phase-detail');
const renderer = new V2Renderer(canvas);
const params = new URLSearchParams(location.search);
let phase = Math.max(0, Math.min(PHASES.length - 1, Number(params.get('phase')) || 0));

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.resize(window.innerWidth, window.innerHeight, dpr);
  renderer.dpr = dpr;
}
function frame() {
  const camera = phaseCamera(phase, window.innerWidth, window.innerHeight);
  renderer.render(camera, renderer.dpr || 1);
  phaseLabel.textContent = `PHASE ${phase + 1} // ${PHASES[phase].name}`;
  detail.textContent = `rig ${PHASES[phase].distance.toFixed(2)} R · pitch ${PHASES[phase].pitchDeg.toFixed(1)}°`;
  requestAnimationFrame(frame);
}
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (/^[1-4]$/.test(event.key)) {
    phase = Number(event.key) - 1;
    return;
  }
  if (event.key === ' ' || event.key === 'ArrowRight') phase = (phase + 1) % PHASES.length;
  if (event.key === 'ArrowLeft') phase = (phase + PHASES.length - 1) % PHASES.length;
});
resize();
requestAnimationFrame(frame);
