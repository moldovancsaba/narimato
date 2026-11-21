/**
 * NARIMATO — GDS gameplay HUD (UI-02).
 *
 * Every panel, control and readout is a shipped GDS component or a GDS layout
 * primitive with token props. The ids and `data-hud-node` hooks below are the
 * DOM contract `public/js/app.js` and `public/js/ui.js` already consumed; the
 * legacy markup is claimed off the document when the island takes over.
 */
import {
  Badge,
  BodyText,
  Button,
  EmptyState,
  GdsBox,
  GdsInline,
  GdsStack,
  LabelText,
  MetadataText,
  Progress,
  SectionPanel,
  StatusBadge,
  VisuallyHidden,
} from '@sovereignsquad/gds/client';
import { IDS, dispatchIntent } from './intents.js';
import {
  CONNECTION_TEXT,
  chargePercent,
  chargeText,
  connectionText,
  formatNumber,
  formatZoom,
  missionDoneRatio,
  normalizeTag,
  pad2,
  targetState,
  TARGET_STATE_TEXT,
  zoomBand,
  zoomPercent,
} from '../../../public/js/shared/hud-contract.js';
import SurfaceStrip from './SurfaceStrip.jsx';
import ControlMode from './ControlMode.jsx';

const intent = (type, detail) => dispatchIntent(type, detail);

function HudStat({ label, value, id, tone }) {
  return (
    <GdsStack gap={0} className="gds-hud-stat">
      <MetadataText>{label}</MetadataText>
      {id ? (
        <LabelText id={id} className="gds-hud-stat-value" role="status" aria-live="off">
          {value}
        </LabelText>
      ) : (
        <LabelText className="gds-hud-stat-value">{value}</LabelText>
      )}
      {tone ? <MetadataText>{tone}</MetadataText> : null}
    </GdsStack>
  );
}

function MissionItemRow({ item }) {
  const status = item.done ? 'success' : item.have > 0 ? 'warning' : 'neutral';
  return (
    <GdsBox component="li" className="gds-mission-item" data-done={item.done ? 'true' : 'false'}>
      <GdsInline justify="between" align="center" gap="xs" wrap="nowrap">
        <GdsInline gap="xs" align="center" wrap="nowrap">
          <LabelText>{item.name}</LabelText>
        </GdsInline>
        <GdsInline gap="xs" align="center" wrap="nowrap">
          <MetadataText>
            {item.have}/{item.need}
          </MetadataText>
          <StatusBadge status={status}>{item.done ? 'LOADED' : 'NEEDED'}</StatusBadge>
        </GdsInline>
      </GdsInline>
      <Progress
        value={item.percent}
        size="xs"
        aria-label={`${item.name}: ${item.have} of ${item.need}`}
      />
    </GdsBox>
  );
}

