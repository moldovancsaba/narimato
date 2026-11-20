/**
 * NARIMATO — GDS overlays (UI-03).
 *
 * Landing/tag-in, Quick Guide, Field Manual, Report/Share, destructive confirm
 * and toasts. Every modal is a shipped GDS dialog (`GdsModal`/`ConfirmDialog`)
 * with the provider's focus trap and restore; the island never hand-rolls a
 * focus trap. The report keeps the 1200×630 `#report-card-preview` canvas the
 * existing `result-card.js` renderer draws into.
 */
import {
  BodyText,
  Button,
  GdsBox,
  FormField,
  GdsInline,
  Modal,
  GdsStack,
  InlineAlert,
  LabelText,
  MetadataText,
  SectionPanel,
  StatusBadge,
} from '@sovereignsquad/gds/client';
import { IDS } from './intents.js';
import IncidentDialog from './IncidentDialog.jsx';
import { formatNumber, pad2 } from '../../../public/js/shared/hud-contract.js';
import { sanitizeShareUrl } from '../../../public/js/shared/share-text.js';
const GUIDE_STEPS = Object.freeze([
  { id: 'what', title: 'WHAT TO MINE', body: () => 'The THE WAY HOME panel lists every part the ship still needs. Rare parts are marked RARE.' },
  { id: 'how', title: 'HOW TO MINE', body: () => 'Click or tap a triangle to charge it. Four clicks break it into four smaller cells; deeper worlds ask for eight.' },
  { id: 'where', title: 'WHERE TO DIG', body: () => 'Ore is hidden and appears on a random click. Follow the gold NAV beacon to the best nearby ground; WHAT WE’RE CARRYING shows your spare ore.' },
  { id: 'leave', title: 'HOW TO LEAVE', body: () => 'When every system says LOADED, the central TRY TO FLY AWAY button opens. Take it and the next world is yours.' },
]);

const RESOURCE_MARKET = Object.freeze([
  { id: 'ice', name: 'ICE', glyph: 'H2O', value: 12 },
  { id: 'iron', name: 'IRON', glyph: 'Fe', value: 24 },
  { id: 'silver', name: 'SILVER', glyph: 'Ag', value: 90 },
  { id: 'gold', name: 'GOLD', glyph: 'Au', value: 160 },
  { id: 'uranium', name: 'URANIUM', glyph: 'U', value: 260 },
  { id: 'palladium', name: 'PALLADIUM', glyph: 'Pd', value: 420 },
  { id: 'voidglass', name: 'VOIDGLASS', glyph: 'Vg', value: 640 },
]);

const intent = (type, detail) => {
  if (type) window.dispatchEvent(new CustomEvent('narimato:gds-intent', { detail: { type, ...detail } }));
};

function WorldStat({ label, value, id }) {
  return (
    <GdsStack gap={0} className="gds-world-stat">
      <MetadataText>{label}</MetadataText>
      <LabelText id={id}>{value}</LabelText>
    </GdsStack>
  );
}

function MissionRows({ mission, hook }) {
  return (
    <GdsStack
      component="ul"
      gap="xs"
      padding={0}
      className="gds-list"
      data-mission={hook}
      id={hook === 'landing' ? 'landing-mission-list' : undefined}
    >
      {mission.objectives.length ? (
        mission.objectives.map((objective) => (
          <GdsBox component="li" key={objective.id} className="gds-mission-objective">
            <GdsInline justify="between" align="center">
              <LabelText>{objective.name}</LabelText>
              <StatusBadge status={objective.done ? 'success' : 'neutral'}>
                {objective.done ? 'LOADED' : 'FIND'}
              </StatusBadge>
            </GdsInline>
            <MetadataText>
              {objective.items.map((item) => `${item.name} ${item.have}/${item.need}`).join(' · ')}
            </MetadataText>
          </GdsBox>
        ))
      ) : (
        <GdsBox component="li">
          <MetadataText>AWAITING MISSION DATA…</MetadataText>
        </GdsBox>
      )}
    </GdsStack>
  );
}

