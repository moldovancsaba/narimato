/**
 * NARIMATO — GDS cine chrome (UI-05).
 *
 * The intro/interlude controllers keep their timing state machines; this layer
 * renders the skip/replay/narration/caption/status chrome from the published
 * slice. It is additive: the legacy overlay stays mounted for the cockpit FX,
 * and its bespoke chrome is hidden while the island is on.
 */
import { Button, GdsBox, GdsInline, GdsStack, LabelText, MetadataText, Progress, StatusBadge } from '@sovereignsquad/gds/client';
import { IDS } from './intents.js';

const intent = (type, detail) => {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent('narimato:gds-intent', { detail: { type, ...detail } }));
  return true;
};

const STEER = [
  { dir: 'up', glyph: '▲', label: 'Thrust up' },
  { dir: 'left', glyph: '◀', label: 'Thrust left' },
  { dir: 'right', glyph: '▶', label: 'Thrust right' },
  { dir: 'down', glyph: '▼', label: 'Thrust down' },
];

function SteerPads() {
  return (
    <GdsStack id="intro-steer" gap="xs" className="gds-cine-steer" aria-label="Touch steering">
      <GdsInline gap="xs" justify="center">
        <Button
          id="steer-up"
          className="gds-cine-pad"
          aria-label="Thrust up"
          onPointerDown={() => intent('cine-steer', { dir: 'up', down: true })}
          onPointerUp={() => intent('cine-steer', { dir: 'up', down: false })}
          onPointerCancel={() => intent('cine-steer', { dir: 'up', down: false })}
          onPointerLeave={() => intent('cine-steer', { dir: 'up', down: false })}
        >
          ▲
        </Button>
      </GdsInline>
      <GdsInline gap="xs" justify="center">
        {STEER.filter((pad) => pad.dir !== 'up' && pad.dir !== 'down').map((pad) => (
          <Button
            key={pad.dir}
            id={`steer-${pad.dir}`}
            className="gds-cine-pad"
            aria-label={pad.label}
            onPointerDown={() => intent('cine-steer', { dir: pad.dir, down: true })}
            onPointerUp={() => intent('cine-steer', { dir: pad.dir, down: false })}
            onPointerCancel={() => intent('cine-steer', { dir: pad.dir, down: false })}
            onPointerLeave={() => intent('cine-steer', { dir: pad.dir, down: false })}
          >
            {pad.glyph}
          </Button>
        ))}
      </GdsInline>
      <GdsInline gap="xs" justify="center">
        <Button
          id="steer-down"
          className="gds-cine-pad"
          aria-label="Thrust down"
          onPointerDown={() => intent('cine-steer', { dir: 'down', down: true })}
          onPointerUp={() => intent('cine-steer', { dir: 'down', down: false })}
          onPointerCancel={() => intent('cine-steer', { dir: 'down', down: false })}
          onPointerLeave={() => intent('cine-steer', { dir: 'down', down: false })}
        >
          ▼
        </Button>
      </GdsInline>
    </GdsStack>
  );
}

export default function CineChrome({ cine, voice, captions }) {
  const slice = cine || {};
  const introActive = slice.kind === 'intro' && slice.active === true;
  const interludeActive = slice.kind === 'interlude' && slice.active === true;
  const motion = slice.motion === 'reduced' ? 'reduced' : 'full';
  const copy = slice.copy || {};
  const voiceState = voice || {};

  return (
    <>
      {introActive ? (
        <GdsStack
          id="gds-intro-cine"
          gap="md"
          align="center"
          justify="between"
          padding="lg"
          className="gds-cine gds-cine--intro"
          data-motion={motion}
          data-phase={slice.phase}
          role="region"
          aria-label="Wormhole cockpit controls"
        >
          <GdsStack gap="sm" className="gds-cine-copy" align="center">
            <MetadataText id="intro-phase">{copy.kicker}</MetadataText>
            <LabelText id="intro-status" className="gds-cine-title">
              {copy.title}
            </LabelText>
            <MetadataText id="intro-sub">{copy.sub}</MetadataText>
            <Progress
              id="intro-bar"
              value={slice.progress}
              size="md"
              aria-label="Intro progress"
            />
            {copy.alarm ? (
              <StatusBadge id="intro-alarm" status="warning" withIcon>
                {copy.alarm}
              </StatusBadge>
            ) : null}
            <GdsInline gap="sm" align="center">
              <Button
                id="btn-skip-intro"
                variant="light"
                disabled={!slice.skipVisible}
                onClick={() => intent('cine-skip')}
              >
                SKIP INTRO ▸
              </Button>
              <Button
                id="btn-subtitles-cine"
                variant="subtle"
                aria-pressed={voiceState.subtitles === false ? 'false' : 'true'}
                onClick={() => intent('cine-toggle-captions')}
              >
                CC
              </Button>
              <Button
                id="btn-voice-cine"
                variant="subtle"
                aria-pressed={voiceState.voice === false ? 'false' : 'true'}
                onClick={() => intent('cine-toggle-voice')}
              >
                VOX
              </Button>
              <Button
                id="btn-replay-intro-cine"
                variant="subtle"
                onClick={() => intent('cine-replay')}
              >
                REPLAY
              </Button>
            </GdsInline>
            <MetadataText>WASD / ARROWS TO STEER · TOUCH PADS ON MOBILE · GRAVITY DOMINATES</MetadataText>
          </GdsStack>
          <SteerPads />
        </GdsStack>
      ) : null}

      {interludeActive ? (
        <GdsStack
          id="gds-interlude-cine"
          gap="md"
          align="center"
          justify="between"
          padding="lg"
          className="gds-cine gds-cine--interlude"
          data-motion={motion}
          data-phase={slice.phase}
          role="region"
          aria-label="Interplanetary flight"
        >
          <GdsStack gap="sm" className="gds-cine-copy" align="center">
            <MetadataText>INTERPLANETARY TRANSIT</MetadataText>
            <MetadataText id="interlude-planet">{slice.planet || 'TRANSIT'}</MetadataText>
            <StatusBadge status="info" id="interlude-status">
              {copy.status || slice.phase}
            </StatusBadge>
            <LabelText id="interlude-title" className="gds-cine-title">
              {copy.title}
            </LabelText>
            <MetadataText id="interlude-sub">{copy.sub}</MetadataText>
            {Array.isArray(slice.lines) && slice.lines.length ? (
              <GdsStack id="interlude-story" gap="xs" align="center">
                {slice.lines.map((line, index) => (
                  <MetadataText key={index}>{line}</MetadataText>
                ))}
              </GdsStack>
            ) : null}
            <Progress
              id="interlude-bar"
              value={slice.progress}
              size="md"
              aria-label="Transit progress"
            />
            {slice.continueVisible ? (
              <Button id="btn-interlude-continue" onClick={() => intent('cine-continue')}>
                CONTINUE ▸
              </Button>
            ) : null}
            <MetadataText>
              {captions && captions.visible ? 'CAPTIONS ON' : 'CAPTIONS OFF'} · REDUCED MOTION {motion.toUpperCase()}
            </MetadataText>
          </GdsStack>
        </GdsStack>
      ) : null}
    </>
  );
}