function MissionPanel({ mission, cargo, captainLog, distress, escape, drawer, intent: send }) {
  const ready = mission.ready === true;
  const done = mission.objectives.filter((objective) => objective.done).length;
  const total = Math.max(1, mission.objectives.length);
  return (
    <GdsBox
      id={IDS.mission}
      className="gds-panel gds-panel--mission"
      data-hud-node="mission"
      data-drawer={drawer === 'mission' ? 'open' : 'closed'}
      role="region"
      aria-label="Escape mission objectives"
    >
      <SectionPanel
        eyebrow="THE WAY HOME"
        title="SHIP REFIT"
        titleOrder={2}
        action={
          <GdsInline gap="xs" align="center">
            <StatusBadge status={ready ? 'success' : 'info'} id={IDS.missionStatus}>
              {ready ? 'READY TO FLY' : 'REFIT IN PROGRESS'}
            </StatusBadge>
            <Button
              variant="subtle"
              size="compact-lg"
              aria-label="Close mission panel"
              data-drawer-close="true"
              onClick={() => send('drawer-close')}
            >
              ✕
            </Button>
          </GdsInline>
        }
      >
        <GdsStack gap="sm">
          <GdsInline justify="between" align="center">
            <LabelText>{`${done} / ${total} SYSTEMS LOADED`}</LabelText>
            <LabelText aria-label={`${done} of ${total} mission systems loaded`}>{`${done}/${total}`}</LabelText>
          </GdsInline>
          <GdsStack
            component="ul"
            id={IDS.missionList}
            data-mission="hud"
            data-hud-node="mission-list"
            gap="xs"
            padding={0}
            className="gds-list"
          >
            {mission.objectives.length ? (
              mission.objectives.map((objective) => (
                <GdsBox component="li" key={objective.id} data-objective={objective.id} className="gds-mission-objective">
                  <GdsInline justify="between" align="center">
                    <LabelText>{objective.name}</LabelText>
                    <StatusBadge status={objective.done ? 'success' : 'neutral'}>
                      {objective.done ? 'LOADED' : 'STILL NEEDED'}
                    </StatusBadge>
                  </GdsInline>
                  <GdsStack component="ul" gap="xs" padding={0} className="gds-list">
                    {objective.items.map((item) => (
                      <MissionItemRow key={item.resourceId || item.name} item={item} />
                    ))}
                  </GdsStack>
                </GdsBox>
              ))
            ) : (
              <GdsBox component="li">
                <EmptyState
                  title="No refit systems"
                  description="This planet has no escape mission data yet. Keep mining; the drive will report its needs."
                />
              </GdsBox>
            )}
          </GdsStack>

          <GdsStack gap={0} className="gds-subpanel">
            <MetadataText>CAPTAIN&apos;S LOG</MetadataText>
            <LabelText id="captains-log-text">{captainLog}</LabelText>
          </GdsStack>

          <GdsBox className="gds-subpanel">
            <GdsInline justify="between" align="center">
              <LabelText>WHAT WE&apos;RE CARRYING</LabelText>
              <LabelText id={IDS.cargoTotal} data-hud-node="cargo" aria-label={`${cargo.total} ore in cargo`}>
                {formatNumber(cargo.total)}
              </LabelText>
            </GdsInline>
            <GdsStack
              component="ul"
              id={IDS.cargoList}
              data-hud-node="cargo-list"
              gap="xs"
              padding={0}
              className="gds-list"
            >
              {cargo.entries.length ? (
                cargo.entries.map((entry) => (
                  <GdsBox component="li" key={entry.id} className="gds-cargo-item">
                    <GdsInline justify="between" align="center" gap="xs">
                      <GdsInline gap="xs" align="center">
                        <VisuallyHidden>{entry.glyph}</VisuallyHidden>
                        <LabelText>{entry.name}</LabelText>
                      </GdsInline>
                      <MetadataText>{`×${entry.amount}`}</MetadataText>
                    </GdsInline>
                  </GdsBox>
                ))
              ) : (
                <GdsBox component="li">
                  <MetadataText>THE HOLD IS EMPTY // PICK A TRIANGLE</MetadataText>
                </GdsBox>
              )}
            </GdsStack>
          </GdsBox>

          {distress.visible ? (
            <GdsInline id="distress-row" justify="between" align="center" gap="sm">
              <MetadataText>IF WE&apos;RE STILL STUCK</MetadataText>
              <LabelText id="distress-time">{distress.text}</LabelText>
            </GdsInline>
          ) : null}

          <GdsInline gap="sm" align="center">
            <Button
              id={IDS.escape}
              hidden={!escape.ready}
              onClick={() => send('escape')}
              aria-label={`${escape.missionName} ready — try to fly away and escape`}
            >
              ESCAPE // BURN FOR ORBIT
            </Button>
            <MetadataText>
              {escape.ready ? 'WARP CORE CHARGED' : 'FIND THE PARTS. LIGHT THE DRIVE.'}
            </MetadataText>
          </GdsInline>
        </GdsStack>
      </SectionPanel>
    </GdsBox>
  );
}