function LandingDialog({ ui, open }) {
  const landing = ui.landing || {};
  const mission = ui.mission || { ready: false, objectives: [] };
  const arcade = ui.arcade || [];
  const world = ui.world || {};
  const error = landing.error || '';
  return (
    <Modal
      id="gds-landing"
      data-gds-surface="dialog"
      data-gds-component="landing"
      classNames={{ content: 'gds-dialog-content' }}
      opened={open}
      onClose={() => {}}
      title="NARIMATO // THE WAY BACK"
      fullScreen
      withCloseButton={false}
      closeOnEscape={false}
      closeOnClickOutside={false}
      returnFocus
      className="gds-landing-modal"
    >
      <GdsBox id={IDS.landing} className="gds-landing" data-gds-landing="true" data-gds-surface="dialog" data-gds-component="landing"
      classNames={{ content: 'gds-dialog-content' }}>
        <GdsInline gap="lg" align="start" wrap="wrap" className="gds-landing-grid">
          <GdsStack gap="md">
            <GdsBox>
              <MetadataText>PERSISTENT GEODESIC WORLD // ALWAYS LIVE</MetadataText>
              <LabelText className="gds-landing-title" id="join-title">
                NARIMATO
              </LabelText>
              <BodyText>THE WAY BACK // INFINITE GRID</BodyText>
            </GdsBox>

            <BodyText>
              You woke up on the wrong side of a wormhole. The ship is broken, the crust is full of ore. Mine it. Fix
              her. Find the way home.
            </BodyText>

            <GdsBox component="form" id={IDS.tagForm} className="gds-join-form" onSubmit={(event) => {
              event.preventDefault();
              intent('join', { tag: landing.value || '' });
            }}>
              <GdsStack gap="xs">
                <FormField label="Operator tag" description="2–12 CHARS · A–Z 0–9 _ -" error={error || undefined}>
                  <GdsInline gap="sm" align="end">
                    <input
                      id={IDS.tagInput}
                      name="tag"
                      className="gds-tag-input"
                      value={landing.value || ''}
                      onChange={(event) => intent('tag-change', { value: event.currentTarget.value })}
                      maxLength={12}
                      placeholder="ENTER TAG"
                      aria-label="Operator tag"
                      autoComplete="off"
                      aria-describedby="tag-rules join-error"
                      aria-invalid={error ? 'true' : 'false'}
                      autoFocus
                    />
                    <Button id={IDS.joinButton} type="submit" loading={landing.busy === true} aria-busy={landing.busy ? 'true' : 'false'}>
                      {landing.busy ? 'LINKING…' : 'JACK IN'}
                    </Button>
                  </GdsInline>
                </FormField>
                <GdsBox id={IDS.joinError} role="alert" aria-live="assertive">
                  {error ? <InlineAlert severity="error" title="Tag rejected" message={error} live={false} /> : null}
                </GdsBox>
              </GdsStack>
            </GdsBox>

            <GdsInline justify="between" align="center" gap="sm">
              <GdsInline gap="xs" align="center">
                <StatusBadge status={ui.connection === 'connected' ? 'success' : 'warning'} withIcon>
                  {`${pad2(landing.liveCount)} OPERATORS ONLINE`}
                </StatusBadge>
                <MetadataText id={IDS.liveCount} aria-live="polite">
                  {`${pad2(landing.liveCount)} OPERATOR${landing.liveCount === 1 ? '' : 'S'} ONLINE`}
                </MetadataText>
              </GdsInline>
              <Button id={IDS.newPilot} variant="subtle" onClick={() => intent('new-pilot')}>
                NEW PILOT
              </Button>
            </GdsInline>

            <GdsInline gap="sm" id="world-stats" aria-label="Persistent world statistics" className="gds-stat-grid">
              <WorldStat label="GRID FACES" value={formatNumber(world.faces)} id="world-faces" />
              <WorldStat label="MAX DEPTH" value={world.depthText || 'D0'} id="world-depth" />
              <WorldStat label="TOTAL CLICKS" value={formatNumber(world.totalClicks)} id="world-clicks" />
              <WorldStat label="BREAKS" value={formatNumber(world.totalBreaks)} id="world-breaks" />
            </GdsInline>
            <MetadataText id="world-rule">{world.rule || 'BREAK AT 08 CLICKS // CONTEST LOCK'}</MetadataText>

            <GdsBox className="gds-subpanel">
              <GdsInline justify="between" align="center">
                <LabelText>HOW WE GET HOME</LabelText>
                <StatusBadge status={mission.ready ? 'success' : 'info'} id="join-mission-status">
                  {mission.ready ? 'READY TO FLY' : `${mission.objectives.filter((objective) => objective.done).length} / ${Math.max(1, mission.objectives.length)} PARTS FOUND`}
                </StatusBadge>
              </GdsInline>
              <GdsBox id="landing-mission" role="region" aria-label="Escape mission briefing">
                <GdsBox data-mission="landing" id="landing-mission-list">
                  <MetadataText>
                    {mission.objectives.length
                      ? mission.objectives.map((objective) => `${objective.name} ${objective.done ? 'LOADED' : 'NEEDED'}`).join(' · ')
                      : 'AWAITING MISSION DATA…'}
                  </MetadataText>
                </GdsBox>
              </GdsBox>
              <MetadataText>MINE THE ORE · REBUILD THE DRIVE · BREAK ORBIT</MetadataText>
            </GdsBox>
          </GdsStack>

          <GdsStack gap="md">
            <SectionPanel eyebrow="ARCADE // HALL OF FAME" title="TOP 10" titleOrder={3}>
              <GdsStack component="ol" id="join-arcade" gap="xs" padding={0} className="gds-list">
                {arcade.length ? (
                  arcade.slice(0, 10).map((entry, index) => (
                    <GdsBox component="li" key={`${entry.tag}-${index}`}>
                      <GdsInline justify="between" align="center">
                        <LabelText>{`${pad2(index + 1)} ${entry.tag}`}</LabelText>
                        <MetadataText>{formatNumber(entry.score)}</MetadataText>
                      </GdsInline>
                    </GdsBox>
                  ))
                ) : (
                  <GdsBox component="li"><MetadataText>NO RECORDS // BE THE FIRST</MetadataText></GdsBox>
                )}
              </GdsStack>
            </SectionPanel>
          </GdsStack>
        </GdsInline>
      </GdsBox>
    </Modal>
  );
}

