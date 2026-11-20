/**
 * NARIMATO — GDS control-mode indicator (CTL-05 inside the UI-02..05 island).
 *
 * One group states the live control mode (`OFFLINE|ORBIT|DESCENT|SURFACE|
 * LEAVING`) and the pointer polarity, exposes the two actions as real GDS
 * buttons (`aria-pressed` on the drag toggle, `aria-disabled` during
 * transitions), and announces each transition once through a polite live
 * region. Mode is derived by the game (`shared/control-mode.js`) and published
 * as the `controlMode` slice; this component only renders and dispatches
 * intents — it never touches game state.
 */
import { Button, GdsInline, GdsStack, StatusBadge, VisuallyHidden } from '@sovereignsquad/gds/client';
import { IDS, dispatchIntent } from './intents.js';

const intent = (type) => dispatchIntent(type);

export const CONTROL_MODE_IDS = Object.freeze({
  group: IDS.controlMode,
  label: IDS.controlModeLabel,
  drag: IDS.controlModeDrag,
  action: IDS.controlModeAction,
  reason: IDS.controlModeReason,
  live: IDS.controlModeLive,
});

export default function ControlMode({ slice }) {
  const data = slice || {};
  const mode = String(data.mode || 'offline');
  const dragInvert = data.dragInvert === true;
  const canToggle = data.canToggle !== false;
  return (
    <GdsStack
      id={CONTROL_MODE_IDS.group}
      gap={2}
      className="gds-control-mode"
      data-gds-component="control-mode"
      data-hud-node="control-mode"
      data-mode={mode}
      role="group"
      aria-label="Control mode"
      aria-describedby={CONTROL_MODE_IDS.reason}
    >
      <GdsInline gap="xs" align="center">
        <StatusBadge status={mode === 'surface' || mode === 'descending' ? 'success' : mode === 'offline' ? 'neutral' : 'info'}>
          <span id={CONTROL_MODE_IDS.label} data-hud-node="control-mode-label">{data.label || mode.toUpperCase()}</span>
        </StatusBadge>
        <StatusBadge status={dragInvert ? 'warning' : 'neutral'}>DRAG</StatusBadge>
      </GdsInline>
      <Button
        id={CONTROL_MODE_IDS.drag}
        data-hud-node="control-mode-drag"
        variant={dragInvert ? 'light' : 'subtle'}
        size="compact-lg"
        aria-pressed={dragInvert}
        aria-describedby={CONTROL_MODE_IDS.reason}
        onClick={() => intent('drag-mode-toggle')}
      >
        {data.dragLabel || (dragInvert ? 'DRAG: REVERSE' : 'DRAG: FOLLOW CURSOR')}
      </Button>
      <Button
        id={CONTROL_MODE_IDS.action}
        data-hud-node="control-mode-action"
        variant="outline"
        size="compact-lg"
        aria-disabled={canToggle ? undefined : 'true'}
        aria-describedby={CONTROL_MODE_IDS.reason}
        onClick={() => { if (canToggle) intent('control-mode-action'); }}
      >
        {data.actionLabel || 'ENTER SURFACE'}
      </Button>
      <VisuallyHidden>
        <span id={CONTROL_MODE_IDS.reason} data-hud-node="control-mode-reason">
          {data.reason || 'Press to switch between orbit and surface.'}
        </span>
      </VisuallyHidden>
      <VisuallyHidden>
        <span id={CONTROL_MODE_IDS.live} role="status" aria-live="polite" aria-atomic="true" data-hud-node="control-mode-live">
          {data.sentence || ''}
          {data.seq ? ` (${data.seq})` : ''}
        </span>
      </VisuallyHidden>
    </GdsStack>
  );
}