function PlayersPanel({ players, drawer, intent: send }) {
  return (
    <GdsBox
      id={IDS.players}
      className="gds-panel gds-panel--players"
      data-hud-node="players"
      data-drawer={drawer === 'operators' ? 'open' : 'closed'}
      role="region"
      aria-label="Operators in the world"
    >
      <SectionPanel
        eyebrow="PILOTS HERE"
        title="OPERATORS"
        titleOrder={3}
        action={
          <GdsInline gap="xs" align="center">
            <LabelText id={IDS.playersCount} aria-label={`${players.online} operators online`}>
              {players.online} ONLINE
            </LabelText>
            <Button
              variant="subtle"
              size="compact-lg"
              aria-label="Close operators panel"
              data-drawer-close="true"
              onClick={() => send('drawer-close')}
            >
              ✕
            </Button>
          </GdsInline>
        }
      >
        <GdsStack component="ul" id={IDS.playersList} gap="xs" padding={0} className="gds-list">
          {players.rows.length ? (
            players.rows.map((player) => (
              <GdsBox
                component="li"
                key={player.id}
                data-player-id={player.id}
                data-me={player.isMe ? 'true' : 'false'}
                className="gds-player-row"
                aria-label={`${player.tag}, ${formatNumber(player.score)} points, ${player.faces} faces, ${
                  player.online ? 'online' : 'offline'
                }${player.isMe ? ', you' : ''}`}
              >
                <GdsInline justify="between" align="center" gap="xs" wrap="nowrap">
                  <GdsInline gap="xs" align="center" wrap="nowrap">
                    <LabelText>{player.tag}</LabelText>
                    {player.isMe ? <StatusBadge status="info">YOU</StatusBadge> : null}
                  </GdsInline>
                  <GdsInline gap="sm" align="center" wrap="nowrap">
                    <MetadataText>{`${formatNumber(player.faces)}F`}</MetadataText>
                    <LabelText>{formatNumber(player.score)}</LabelText>
                    <StatusBadge status={player.online ? 'success' : 'neutral'}>
                      {player.online ? 'LIVE' : 'OFF'}
                    </StatusBadge>
                  </GdsInline>
                </GdsInline>
              </GdsBox>
            ))
          ) : (
            <GdsBox component="li">
              <EmptyState
                title="No other operators"
                description="AWAITING OPERATORS… Nobody else is mining this planet yet. Your faces still count."
              />
            </GdsBox>
          )}
        </GdsStack>
        {players.hidden > 0 ? (
          <MetadataText aria-live="polite">{`+${players.hidden} MORE OPERATORS`}</MetadataText>
        ) : null}
      </SectionPanel>
    </GdsBox>
  );
}

function ArcadePanel({ arcade, highlightTag, drawer, intent: send }) {
  return (
    <GdsBox
      id={IDS.arcade}
      className="gds-panel gds-panel--arcade"
      data-hud-node="arcade"
      data-drawer={drawer === 'arcade' ? 'open' : 'closed'}
      role="region"
      aria-label="All-time arcade top ten"
    >
      <SectionPanel
        eyebrow="LEGENDS OF THE GRID"
        title="ALL-TIME TOP 10"
        titleOrder={3}
        action={
          <Button
            variant="subtle"
            size="compact-lg"
            aria-label="Close arcade panel"
            data-drawer-close="true"
            onClick={() => send('drawer-close')}
          >
            ✕
          </Button>
        }
      >
        <GdsStack component="ol" gap="xs" padding={0} className="gds-list">
          {arcade.length ? (
            arcade.slice(0, 10).map((entry, index) => (
              <GdsBox
                component="li"
                key={`${entry.tag}-${index}`}
                className="gds-arcade-row"
                data-me={entry.tag === highlightTag ? 'true' : 'false'}
                aria-label={`Rank ${index + 1}: ${entry.tag}, score ${formatNumber(entry.score)}, ${entry.facesHeld} faces held`}
              >
                <GdsInline justify="between" align="center" gap="sm" wrap="nowrap">
                  <GdsInline gap="sm" align="center" wrap="nowrap">
                    <MetadataText>{pad2(index + 1)}</MetadataText>
                    <LabelText>{entry.tag}</LabelText>
                  </GdsInline>
                  <GdsInline gap="sm" align="center" wrap="nowrap">
                    <MetadataText>{`${formatNumber(entry.facesHeld)}F`}</MetadataText>
                    <LabelText>{formatNumber(entry.score)}</LabelText>
                  </GdsInline>
                </GdsInline>
              </GdsBox>
            ))
          ) : (
            <GdsBox component="li">
              <EmptyState title="No records yet" description="NO RECORDS // BE THE FIRST" />
            </GdsBox>
          )}
        </GdsStack>
      </SectionPanel>
    </GdsBox>
  );
}