function GuideDialog({ ui, open }) {
  const guide = ui.guide || {};
  return (
    <Modal
      id="gds-guide"
      data-gds-surface="dialog"
      data-gds-component="guide"
      classNames={{ content: 'gds-dialog-content' }}
      opened={open}
      onClose={() => intent('guide-close')}
      title="HOW TO GET HOME"
      size="lg"
      closeOnEscape
      returnFocus
      closeButtonProps={{ 'aria-label': 'Close dialog' }}
    >
      <GdsBox id={IDS.guide} className="gds-overlay-card" data-gds-surface="dialog" data-gds-component="guide"
      classNames={{ content: 'gds-dialog-content' }}>
        <GdsStack component="ol" gap="md" padding={0} className="gds-list">
          {GUIDE_STEPS.map((step) => (
            <GdsBox component="li" key={step.id} className="gds-guide-step">
              <LabelText>{step.title}</LabelText>
              <BodyText id={step.id === 'how' ? IDS.guideHow : undefined}>{step.body({ breakClicks: guide.breakClicks, deeperClicks: guide.deeperClicks })}</BodyText>
            </GdsBox>
          ))}
        </GdsStack>
        <BodyText>
          Stuck for two minutes? A relief ship will crash onto the planet and scatter the missing ore on marked
          triangles.
        </BodyText>
        <GdsInline gap="sm" wrap="wrap">
          <Button id="btn-guide-start" onClick={() => intent('guide-start')}>
            START MINING
          </Button>
          <Button id="btn-guide-manual" variant="subtle" onClick={() => intent('guide-manual')}>
            OPEN FIELD MANUAL
          </Button>
          <Button id="btn-guide-share" variant="subtle" onClick={() => intent('guide-share')}>
            COPY GUIDE LINK
          </Button>
          <Button id="btn-guide-close" variant="subtle" onClick={() => intent('guide-close')}>
            CLOSE
          </Button>
        </GdsInline>
      </GdsBox>
    </Modal>
  );
}

