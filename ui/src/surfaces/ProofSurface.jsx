/**
 * NARIMATO — GDS proof surface for issue UI-01 (dev/operator only, `?gds=proof`).
 *
 * Purpose: prove the integration contract before any game surface migrates —
 * one provider, GDS-only composition, all five required states, a keyboard
 * journey with a real focus-trapping dialog, polite live announcements, and
 * token-driven layout that survives 200% zoom and a 792x302 viewport.
 *
 * Every control is a shipped GDS component. Nothing here is a game surface and
 * nothing is loaded unless the operator asks for it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConfirmDialog,
  EmptyState,
  GdsBox,
  GdsInline,
  GdsMeter,
  GdsStack,
  InlineAlert,
  PageHeader,
  SectionPanel,
  SemanticButton,
  StateBlock,
  StatusBadge,
  VisuallyHidden,
} from '@sovereignsquad/gds';

const RETRY_MS = 400;

/** Polite live-region text used to prove announcements without visual-only feedback. */
function Announcer({ message, seq }) {
  return (
    <VisuallyHidden>
      <span role="status" aria-live="polite" aria-atomic="true" data-gds-announcer="true">
        {message}
        {seq ? ` (${seq})` : ''}
      </span>
    </VisuallyHidden>
  );
}

function StateCard({ state, children }) {
  return (
    <GdsBox data-gds-proof-state={state}>
      <SectionPanel
        eyebrow={`STATE ${state.toUpperCase()}`}
        title={
          state === 'loading'
            ? 'Loading'
            : state === 'empty'
              ? 'Empty'
              : state === 'error'
                ? 'Error with recovery'
                : state === 'disabled'
                  ? 'Disabled with a reason'
                  : 'Success'
        }
        titleOrder={2}
        tone={state === 'error' ? 'critical' : state === 'disabled' ? 'warning' : 'default'}
      >
        {children}
      </SectionPanel>
    </GdsBox>
  );
}

