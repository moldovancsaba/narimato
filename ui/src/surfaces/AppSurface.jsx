/**
 * NARIMATO — the one GDS app surface (UI-02…UI-05).
 *
 * Renders the HUD, overlays, additive surface strip and cine chrome from the
 * slices the game controllers publish. One `GdsProvider`, one React root, one
 * stylesheet; every visible control is a shipped GDS component.
 */
import { useEffect } from 'react';
import { GdsBox, VisuallyHidden } from '@sovereignsquad/gds/client';
import HudSurface from './HudSurface.jsx';
import OverlaySurface from './OverlaySurface.jsx';
import CineChrome from './CineChrome.jsx';

function Announcer({ announcement, seq }) {
  return (
    <VisuallyHidden>
      <span role="status" aria-live="polite" aria-atomic="true" data-gds-announcer="true">
        {announcement}
        {seq ? ` (${seq})` : ''}
      </span>
    </VisuallyHidden>
  );
}

export default function AppSurface({ cfg, state }) {
  const data = state.data || {};
  const proof = state.surface === 'proof';
  const ui = data.ui || {};
  const surface = ui.surface || data.surface || {};
  const cine = ui.cine || data.cine || {};
  const voice = ui.voice || data.voice || {};
  const captions = ui.captions || data.captions || { visible: false, speaker: 'NARRATOR', text: '' };
  const landingOpen = ui.landing ? ui.landing.open === true : false;
  const cineActive = cine.active === true;

  useEffect(() => {
    const root = typeof document === 'undefined' ? null : document.getElementById('gds-root');
    if (!root) return undefined;
    root.setAttribute('data-surface', 'app');
    root.setAttribute('data-gds-ready', 'true');
    if (proof) root.setAttribute('data-gds-proof-ready', 'true');
    // The GdsProvider wrapper paints the theme body inline; the game canvas
    // lives underneath the HUD, so this surface must stay transparent. A CSS
    // override is not reliable against the provider's inline background.
    const paint = () => {
      for (const child of root.children) {
        if (child.tagName === 'DIV') child.style.setProperty('background', 'transparent', 'important');
      }
    };
    paint();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(paint) : null;
    if (observer) observer.observe(root, { childList: true });
    return () => {
      if (observer) observer.disconnect();
      root.removeAttribute('data-surface');
      root.removeAttribute('data-gds-ready');
    };
  }, [proof]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    // The canvas renderer keeps pointer ownership outside the HUD; only the
    // surface and modal layers accept pointer events (see island.css).
    document.documentElement.dataset.gdsUi = 'on';
    return () => {
      delete document.documentElement.dataset.gdsUi;
    };
  }, []);

  return (
      <GdsBox className="gds-app" data-gds-app="true" data-reduced-motion={cfg && cfg.reducedMotion ? 'true' : 'false'}
        data-cine={cineActive ? 'true' : 'false'}>
        <Announcer announcement={state.announcement || ''} seq={state.announcementSeq || 0} />
        <HudSurface ui={ui} surface={surface} cineActive={cineActive} />
        <OverlaySurface ui={ui} cineActive={cineActive} />
        <CineChrome cine={cine} voice={voice} captions={captions} />
      </GdsBox>
  );
}