function ManualDialog({ ui, open }) {
  const manual = ui.manual || { sections: [], voiceProfile: 'george' };
  return (
    <Modal
      id="gds-manual"
      data-gds-surface="dialog"
      data-gds-component="manual"
      classNames={{ content: 'gds-dialog-content' }}
      opened={open}
      onClose={() => intent('manual-close')}
      title="THE WAY BACK"
      size="xl"
      closeOnEscape
      returnFocus
      closeButtonProps={{ 'aria-label': 'Close dialog' }}
    >
      <GdsBox id={IDS.manual} className="gds-overlay-card" data-gds-surface="dialog" data-gds-component="manual"
      classNames={{ content: 'gds-dialog-content' }}>
        <BodyText>
          Story, mining rules, planets and controls. Press PLAY on any section to hear it. Voice and subtitles can be
          toggled independently.
        </BodyText>
        <GdsInline gap="sm" align="center" role="group" aria-label="Narrator voice">
          <MetadataText>NARRATOR</MetadataText>
          {[
            ['george', 'GEORGE', 'OPEN · UK'],
            ['daniel', 'DANIEL', 'UK'],
            ['samantha', 'SAMANTHA', 'US'],
          ].map(([id, name, meta]) => (
            <Button
              key={id}
              variant={manual.voiceProfile === id ? 'light' : 'subtle'}
              size="compact-lg"
              data-voice-profile={id}
              aria-pressed={manual.voiceProfile === id ? 'true' : 'false'}
              onClick={() => intent('manual-voice', { profile: id })}
            >
              {`${name} // ${meta}`}
            </Button>
          ))}
        </GdsInline>
        <GdsStack id={IDS.manualSections} gap="md" padding={0} className="gds-list">
          {manual.sections.map((section) => (
            <GdsBox key={section.id} className="gds-manual-section">
              <GdsInline justify="between" align="center">
                <LabelText>{section.title}</LabelText>
                <Button
                  variant="subtle"
                  size="compact-lg"
                  className="manual-play"
                  data-voice={section.voiceId}
                  aria-label={`Play narration: ${section.title}`}
                  onClick={() => intent('manual-play', { voice: section.voiceId })}
                >
                  ▶ PLAY
                </Button>
              </GdsInline>
              {section.body.map((paragraph, index) => (
                <BodyText key={index}>{paragraph}</BodyText>
              ))}
            </GdsBox>
          ))}
        </GdsStack>
        <GdsInline justify="between" align="center">
          <MetadataText>VOICE + SUBTITLES REMEMBER YOUR CHOICE</MetadataText>
          <Button id="btn-manual-close" onClick={() => intent('manual-close')}>
            CLOSE
          </Button>
        </GdsInline>
      </GdsBox>
    </Modal>
  );
}

function ReportStats({ result }) {
  return (
    <GdsBox id="report-stats" aria-label="Session statistics">
      <MetadataText>
        {`CLICKS ${formatNumber(result.clicks)} · BREAKS ${formatNumber(result.breaks)} · CLAIMS ${formatNumber(result.claims)} · STEALS ${formatNumber(result.steals)} · FACES HELD ${formatNumber(result.facesHeld)} · DEPTH D${formatNumber(result.depth)} · ORES ${formatNumber(result.ores)} · VALUE ${formatNumber(result.oreValue)} CR`}
      </MetadataText>
    </GdsBox>
  );
}

