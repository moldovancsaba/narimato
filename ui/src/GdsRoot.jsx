/**
 * NARIMATO — the one GDS provider and the one React root (issue UI-01).
 *
 * `GdsProvider` is mounted exactly once here, and never anywhere else in the
 * island. Surfaces render inside the provider; a surface mounted into a host
 * element other than `#gds-root` is rendered through a React portal that stays
 * inside the same provider context (so GDS overlays, focus traps and live
 * regions keep the provider's theme and modals mount).
 */
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { GdsProvider } from '@sovereignsquad/gds';
import ProofSurface from './surfaces/ProofSurface.jsx';

const SURFACES = Object.freeze({
  proof: ProofSurface,
});

export default function GdsRoot({ cfg, store }) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const Surface = SURFACES[state.surface] || null;

  const content = Surface ? (
    <Surface cfg={cfg} state={state} store={store} />
  ) : (
    <div data-gds-idle="true" aria-hidden="true" />
  );

  const portalHost = state.host && state.host !== cfg.host ? state.host : null;

  return (
    <GdsProvider defaultColorScheme={cfg.colorScheme}>
      {portalHost ? createPortal(content, portalHost) : content}
    </GdsProvider>
  );
}
