/**
 * NARIMATO — incident GDS dialog (EVT-02).
 *
 * The full-screen FX canvas is product rendering owned by `interlude.js`; the
 * incident *UI* is this governed GDS dialog. The island owns the accessible
 * name, focus trap/restore, Escape handling, typography, spacing, elevation and
 * the dismiss control. No hand-rolled overlay markup or custom close control is
 * rendered by the game page.
 *
 * The title is the dialog's accessible name (`aria-labelledby` points at the
 * GDS modal title, which wraps `#meteor-title`). Focus enters the heading, then
 * Tab reaches the Modal close button and the GDS DISMISS button.
 */
import { useEffect, useRef } from 'react';
import {
  BodyText,
  Button,
  GdsBox,
  GdsInline,
  GdsStack,
  Modal,
  LabelText,
  MetadataText,
} from '@sovereignsquad/gds/client';

const intent = (type) => {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent('narimato:gds-intent', { detail: { type } }));
  return true;
};

export default function IncidentDialog({ incident }) {
  const slice = incident || {};
  const open = slice.open === true;
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // Focus the heading once the portal has mounted. The GDS modal traps focus;
    // this only chooses the initial stop, so screen readers start on the name.
    const handle = setTimeout(() => {
      const node = titleRef.current;
      if (node && typeof node.focus === 'function') {
        try {
          node.focus({ preventScroll: true });
        } catch {
          /* focus is best-effort */
        }
      }
    }, 80);
    return () => clearTimeout(handle);
  }, [open, slice.kind, slice.title]);

  return (
    <Modal
      id="meteor-overlay"
      data-gds-surface="dialog"
      data-gds-component="incident"
      opened={open}
      onClose={() => intent('incident-dismiss')}
      title={
        <span id="meteor-title" ref={titleRef} tabIndex={-1} data-incident-title="true">
          {slice.title || 'PLANETARY EVENT'}
        </span>
      }
      closeOnEscape
      closeOnClickOutside={false}
      returnFocus
      closeButtonProps={{ 'aria-label': 'Dismiss incident' }}
      size="lg"
      centered
      className="gds-incident-modal"
      classNames={{ content: 'gds-dialog-content' }}
      data-incident-kind={slice.kind || 'meteor'}
      data-reduced-motion={slice.reducedMotion === true ? 'true' : 'false'}
    >
      <GdsBox
        data-gds-surface="dialog"
        data-gds-component="incident"
        data-incident-kind={slice.kind || 'meteor'}
        data-reduced-motion={slice.reducedMotion === true ? 'true' : 'false'}
      >
        <GdsStack gap="sm">
          <MetadataText>PLANETARY EVENT // SURFACE IMPACT</MetadataText>
          <LabelText component="p" id="meteor-sub">
            {slice.message || 'NEW RESOURCES AVAILABLE'}
          </LabelText>
          {slice.description ? <BodyText id="meteor-description">{slice.description}</BodyText> : null}
          <GdsInline justify="flex-end" gap="sm">
            <Button id="meteor-dismiss" size="lg" onClick={() => intent('incident-dismiss')}>
              DISMISS
            </Button>
          </GdsInline>
        </GdsStack>
      </GdsBox>
    </Modal>
  );
}
