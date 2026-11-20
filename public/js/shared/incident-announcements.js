/**
 * NARIMATO — incident announcement builder (EVT-03).
 *
 * Pure, Node-importable wording for the four planetary catastrophes. The SSE
 * `incident` frame is the only input; nothing here touches the DOM, storage,
 * network or player identity. `ui.js` owns the DOM writes and `interlude.js`
 * owns motion, so voice/caption/announcement text stays in one deterministic,
 * unit-testable place.
 *
 * Contract (issue #34):
 *   id            stable dedupe key `kind:planetIndex:revision`
 *   politeness    always 'polite' (incidents never steal focus)
 *   visualLabel   the card headline, e.g. "SOLAR FLARE // MAGRATHEA"
 *   spoken        one full sentence for the single live region
 *   detail        first sentence of the description, clamped to 240 chars
 *   captionCueId  narration cue id (`event-incident-<kind>`) for captions
 *   dwellMs       1200 reduced motion / 2600 full motion
 *   captions      static caption units (narration sentence units)
 *
 * `spoken` never contains the visual `//` separator: screen readers read it as
 * "slash slash", which is not how the outcome should sound.
 */

import { NARRATION, narrationSegments } from '../narrative-data.js';

export const INCIDENT_KINDS = Object.freeze(['meteor', 'nuclear', 'solar', 'alien']);

export const INCIDENT_TITLES = Object.freeze({
  meteor: 'METEOR IMPACT',
  nuclear: 'NUCLEAR WAR',
  solar: 'SOLAR FLARE',
  alien: 'ALIEN INVASION',
});

/** Per-kind fallback when the frame omits `description`. */
export const FALLBACK_DETAIL = Object.freeze({
  meteor: 'A meteor shattered the old crust and exposed fresh ore veins.',
  nuclear: 'Atomic fire split the crust and exposed new materials.',
  solar: 'A solar flare peeled back rock and scattered rare elements.',
  alien: 'An alien fleet razed the surface and scattered new materials.',
});

/** Plain-language outcome shared by every kind. */
export const OUTCOME = 'The crust has reset, new ore is exposed, and mining is open again.';

export const MAX_DETAIL_CHARS = 240;
export const DWELL_FULL_MS = 2600;
export const DWELL_REDUCED_MS = 1200;

export const UNKNOWN_KIND_FALLBACK = 'meteor';

const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);

/** First sentence of a server description, trimmed and length-clamped. */
export function firstSentence(value) {
  const text = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  const match = /^.*?[.!?](?=\s|$)/.exec(text);
  const sentence = match ? match[0] : text;
  if (sentence.length <= MAX_DETAIL_CHARS) return sentence;
  const cut = sentence.slice(0, MAX_DETAIL_CHARS - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Split a sentence into the static caption units (no HTML, no live region). */
export function captionUnits(text) {
  return String(text == null ? '' : text)
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Captions reuse the shipped narration sentence units (`event-incident-<kind>`),
 * so what the screen reader reads, what the captions show and what the voice
 * speaks are the same sentences. Falls back to the detail sentence if a cue is
 * missing (for example during a partial asset deploy).
 */
export function cueCaptions(kind, detail = '') {
  const cue = NARRATION[`event-incident-${kind}`];
  const segments = cue ? narrationSegments(cue) : [];
  return segments.length ? [...segments] : [...captionUnits(detail), OUTCOME];
}

/** Dwell before the crust snapshot is reloaded: 1200 ms reduced motion, 2600 ms otherwise. */
export function incidentDwellMs({ reducedMotion = false } = {}) {
  return reducedMotion ? DWELL_REDUCED_MS : DWELL_FULL_MS;
}

/**
 * Build the announcement for one incident frame.
 *
 * @param {{kind?:string,title?:string,message?:string,description?:string,revision?:number}} event
 * @param {{name?:string,planetIndex?:number}} planet
 * @param {{reducedMotion?:boolean,revision?:number}} [options]
 */
export function buildIncidentAnnouncement(event, planet = {}, options = {}) {
  const frame = event && typeof event === 'object' ? event : {};
  const kind = INCIDENT_KINDS.includes(frame.kind) ? frame.kind : UNKNOWN_KIND_FALLBACK;
  const title = String(frame.title || INCIDENT_TITLES[kind] || INCIDENT_TITLES[UNKNOWN_KIND_FALLBACK]).trim();
  const planetName = String((planet && (planet.name || planet.planetName)) || 'this planet').trim() || 'this planet';
  const planetIndex = Number.isInteger(planet && planet.planetIndex) ? planet.planetIndex : 0;
  const revision = Number.isFinite(options.revision)
    ? Math.max(0, Math.trunc(options.revision))
    : Number.isFinite(frame.revision)
      ? Math.max(0, Math.trunc(frame.revision))
      : 0;
  const reducedMotion = options.reducedMotion === true;
  const detail = firstSentence(frame.description) || FALLBACK_DETAIL[kind];
  const visualLabel = `${title} // ${planetName}`;
  const spoken = `${title} on ${planetName}. ${detail} ${OUTCOME}`;
  return {
    id: `${kind}:${planetIndex}:${revision}`,
    kind,
    title,
    planetIndex,
    planetName,
    politeness: 'polite',
    visualLabel,
    spoken,
    detail,
    message: String(frame.message || '').trim(),
    captionCueId: `event-incident-${kind}`,
    captions: cueCaptions(kind, detail),
    outcome: OUTCOME,
    dwellMs: incidentDwellMs({ reducedMotion }),
  };
}

export default buildIncidentAnnouncement;
