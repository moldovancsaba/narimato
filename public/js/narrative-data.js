/**
 * NARIMATO — narration script.
 *
 * Audio is generated from this file by `node scripts/generate-voice.mjs`
 * (macOS `say` + `afconvert`) into public/audio/voice/<id>.m4a. Subtitles use
 * the same strings. Voice and subtitles are independent toggles.
 */

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
    text: 'Click a triangle to charge it. On this planet, four clicks break it into four smaller cells.',
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
    text: 'Click or tap a triangle to mine. Drag to rotate and release to glide. Scroll or pinch to zoom. Double-click to focus. L toggles cell ids. The gear toggles voice and subtitles. Your ore is always carried to the next planet.',
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
});

export const HELP_SECTIONS = Object.freeze([
  {
    id: 'story',
    voiceId: 'help-story',
    title: 'THE WAY BACK',
    body: [
      'You are a pilot thrown through a wormhole to the far side of the universe. Your ship is trapped above a rogue geodesic planet with empty tanks.',
      'Mine the crust, rebuild the drive, escape, and follow the worlds toward home. Every planet is deeper, stranger and more contested.',
    ],
  },
  {
    id: 'mining',
    voiceId: 'help-mining',
    title: 'MINING & CHARGE',
    body: [
      'Click or tap a triangle to claim or charge it. At the planet threshold it breaks into four smaller spherical cells.',
      'Ore is hidden and is found on a random successful click — first, middle or the breaking click. Green cells can be mined; red cells are locked to you.',
    ],
  },
  {
    id: 'lock',
    voiceId: 'help-lock',
    title: 'CONTEST LOCK & ROBOTS',
    body: [
      'You cannot re-click your own cell until another player or robot contests it. Red means you are locked out; it clears when someone else clicks.',
      'Every planet is staffed to keep at least three players: one human gets two robots, two humans get one, three or more play bot-free.',
    ],
  },
  {
    id: 'planets',
    voiceId: 'help-planets',
    title: 'PLANETS & ESCAPE',
    body: [
      'Planet 1 is 2 levels (20 + 80 cells), planet 2 is 3 levels (20 + 80 + 320), and deeper planets follow.',
      'Complete the refit to unlock ESCAPE. Your ore inventory travels with you and counts toward the next planet. Fully mined planets are reseeded by a meteor.',
    ],
  },
  {
    id: 'navigation',
    voiceId: 'help-navigation',
    title: 'NAVIGATION & CAMERA',
    body: [
      'The gold NAV beacon and chip point to a strong nearby cell by biome and ore chance. Tap the chip to fly there, or the arrow to cycle.',
      'Drag and release to let the planet glide. Scroll or pinch to zoom smoothly. Double-click a cell to focus it.',
    ],
  },
  {
    id: 'controls',
    voiceId: 'help-controls',
    title: 'CONTROLS & AUDIO',
    body: [
      'Click: mine. Drag: rotate (release to glide). Wheel/pinch: zoom. Double-click: focus. L: cell ids.',
      'CC toggles subtitles. The voice button toggles narration. Both remember your choice and are independent, like a streaming player.',
    ],
  },
]);

export const TIP_IDS = Object.freeze([
  'tip-mining', 'tip-lock', 'tip-ore', 'tip-nav', 'tip-escape',
  'tip-newplanet', 'tip-meteor', 'tip-carried',
]);
