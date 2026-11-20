/**
 * NARIMATO — narration script.
 *
 * Cue text is the single source for both the generated audio clips and the
 * captions. Audio is generated from this file by `node scripts/generate-voice.mjs`
 * into public/audio/voice/<profile>/<cue>__s<n>.m4a. PLAYER-FACING PROSE lives in
 * `story-copy.js`; narration lines live here. Voice and subtitles are
 * independent toggles.
 */

// Field Manual sections are player-facing prose and live in the copy contract.
export { HELP_SECTIONS } from './story-copy.js';

/** Split narration text into display/audio sentences (one idea at a time). */
export function splitNarrationSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The sentence units for a cue: story lines where available, otherwise split text. */
export function narrationSegments(cue) {
  if (!cue) return [];
  if (Array.isArray(cue.lines) && cue.lines.length) return cue.lines.map((line) => String(line).trim()).filter(Boolean);
  return splitNarrationSentences(cue.text);
}

/** Selectable narrator voice packs (rendered into public/audio/voice/<id>/). */
export const VOICE_PROFILES = Object.freeze([
  {
    id: 'george',
    label: 'GEORGE',
    region: 'UK',
    engine: 'kokoro',
    voice: 'bm_george',
    lang: 'b',
    license: 'Apache-2.0 (Kokoro-82M model weights)',
    attribution: 'Kokoro-82M by hexgrad, voice bm_george — https://huggingface.co/hexgrad/Kokoro-82M',
  },
  {
    id: 'daniel',
    label: 'DANIEL',
    region: 'UK',
    engine: 'say',
    voice: 'Daniel',
    rate: 150,
    license: 'macOS system voice (Apple licence)',
    attribution: 'Apple macOS `say` voice Daniel',
  },
  {
    id: 'samantha',
    label: 'SAMANTHA',
    region: 'US',
    engine: 'say',
    voice: 'Samantha',
    rate: 152,
    license: 'macOS system voice (Apple licence)',
    attribution: 'Apple macOS `say` voice Samantha',
  },
]);

