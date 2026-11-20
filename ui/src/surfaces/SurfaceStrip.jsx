/**
 * NARIMATO — additive surface strip (UI-04).
 *
 * Lives inside the one `#hud` tree. It adds only controls, target status, lap
 * and exit; the orbital mission/players/cargo panels stay mounted underneath.
 */
import { Button, GdsBox, GdsInline, GdsStack, LabelText, MetadataText, Progress, StatusBadge } from '@sovereignsquad/gds/client';
import { IDS } from './intents.js';
import { MOVE_KEYS, MOVE_LABELS, exitControl, modeChip, targetStateBadge, targetStateText } from '../../../public/js/shared/surface-hud.js';

const PADS = [
  { move: 'forward', glyph: '▲' },
  { move: 'left', glyph: '◀' },
  { move: 'back', glyph: '▼' },
  { move: 'right', glyph: '▶' },
];

export default function SurfaceStrip({ surface, intent }) {
  const active = surface && surface.active === true;
  const phase = surface ? surface.phase : 'idle';
  const target = (surface && surface.target) || { label: null, state: 'idle' };
  const lap = (surface && surface.lap) || { run: 0, seconds: 0, auto: null };
  const mission = (surface && surface.mission) || { done: 0, total: 0, ready: false };
  const chip = modeChip(surface);
  const exit = exitControl(phase);
  const badge = targetStateBadge(target.state);
  const disabled = phase === 'landing' || phase === 'leaving';

  const hold = (code, down) => (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    intent('surface-hold', { code, down });
  };

  return (
    <GdsBox
      id={IDS.surface}
      className="gds-surface-strip"
      data-hud-node="surface-controls"
      role="group"
      aria-label="Surface controls"
      hidden={!active}
    >
      <GdsInline justify="between" align="center" gap="sm">
        <GdsInline gap="xs" align="center">
          <StatusBadge status={active ? 'warning' : 'neutral'}>{chip.surface}</StatusBadge>
          <MetadataText>{`KEYBOARD: ${chip.keyboard}`}</MetadataText>
        </GdsInline>
        <GdsInline gap="xs" align="center">
          {mission.total > 0 ? (
            <MetadataText id="surface-mission-echo">
              {`REFIT ${mission.done}/${mission.total}${mission.ready ? ' READY' : ''}`}
            </MetadataText>
          ) : null}
          <Button id={IDS.surfaceExit} size="compact-lg" disabled={exit.disabled} onClick={() => intent('surface-exit')}>
            {exit.label}
          </Button>
        </GdsInline>
      </GdsInline>

      <GdsBox
        component="p"
        id={IDS.surfaceTarget}
        className="gds-surface-target"
        data-hud-node="surface-target"
        data-state={target.state}
        role="status"
        aria-live="polite"
        aria-label={targetStateText(target.state, target.label)}
      >
        {target.label ? <StatusBadge status={badge.status}>{badge.text}</StatusBadge> : null}
        <LabelText>{target.label ? `TARGET ${target.label}` : 'TARGET: —'}</LabelText>
      </GdsBox>

      <GdsInline justify="between" align="center" gap="sm" className="gds-surface-lap">
        <MetadataText>LAP</MetadataText>
        <Progress
          id={IDS.surfaceLap}
          data-hud-node="surface-lap"
          value={lap.run}
          size="md"
          aria-label="Surface lap progress"
        />
        <LabelText id={IDS.surfaceLapValue} data-hud-node="surface-lap-value">
          {Number(lap.seconds || 0).toFixed(2)}
        </LabelText>
        <MetadataText id="surface-auto" data-hud-node="surface-auto">
          {lap.auto ? `AUTO ${lap.auto}` : '—'}
        </MetadataText>
      </GdsInline>

      <GdsInline gap="xs" justify="center" wrap="wrap" className="gds-surface-pads" data-hud-node="surface-pads" aria-label="Surface movement controls">
        {[
          { move: 'forward', glyph: '▲', node: 'surface-forward', first: true },
          { move: 'left', glyph: '◀', node: 'surface-left' },
          { move: 'back', glyph: '▼', node: 'surface-back' },
          { move: 'right', glyph: '▶', node: 'surface-right' },
        ].map((pad) => {
          const code = MOVE_KEYS[pad.move];
          return (
            <Button
              key={pad.move}
              type="button"
              className="gds-surface-pad"
              data-surface-hold={code}
              data-surface-first={pad.first ? 'true' : undefined}
              data-hud-node={pad.node}
              aria-label={MOVE_LABELS[pad.move]}
              aria-disabled={disabled ? 'true' : 'false'}
              onPointerDown={hold(code, true)}
              onPointerUp={hold(code, false)}
              onPointerCancel={hold(code, false)}
              onPointerLeave={hold(code, false)}
              onBlur={hold(code, false)}
            >
              {pad.glyph}
            </Button>
          );
        })}
      </GdsInline>
    </GdsBox>
  );
}