function ReportDialog({ ui }) {
  const report = ui.report || { open: false };
  const result = report.result || {};
  const shareUrl = sanitizeShareUrl(report.shareUrl || '', { origin: typeof location === 'undefined' ? null : location.origin });
  const arcade = ui.arcade || [];
  return (
    <Modal
      id="gds-report"
      data-gds-surface="dialog"
      data-gds-component="report"
      classNames={{ content: 'gds-dialog-content' }}
      opened={report.open === true}
      onClose={() => intent('report-close')}
      title={report.title || 'SESSION REPORT'}
      size="xl"
      closeOnEscape
      returnFocus
      closeButtonProps={{ 'aria-label': 'Close dialog' }}
    >
      <GdsBox id={IDS.report} className="gds-report" data-gds-surface="dialog" data-gds-component="report"
      classNames={{ content: 'gds-dialog-content' }}>
        <GdsInline justify="between" align="center" wrap="wrap" gap="sm">
          <GdsStack gap={0}>
            <MetadataText>OPERATOR</MetadataText>
            <LabelText id="report-tag">{result.tag || 'PLAYER'}</LabelText>
          </GdsStack>
          <GdsInline gap="lg" align="center">
            <GdsStack gap={0}>
              <MetadataText>RANK</MetadataText>
              <LabelText id="report-rank">{`#${formatNumber(result.rank || 1)} / ${formatNumber(result.totalPlayers || 1)}`}</LabelText>
            </GdsStack>
            <GdsStack gap={0}>
              <MetadataText>TOTAL SCORE</MetadataText>
              <LabelText id="report-score">{formatNumber(result.score)}</LabelText>
            </GdsStack>
            <GdsStack gap={0}>
              <MetadataText>THIS SESSION</MetadataText>
              <LabelText id="report-session">{`+${formatNumber(result.sessionScore)}`}</LabelText>
            </GdsStack>
          </GdsInline>
        </GdsInline>

        <ReportStats result={result} />

        {result.bestFind ? (
          <GdsInline id="report-best-find" gap="sm" align="center">
            <MetadataText>RICHEST FIND</MetadataText>
            <LabelText>{result.bestFind.name}</LabelText>
            <LabelText>{`+${formatNumber(result.bestFind.value)} CR`}</LabelText>
          </GdsInline>
        ) : null}

        <GdsBox display="grid" gap="md" className="gds-report-grid">
          <GdsBox>
            <LabelText>LEGENDS OF THE GRID</LabelText>
            <GdsStack component="ol" id="report-arcade" gap="xs" padding={0} className="gds-list">
              {arcade.length ? (
                arcade.slice(0, 10).map((entry, index) => (
                  <GdsBox component="li" key={`${entry.tag}-${index}`}>
                    <GdsInline justify="between" align="center">
                      <LabelText>{`${pad2(index + 1)} ${entry.tag}`}</LabelText>
                      <MetadataText>{formatNumber(entry.score)}</MetadataText>
                    </GdsInline>
                  </GdsBox>
                ))
              ) : (
                <GdsBox component="li"><MetadataText>NO RECORDS // BE THE FIRST</MetadataText></GdsBox>
              )}
            </GdsStack>
          </GdsBox>
          <SectionPanel eyebrow="SESSION CARD" title="1200 × 630 PNG" titleOrder={3}>
            <canvas
              id={IDS.reportCard}
              className="gds-report-canvas"
              width={1200}
              height={630}
              aria-label="Shareable session card preview"
            />
            <GdsInline gap="xs" align="center">
              <MetadataText>LINK</MetadataText>
              {shareUrl ? (
                <a id={IDS.reportShare} href={shareUrl} target="_blank" rel="noopener noreferrer">
                  {shareUrl}
                </a>
              ) : (
                <MetadataText id={IDS.reportShare} aria-disabled="true">
                  LINK UNAVAILABLE
                </MetadataText>
              )}
            </GdsInline>
          </SectionPanel>
        </GdsBox>

        <GdsInline gap="sm" wrap="wrap">
          <Button id="btn-report-close" onClick={() => intent('report-close')}>
            BACK TO GRID
          </Button>
          <Button id="btn-report-download" variant="subtle" onClick={() => intent('report-download')}>
            DOWNLOAD PNG
          </Button>
          <Button id="btn-report-share" variant="subtle" onClick={() => intent('report-share')}>
            SHARE
          </Button>
        </GdsInline>
      </GdsBox>
    </Modal>
  );
}