export const NARRATION = Object.freeze({
  'intro-wormhole': {
    text: 'Wormhole exit. Unknown system. Hull stress critical.',
  },
  'intro-drift': {
    text: 'Gravity lock. Thrusters offline. You can steer, but the planet is pulling you down.',
  },
  'intro-descent': {
    text: 'Cockpit frame failing. Brace for surface contact.',
  },
  'intro-arrival': {
    text: 'Fuel empty. Mine the ore, rebuild the warp core, and find the way back.',
  },
  'tip-mining': {
    text: 'Click a triangle to charge it. On the first world four clicks break it into four smaller cells; deeper worlds ask for eight.',
  },
  'tip-lock': {
    text: 'Green means you can mine. Red means you already mined it. Another operator must contest it before you can charge again.',
  },
  'tip-ore': {
    text: 'Ore is found on a random click. Keep charging. The vein can show up at any time before the break.',
  },
  'tip-nav': {
    text: 'The gold NAV beacon marks the best ground nearby. Tap the NAV chip to fly there.',
  },
  'tip-escape': {
    text: 'Your refit is complete. The central TRY TO FLY AWAY button will take you to the next planet.',
  },
  'tip-newplanet': {
    text: 'New planet, deeper crust. Read the briefing. These are the ores you need to leave.',
  },
  'tip-meteor': {
    text: 'The crust is exhausted. Meteor impact. New deposits are forming.',
  },
  'tip-incident': {
    text: 'The planet is exhausted. Catastrophe is reshaping the crust. New deposits are forming. Move to safer ground.',
  },
  'tip-carried': {
    text: 'Your ore travels with you. Everything you carry can be used for the next refit.',
  },
  'help-story': {
    text: 'You are a pilot thrown through a wormhole to the far side of the universe. Your ship is trapped above a rogue geodesic planet. Mine the crust, rebuild the drive, escape, and follow the worlds toward home.',
  },
  'help-mining': {
    text: 'Click a triangle to claim or charge it. When the charge reaches the threshold, it breaks into four smaller cells. Ore veins are hidden, and a vein is found on a random click. Green triangles can be mined; red triangles are locked to you; another operator must contest them.',
  },
  'help-lock': {
    text: 'You cannot re-click your own cell until another player or robot contests it. This prevents solo speed-runs. Robots are always staffed to keep each planet busy.',
  },
  'help-planets': {
    text: 'Planet one has two levels, twenty plus eighty cells. Planet two has three levels, and every escape takes you deeper. Carried ore travels with you and counts toward the next refit. When a planet is fully mined, a meteor reseeds it.',
  },
  'help-navigation': {
    text: 'The gold NAV chip picks a strong nearby cell, based on biome and ore chance. Tap the chip to fly the camera there, or tap the arrow to cycle targets. Drag and release to glide around the planet; scroll or pinch to zoom.',
  },
  'help-controls': {
    text: 'Click or tap a triangle to mine. Mouse drag rotates the planet; arrow keys travel around it smoothly, and Shift makes the travel faster. I reverses the mouse drag. Scroll or pinch to zoom between levels. Double-click to focus. Your ore travels with you.',
  },
  'story-space-storm': {
    text: 'Space storm. The drive lights and the planet falls away. Ion clouds tear at the hull, every warning light speaks at once. You ride the storm out, battered but alive.',
    lines: [
      'The drive lights and the planet falls away.',
      'Ion clouds tear at the hull; every warning light speaks at once.',
      'You ride the storm out — battered, but alive.',
    ],
  },
  'story-gravity-slingshot': {
    text: 'Gravity slingshot. No fuel to spare, so you aim for the giant. It whips you around and flings you deeper into the dark. Somewhere ahead, a new geodesic world waits.',
    lines: [
      'No fuel to spare, so you aim for the giant instead.',
      'The planet whips you around and flings you deeper into the dark.',
      'Somewhere ahead, a new geodesic world waits.',
    ],
  },
  'story-pirate-ambush': {
    text: 'Pirate ambush. Raiders drop out of the shadow of the moon. You burn hard, scatter their volley, and lose them in the debris belt. The next planet swallows your trail.',
    lines: [
      'Raiders drop out of the shadow of the moon.',
      'You burn hard, scatter their volley, and lose them in the debris belt.',
      'The next planet swallows your trail.',
    ],
  },
  'story-wormhole-tremor': {
    text: 'Wormhole tremor. The warp core shudders and reality folds inward. For eleven seconds the stars are on the wrong side of the canopy. You emerge with new coordinates burned into the nav board.',
    lines: [
      'The warp core shudders and reality folds inward.',
      'For eleven seconds the stars are on the wrong side of the canopy.',
      'You emerge with new coordinates burned into the nav board.',
    ],
  },
  'story-derelict-beacon': {
    text: 'Derelict beacon. A dead ship hails you in a language nobody has spoken for a century. You copy its charts and leave a marker for the next pilot. Ahead, another frontier world waits.',
    lines: [
      'A dead ship hails you in a language nobody has spoken for a century.',
      'You copy its charts and leave a marker for the next pilot.',
      'Ahead: another frontier world, still unclaimed.',
    ],
  },
  'story-magnetic-riptide': {
    text: 'Magnetic riptide. The escape vector cuts through the magnetic tail. Plasma sheets shimmer across the cockpit glass. You surf the current out of the gravity well.',
    lines: [
      'The escape vector cuts straight through the planet\'s magnetic tail.',
      'Plasma sheets shimmer across the cockpit glass.',
      'You surf the current out of the gravity well.',
    ],
  },
  'story-comet-drift': {
    text: 'Comet drift. A comet crosses your burn path, shedding ice and dust. You skim its tail for extra ions, then let it fall behind. The next world glints in the distance.',
    lines: [
      'A comet crosses your burn path, shedding ice and dust.',
      'You skim its tail for extra ions, then let it fall behind.',
      'The next world glints in the distance.',
    ],
  },
  'story-reactor-surge': {
    text: 'Reactor surge. The rebuilt drive surges past its rated limit. You cut the feed at the last second. Nine atmospheres of silence, and then a new planet below.',
    lines: [
      'The rebuilt drive surges past its rated limit.',
      'You cut the feed at the last second; the hull rings like a bell.',
      'Nine atmospheres of silence, and then a new planet below.',
    ],
  },
  'story-quiet-drift': {
    text: 'Quiet drift. Nothing follows you out of the gravity well. No sirens, no alarms. Just the low hum of the drive and a sky full of ore-bright worlds. You pick one and start the descent.',
    lines: [
      'Nothing follows you out of the gravity well. No sirens, no alarms.',
      'Just the low hum of the drive and a sky full of ore-bright worlds.',
      'You pick one and start the descent.',
    ],
  },

  // ---- STR-01: relief, per-kind incidents, Quick Guide and Captain's Log ----
  'event-relief': {
    text: 'Distress beacon answered. A relief ship is coming down hard. The missing ore is scattered across the marked triangles. It is a race; every pilot on this world can see the salvage rings.',
    lines: [
      'Distress beacon answered. A relief ship is coming down hard.',
      'The missing ore is scattered across the marked triangles.',
      'It is a race; every pilot on this world can see the salvage rings.',
    ],
  },
  'event-incident-meteor': {
    text: 'Meteor impact. A rogue rock punched straight through the old crust. The crater is open, and fresh ore veins are exposed. Get down there and salvage what the rock is hiding.',
    lines: [
      'Meteor impact. A rogue rock punched straight through the old crust.',
      'The crater is open, and fresh ore veins are exposed.',
      'Get down there and salvage what the rock is hiding.',
    ],
  },
  'event-incident-nuclear': {
    text: 'Nuclear war. Atomic fire swept the planet from horizon to horizon. The blast waves split the crust and exposed new materials. Everything old is ash; the survivors are already picking through the rubble.',
    lines: [
      'Nuclear war. Atomic fire swept the planet from horizon to horizon.',
      'The blast waves split the crust and exposed new materials.',
      'Everything old is ash; the survivors are already picking through the rubble.',
    ],
  },
  'event-incident-solar': {
    text: 'Solar flare. The local star lashed out and cooked the daylight side. The magnetic storm peeled back rock and scattered rare elements. The surface is hot, but the ore is close.',
    lines: [
      'Solar flare. The local star lashed out and cooked the daylight side.',
      'The magnetic storm peeled back rock and scattered rare elements.',
      'The surface is hot, but the ore is close.',
    ],
  },
  'event-incident-alien': {
    text: 'Alien invasion. A fleet razed the planet from orbit. Their beams demolished the old surface and scattered new materials. Whatever they were looking for, they left plenty behind for us.',
    lines: [
      'Alien invasion. A fleet razed the planet from orbit.',
      'Their beams demolished the old surface and scattered new materials.',
      'Whatever they were looking for, they left plenty behind for us.',
    ],
  },
  'guide-what': {
    text: 'The way home panel lists every part the ship still needs. Fuel rods, hull plates and warp core each show what is still missing. Rare parts are marked rare.',
    lines: [
      'The way home panel lists every part the ship still needs.',
      'Fuel rods, hull plates and warp core each show what is still missing.',
      'Rare parts are marked rare.',
    ],
  },
  'guide-how': {
    text: 'Click or tap a triangle to charge it. At this planet threshold it breaks into four smaller cells. Keep going deeper to find richer ground.',
    lines: [
      'Click or tap a triangle to charge it.',
      'At this planet threshold it breaks into four smaller cells.',
      'Keep going deeper to find richer ground.',
    ],
  },
  'guide-where': {
    text: 'Ore is hidden, and it can appear on a random click. Follow the gold nav beacon to the best nearby ground. Double click a cell to focus, and use the wheel or pinch to zoom.',
    lines: [
      'Ore is hidden, and it can appear on a random click.',
      'Follow the gold nav beacon to the best nearby ground.',
      'Double click a cell to focus, and use the wheel or pinch to zoom.',
    ],
  },
  'guide-leave': {
    text: 'Fill every system until the panel says loaded. The central try to fly away button opens. Take it to reach the next planet.',
    lines: [
      'Fill every system until the panel says loaded.',
      'The central try to fly away button opens.',
      'Take it to reach the next planet.',
    ],
  },
  'log-grounded': {
    text: 'We are grounded. The drive still needs parts from the crust. The relief ship will find us if the refit stalls.',
    lines: [
      'We are grounded. The drive still needs parts from the crust.',
      'The relief ship will find us if the refit stalls.',
    ],
  },
  'log-almost': {
    text: 'The drive is almost there; check the ship, then take us home.',
  },
  'log-ready': {
    text: 'The drive is breathing again; we can leave whenever you are ready.',
  },
});

export const TIP_IDS = Object.freeze([
  'tip-mining', 'tip-lock', 'tip-ore', 'tip-nav', 'tip-escape',
  'tip-newplanet', 'tip-meteor', 'tip-carried',
]);