function TargetInspector({ target, intent: send }) {
  const state = target.state || 'idle';
  return (
    <GdsBox
      id={IDS.target}
      className="gds-panel gds-panel--target"
      data-hud-node="target"
      data-state={state}
      role="region"
      aria-label="Hovered cell"
      aria-live="polite"
      hidden={!target.open}
    >
      <GdsStack gap="xs">
        {target.open ? (
        <>
        <GdsInline justify="between" align="center">
          <MetadataText>TARGET CELL</MetadataText>
          <Button
            variant="subtle"
            size="compact-lg"
            id={IDS.targetClose}
            aria-label="Close cell inspector"
            onClick={() => send('target-close')}
          >
            ✕
          </Button>
        </GdsInline>
        <GdsInline gap="sm" align="center" justify="between">
          <GdsInline gap="xs" align="center">
            <LabelText id="target-label">{target.label}</LabelText>
            <StatusBadge status={state === 'depleted' ? 'danger' : state === 'locked' ? 'warning' : 'neutral'} id="target-depth">
              {`D${target.depth}`}
            </StatusBadge>
          </GdsInline>
          <LabelText id="target-owner">
            {target.owner ? `${normalizeTag(target.owner.tag) || 'OPERATOR'}${target.isMine ? ' // YOU' : ''}` : 'UNCLAIMED'}
          </LabelText>
        </GdsInline>
        {target.terrain ? (
          <GdsInline id="target-terrain" gap="xs" align="center" justify="between">
            <MetadataText>TERRAIN</MetadataText>
            <LabelText id="target-terrain-name">{target.terrain.name}</LabelText>
            <MetadataText id="target-terrain-elev">{target.terrain.elevation}</MetadataText>
          </GdsInline>
        ) : null}
        {target.statusText ? (
          <GdsBox id="target-status" data-state={target.statusState}>
            <StatusBadge status={state === 'depleted' ? 'danger' : state === 'locked' ? 'warning' : 'info'}>
              <span id="target-status-text">{target.statusText}</span>
            </StatusBadge>
          </GdsBox>
        ) : null}
        <MetadataText id="target-meta">{target.meta}</MetadataText>
        <VisuallyHidden>{TARGET_STATE_TEXT[state] || TARGET_STATE_TEXT.idle}</VisuallyHidden>
        </>
        ) : null}
        <GdsInline gap="sm" align="center" justify="between">
          <LabelText>CHARGE</LabelText>
          <Progress
            id={IDS.chargeBar}
            value={target.chargePercent || 0}
            size="md"
            aria-label={`Cell ${target.label || 'target'} charge`}
          />
          <LabelText id="target-charge">{chargeText(target.clicks, target.threshold)}</LabelText>
        </GdsInline>
      </GdsStack>
    </GdsBox>
  );
}