function ConfirmOverlay({ ui }) {
  const confirm = ui.confirm || { open: false };
  return (
    <Modal
      id="gds-confirm"
      data-gds-surface="dialog"
      data-gds-component="confirm"
      classNames={{ content: 'gds-dialog-content' }}
      opened={confirm.open === true}
      onClose={() => intent('confirm', { value: false })}
      title={confirm.title || 'CONFIRM ACTION'}
      centered
      closeOnEscape
      returnFocus
      closeButtonProps={{ 'aria-label': 'Close dialog' }}
    >
      <GdsBox id={IDS.confirm} data-gds-surface="dialog" data-gds-component="confirm"
      classNames={{ content: 'gds-dialog-content' }}>
        <BodyText id="confirm-message">{confirm.message || ''}</BodyText>
        <MetadataText>
          Escape, the close control or the safe action resolves false. The explicit destructive control is the only
          true path.
        </MetadataText>
        <GdsInline gap="sm" justify="flex-end" wrap="wrap">
          <Button id="btn-confirm-cancel" variant="subtle" onClick={() => intent('confirm', { value: false })}>
            {confirm.cancelLabel || 'KEEP PLAYING'}
          </Button>
          <Button id="btn-confirm-ok" onClick={() => intent('confirm', { value: true })}>
            {confirm.okLabel || 'CONFIRM'}
          </Button>
        </GdsInline>
      </GdsBox>
    </Modal>
  );
}

function ToastRegion({ toasts }) {
  return (
    <GdsBox id={IDS.toasts} className="gds-toasts" aria-live="polite" aria-atomic="false" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <GdsBox key={toast.id} className="gds-toast" data-kind={toast.kind}>
          <InlineAlert
            severity={toast.kind === 'bad' ? 'error' : toast.kind === 'warn' ? 'warning' : toast.kind === 'good' ? 'success' : 'info'}
            title={toast.kind === 'bad' ? 'Action failed' : toast.kind === 'warn' ? 'Heads up' : 'NARIMATO'}
            message={toast.text}
            live={toast.kind === 'bad'}
            action={
              <Button
                variant="subtle"
                size="compact-lg"
                aria-label="Dismiss notification"
                onClick={() => intent('toast-dismiss', { id: toast.id })}
              >
                ✕
              </Button>
            }
          />
        </GdsBox>
      ))}
    </GdsBox>
  );
}

export default function OverlaySurface({ ui, cineActive, incident }) {
  const landing = ui.landing || { open: false };
  const guide = ui.guide || { open: false };
  const manual = ui.manual || { open: false };
  const report = ui.report || { open: false };
  const confirm = ui.confirm || { open: false };
  return (
    <>
      <LandingDialog ui={ui} open={landing.open === true && !cineActive} />
      <GuideDialog ui={ui} open={guide.open === true} />
      <ManualDialog ui={ui} open={manual.open === true} />
      <ReportDialog ui={ui} />
      <ConfirmOverlay ui={ui} />
      <IncidentDialog incident={incident} />
      <ToastRegion toasts={ui.toasts || []} />
    </>
  );
}