export default function ProofSurface({ cfg, state, store }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [announceSeq, setAnnounceSeq] = useState(0);
  const retryTimer = useRef(null);
  const invoker = useRef(null);
  const announce = useCallback(
    (message) => {
      setAnnouncement(message);
      setAnnounceSeq((seq) => seq + 1);
      store.update({ announcement: message, announcementSeq: announceSeq + 1 });
    },
    [store, announceSeq]
  );

  useEffect(() => {
    const root = typeof document === 'undefined' ? null : document.getElementById('gds-root');
    if (!root) return undefined;
    root.setAttribute('data-surface', 'proof');
    // The proof overlay covers the game: keep keyboard and the accessibility tree
    // inside the proof surface while it is mounted. GDS's own portal host is skipped.
    const isolated = [];
    if (typeof document !== 'undefined' && document.body) {
      for (const element of document.body.children) {
        if (element === root) continue;
        if (element.tagName === 'SCRIPT' || element.tagName === 'NOSCRIPT') continue;
        if (element.hasAttribute('data-portal') || element.hasAttribute('data-mantine-shared-portal-node')) continue;
        isolated.push({ element, inert: element.inert });
        element.inert = true;
      }
    }
    return () => {
      root.removeAttribute('data-surface');
      for (const { element, inert } of isolated) element.inert = inert;
    };
  }, []);

  useEffect(() => {
    announce('GDS proof surface ready. Loading, empty, error, disabled and success states rendered.');
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
    // The announcement is mount-only; announce is stable enough for this surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runRetry = () => {
    if (retrying) return;
    setRetrying(true);
    setRecovered(false);
    announce('Retrying the failed island boot.');
    retryTimer.current = setTimeout(() => {
      setRetrying(false);
      setRecovered(true);
      announce('Retry succeeded. Error state recovered.');
    }, RETRY_MS);
  };

  const restoreFocus = () => {
    const target = invoker.current;
    if (target && typeof target.focus === 'function') target.focus();
  };

  const openConfirm = () => {
    invoker.current = typeof document === 'undefined' ? null : document.activeElement;
    setDialogOpen(true);
    announce('Destructive confirmation dialog opened. Escape closes it and focus returns to the invoker.');
  };

  const closeConfirm = () => {
    setDialogOpen(false);
    restoreFocus();
    announce('Confirmation cancelled. Focus returned to the invoker.');
  };

  const confirmAction = () => {
    setDialogOpen(false);
    restoreFocus();
    setConfirmed(true);
    announce('Destructive action confirmed. Focus returned to the invoker.');
  };

  return (
    <GdsBox padding="md" data-gds-proof="true" data-gds-proof-ready="true">
      <GdsStack gap="lg">
        <GdsBox>
          <PageHeader
            eyebrow="NARIMATO // UI-01 // PROOF"
            title="GDS ISLAND ONLINE"
            description="One provider, one stylesheet, GDS-only composition and all five required UI states. This surface is dev-only: add ?gds=proof to inspect it."
            actions={<StatusBadge status="success" withIcon>PROVIDER 1 · ROOT 1</StatusBadge>}
          />
        </GdsBox>

        <GdsInline gap="sm" align="center">
          <StatusBadge status="neutral">BUILD {cfg.version}</StatusBadge>
          <StatusBadge status={cfg.reducedMotion ? 'info' : 'neutral'}>
            {cfg.reducedMotion ? 'REDUCED MOTION ON' : 'REDUCED MOTION OFF'}
          </StatusBadge>
          <StatusBadge status="neutral">THEME {String(cfg.colorScheme).toUpperCase()}</StatusBadge>
          <StatusBadge status={confirmed ? 'success' : 'neutral'}>
            {confirmed ? 'DESTRUCTIVE CONFIRM PROVEN' : 'DESTRUCTIVE CONFIRM UNTESTED'}
          </StatusBadge>
        </GdsInline>

        <Announcer message={announcement} seq={announceSeq} />

        <StateCard state="loading">
          <StateBlock
            variant="loading"
            title="Loading world telemetry"
            description="Waiting for the authoritative server snapshot before painting any value."
          />
        </StateCard>

        <StateCard state="empty">
          <EmptyState
            title="No operators in this world"
            description="Nobody is mining on this planet yet. The empty state always offers a next action."
            action={<SemanticButton action="refresh" label="Refresh operators" />}
          />
        </StateCard>

        <StateCard state="error">
          <GdsStack gap="sm">
            <StateBlock
              variant="error"
              title="Island failed to boot"
              description="The game keeps playing: a boot failure falls back to the legacy UI and shows a dismissible banner. This simulated error proves the recovery action."
              action={
                <SemanticButton
                  action="refresh"
                  label="Retry island boot"
                  onClick={runRetry}
                  loading={retrying}
                />
              }
            />
            {recovered ? (
              <InlineAlert severity="success" title="Recovered" message="The retry succeeded and the error state recovered." />
            ) : null}
          </GdsStack>
        </StateCard>

        <StateCard state="disabled">
          <GdsStack gap="sm">
            <InlineAlert
              severity="warning"
              title="Why this control is disabled"
              message="The escape drive is not loaded yet, so burning for orbit is unavailable. The reason is always visible next to the disabled control."
            />
            <GdsInline gap="sm" align="center">
              <SemanticButton action="launch" label="Burn for orbit" disabled />
              <StatusBadge status="warning">DISABLED: DRIVE NOT LOADED</StatusBadge>
            </GdsInline>
          </GdsStack>
        </StateCard>

        <StateCard state="success">
          <GdsStack gap="sm">
            <GdsInline gap="sm" align="center">
              <StatusBadge status="success" withIcon>
                FIVE OF FIVE STATES PROVEN
              </StatusBadge>
              <SemanticButton action="delete" label="Abandon run (demo)" onClick={openConfirm} />
            </GdsInline>
            <GdsMeter value={5} max={5} label="Proof state coverage" valueText="5 of 5 required states proven" />
            <InlineAlert
              severity="success"
              title="Announced"
              message="State changes are announced through the polite live region above; this success state is also conveyed in text."
            />
          </GdsStack>
        </StateCard>

        <InlineAlert
          severity="info"
          title="Scope"
          message="UI-01 proves the pipeline and the boundary. Game surfaces migrate in UI-02 through UI-05; the canvas renderer is unchanged."
        />
      </GdsStack>

      <ConfirmDialog
        opened={dialogOpen}
        onClose={closeConfirm}
        onConfirm={confirmAction}
        title="Abandon run?"
        confirmAction="delete"
        cancelAction="cancel"
        confirmLabel="Abandon run"
        cancelLabel="Keep playing"
      >
        This is the shared GDS confirm dialog. Escape or Keep playing cancels, and focus returns to the
        Abandon run button that opened it.
      </ConfirmDialog>
    </GdsBox>
  );
}