export default function HudSurface({ ui, surface, cineActive }) {
  const hud = ui.hud || {};
  const players = ui.players || { rows: [], total: 0, online: 0, hidden: 0 };
  const mission = ui.mission || { ready: false, objectives: [] };
  const cargo = ui.cargo || { total: 0, entries: [] };
  const arcade = ui.arcade || [];
  const target = ui.target || { open: false };
  const nav = ui.nav || null;
  const escape = ui.escape || { ready: false, missionName: 'ESCAPE', ctaOpen: false };
  const landingBrief = ui.landingBrief || null;
  const world = ui.world || { text: 'WORLD D0 · 0 FACES' };
  const planet = ui.planet || { name: 'MAGRATHEA', depth: 2, index: 0 };
  const voice = ui.voice || { subtitles: true };
  const captions = ui.captions || { visible: false, speaker: 'NARRATOR', text: '' };
  const connection = ui.connection || 'connecting';
  const hidden = ui.landing ? ui.landing.open || cineActive : cineActive;

  return (
    <>
      <GdsBox
        id={IDS.hud}
        className="gds-hud"
        data-hud-node="hud"
        data-gds-mode={surface.active ? 'surface' : 'orbit'}
        role="region"
        aria-label="World telemetry"
        aria-hidden={hidden ? 'true' : undefined}
      >
        <GdsInline justify="between" align="start" gap="sm" wrap="wrap" padding="sm" className="gds-hud-top">
          <GdsStack gap="xs" padding="sm" className="gds-hud-brand">
            <GdsInline gap="sm" align="center">
              <LabelText className="gds-wordmark">NARIMATO</LabelText>
              <StatusBadge status="info">INFINITE GRID</StatusBadge>
              <MetadataText id={IDS.world} data-hud-node="world">
                {world.text}
              </MetadataText>
            </GdsInline>
            <GdsInline gap="sm" align="center" wrap="wrap">
              <GdsBox
                id={IDS.planet}
                className="gds-planet-badge"
                data-hud-node="planet"
                role="status"
                aria-live="polite"
                aria-label={`${planet.name}, planet ${planet.index + 1}, levels ${planet.depth}`}
              >
                <GdsInline gap="xs" align="center">
                  <StatusBadge status="success">
                    {planet.name}
                  </StatusBadge>
                  <MetadataText id="planet-badge-depth">{`LEVELS ${planet.depth}`}</MetadataText>
                  <MetadataText>{planet.source}</MetadataText>
                </GdsInline>
              </GdsBox>
              {hud.find ? (
                <GdsInline id="hud-find" gap="xs" align="center" aria-label={`Last find: ${hud.find.name}, plus ${hud.find.value} credits`}>
                  <Badge variant="light">{hud.find.name}</Badge>
                  <LabelText>{`+${formatNumber(hud.find.value)} CR`}</LabelText>
                </GdsInline>
              ) : null}
            </GdsInline>
          </GdsStack>

          <GdsStack gap="xs" align="center" padding="sm" w={{ base: '9rem', md: '12rem' }} className="gds-score-cluster" role="group" aria-label="Your score">
            <MetadataText className="gds-score-label">YOUR SCORE</MetadataText>
            <LabelText id={IDS.score} data-hud-node="score" className="gds-score-value">
              {formatNumber(hud.score)}
            </LabelText>
            <LabelText id={IDS.faces}>{`FACES ${formatNumber(hud.faces)}`}</LabelText>
            <GdsInline gap="md" align="center" className="gds-score-mini">
              <MetadataText>
                CLICKS <LabelText id={IDS.clicks}>{formatNumber(hud.clicks)}</LabelText>
              </MetadataText>
              <MetadataText>
                BREAKS <LabelText id={IDS.breaks}>{formatNumber(hud.breaks)}</LabelText>
              </MetadataText>
            </GdsInline>
          </GdsStack>

          <GdsStack gap="xs" padding="sm" w={{ base: '10rem', md: '14rem' }} className="gds-hud-right">
            <ControlMode slice={ui.controlMode} />
            <GdsBox
              id={IDS.zoom}
              className="gds-zoom"
              data-hud-node="zoom"
              data-band={zoomBand(hud.zoom ? hud.zoom.value : 1)}
              role="group"
              aria-label="Camera zoom"
            >
              <GdsInline justify="between" align="center">
                <StatusBadge status="neutral">ZOOM</StatusBadge>
                <StatusBadge status="info" id="hud-zoom-value">{formatZoom(hud.zoom ? hud.zoom.value : 1)}</StatusBadge>
              </GdsInline>
              <Progress
                value={zoomPercent(hud.zoom ? hud.zoom.value : 1)}
                size="sm"
                aria-label="Zoom level"
              />
              <StatusBadge status="neutral" id="hud-zoom-depth">{`FOCUS D${hud.zoom ? hud.zoom.depth : 0}`}</StatusBadge>
            </GdsBox>

          </GdsStack>
        </GdsInline>

        <GdsInline id={IDS.nav} className="gds-nav-chip" gap="xs" align="center" wrap="nowrap" hidden={!nav} data-hud-node="nav" role="region" aria-label="Navigation target">
          {nav ? (
            <>
              <MetadataText>NAV</MetadataText>
              <Button id={IDS.navFocus} size="compact-lg" variant="light" onClick={() => intent('nav-focus')}>
                {nav.label}
              </Button>
              <MetadataText id="nav-target-meta">{nav.meta}</MetadataText>
              <Button id={IDS.navNext} variant="subtle" size="compact-lg" aria-label="Choose another navigation target" onClick={() => intent('nav-next')}>
                ↻
              </Button>
            </>
          ) : null}
        </GdsInline>

        <GdsBox display="grid" className="gds-hud-main">
          <MissionPanel
            mission={mission}
            cargo={cargo}
            captainLog={ui.captainLog || ''}
            distress={ui.distress || { visible: false, text: '02:00' }}
            escape={escape}
            drawer={ui.drawer}
            intent={intent}
          />
          <GdsStack gap="sm" align="center" justify="end" className="gds-hud-center">
            <TargetInspector target={target} intent={intent} />
            {landingBrief ? (
              <GdsBox
                id="landing-brief"
                className="gds-landing-brief"
                role="dialog"
                aria-modal="false"
                aria-labelledby="landing-brief-title"
              >
                <SectionPanel
                  eyebrow={landingBrief.kicker}
                  title={landingBrief.title}
                  titleOrder={3}
                  action={<MetadataText>{landingBrief.sub}</MetadataText>}
                >
                  <GdsStack gap="xs">
                    <MetadataText id="landing-brief-list">
                      {landingBrief.objectives.map((objective) => `${objective.name}: ${objective.done ? 'LOADED' : 'FIND'}`).join(' · ')}
                    </MetadataText>
                    <Button id="btn-landing-brief-start" onClick={() => intent('landing-brief-start')}>
                      START MINING
                    </Button>
                  </GdsStack>
                </SectionPanel>
              </GdsBox>
            ) : null}
            {escape.ctaOpen ? (
              <GdsBox
                id="escape-cta"
                className="gds-escape-cta"
                role="dialog"
                aria-modal="false"
                aria-labelledby="escape-cta-title"
              >
                <SectionPanel
                  eyebrow="WARP CORE CHARGED // ESCAPE WINDOW OPEN"
                  title="READY TO LEAVE"
                  titleOrder={2}
                  tone="warning"
                >
                  <GdsStack gap="sm">
                    <MetadataText id="escape-cta-sub">{`${escape.missionName} COMPLETE // TRY TO FLY AWAY AND ESCAPE`}</MetadataText>
                    <Button id={IDS.escapeCenter} onClick={() => intent('escape-center')}>
                      TRY TO FLY AWAY
                    </Button>
                    <Button id="btn-escape-dismiss" variant="subtle" onClick={() => intent('escape-dismiss')}>
                      KEEP MINING
                    </Button>
                  </GdsStack>
                </SectionPanel>
              </GdsBox>
            ) : null}
            <GdsBox id={IDS.hint} className="gds-hint" display={{ base: 'none', md: 'block' }} data-hud-node="hint" role="status" aria-live="polite">
              {surface.active
                ? 'WASD / ARROWS RUN · A / D TURN · SHIFT SPRINT · ESC // RETURN TO ORBIT'
                : 'CLICK // MINE · DRAG // ROTATE PLANET · ARROWS // TRAVEL · SHIFT // FASTER · DBL-CLICK // FOCUS'}
            </GdsBox>
          </GdsStack>

          <GdsStack gap="md" className="gds-hud-side">
            <PlayersPanel players={players} drawer={ui.drawer} intent={intent} />
            <ArcadePanel arcade={arcade} highlightTag={ui.highlightTag} drawer={ui.drawer} intent={intent} />
          </GdsStack>
        </GdsBox>

        <GdsInline
          id={IDS.dock}
          className="gds-dock"
          gap="xs"
          justify="center"
          wrap="wrap"
          padding="xs"
          role="navigation"
          aria-label="HUD actions"
        >
          <Button
            id="gds-btn-mission"
            variant="subtle"
            size="compact-lg"
            aria-controls={IDS.mission}
            aria-expanded={ui.drawer === 'mission' ? 'true' : 'false'}
            onClick={() => intent('drawer', { name: 'mission' })}
          >
            SHIP
          </Button>
          <Button
            id="gds-btn-operators"
            variant="subtle"
            size="compact-lg"
            aria-controls={IDS.players}
            aria-expanded={ui.drawer === 'operators' ? 'true' : 'false'}
            onClick={() => intent('drawer', { name: 'operators' })}
          >
            PILOTS
          </Button>
          <Button
            id="gds-btn-arcade"
            variant="subtle"
            size="compact-lg"
            aria-controls={IDS.arcade}
            aria-expanded={ui.drawer === 'arcade' ? 'true' : 'false'}
            onClick={() => intent('drawer', { name: 'arcade' })}
          >
            ARCADE
          </Button>
          <Button id="gds-btn-dock-abandon" variant="subtle" size="compact-lg" onClick={() => intent('dock-abandon')}>
            ABANDON
          </Button>
          <Button id="gds-btn-report" variant="subtle" size="compact-lg" onClick={() => intent('report-open')}>
            REPORT
          </Button>
        </GdsInline>

        <SurfaceStrip surface={surface} intent={intent} />
      </GdsBox>

      <GdsInline gap="xs" align="center" wrap="nowrap" className="gds-status-cluster" role="region" aria-label="Game status and controls">
        <Button id={IDS.abandon} variant="subtle" size="compact-lg" onClick={() => intent('abandon')}>
          ABANDON
        </Button>
        <Button id={IDS.replay} variant="subtle" size="compact-lg" onClick={() => intent('replay-intro')}>
          INTRO
        </Button>
        <StatusBadge id={IDS.connection} status={connection === 'connected' ? 'success' : connection === 'offline' ? 'danger' : 'warning'} role="status" aria-live="polite">
          {connectionText(connection)}
        </StatusBadge>
        <Button
          id={IDS.sound}
          variant="subtle"
          size="compact-lg"
          aria-pressed={ui.soundMuted ? 'true' : 'false'}
          aria-label={ui.soundMuted ? 'SFX audio: unmute' : 'SFX audio: mute'}
          onClick={() => intent('sound')}
        >
          SFX
        </Button>
        <Button
          id={IDS.subtitles}
          variant="subtle"
          size="compact-lg"
          aria-pressed={voice.subtitles === false ? 'false' : 'true'}
          onClick={() => intent('cine-toggle-captions')}
        >
          CC
        </Button>
        <Button
          id={IDS.voice}
          variant="subtle"
          size="compact-lg"
          aria-pressed={voice.voice === false ? 'false' : 'true'}
          onClick={() => intent('cine-toggle-voice')}
        >
          VOX
        </Button>
        <Button id={IDS.help} variant="subtle" size="compact-lg" onClick={() => intent('help')}>
          GUIDE
        </Button>
      </GdsInline>

      <GdsBox
        id={IDS.captions}
        className="gds-captions"
        role="region"
        aria-live="polite"
        aria-label="Narration subtitles"
        hidden={!captions.visible}
      >
        <LabelText id="subtitle-speaker">{captions.speaker}</LabelText>
        <BodyText id="subtitle-text">{captions.text}</BodyText>
      </GdsBox>
    </>
  );
}
