# NARIMATO — Narration Voices

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) · [STR-01](https://github.com/moldovancsaba/narimato/issues/35) · [STR-02](https://github.com/moldovancsaba/narimato/issues/36) · [AUD-01](https://github.com/moldovancsaba/narimato/issues/37)
<!-- delivery-ssot:end -->

Narration is prerecorded and shipped locally; the game never calls a cloud TTS
service. Each cue is split into sentence clips, so subtitles and voice stay in
sync and narration can pause between sentences.

Assets are served versioned (`?v=3.57.0+56190bd8`) with immutable cache headers.
The narration engine prefetches the first sentence of every cue at idle with at most
three concurrent requests, then warms the next sentence while the current clip
plays. The cache key is generated from the spoken content; never hand-edit it.

## Included profiles

| Profile | Voice | Accent | Engine | License |
|---|---|---|---|---|
| `george` (default) | George | UK English | **Kokoro-82M** | Apache 2.0 model weights |
| `daniel` | Daniel | UK English | macOS `say` | system voice |
| `samantha` | Samantha | US English | macOS `say` | system voice |

Switch profiles in **Field Manual → NARRATOR**. The choice is persisted in
`localStorage` (`icosa.voiceProfile`). All profiles are rendered from
`public/js/narrative-data.js` by `scripts/generate-voice.mjs`, using the same
sentence file naming.

**GEORGE is generated with the open-source [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)
model (Apache 2.0), voice `bm_george`.** Thanks to hexgrad and the Kokoro
contributors. Kokoro's training data is permissively licensed; see the model
card for its full attribution list.

## Cue catalogue

`public/js/narrative-data.js` is the narration script. Player-facing prose is
owned by `public/js/story-copy.js` (the copy SSOT); the Quick Guide, incident and
Captain's Log cue ids are referenced from that module so copy and narration can
never drift apart. Cue ids are lower kebab-case and immutable once shipped; a
rename is a new cue.

| Group | Cues | Sentence units |
|---|---|---|
| Cockpit intro | `intro-wormhole`, `intro-drift`, `intro-descent`, `intro-arrival` | 10 |
| Context tips | `tip-mining`, `tip-lock`, `tip-ore`, `tip-nav`, `tip-escape`, `tip-newplanet`, `tip-meteor`, `tip-incident`, `tip-carried` | 24 |
| Field Manual | `help-story`, `help-mining`, `help-lock`, `help-planets`, `help-navigation`, `help-controls` | 23 |
| Interplanetary stories | nine `story-*` cues (storm, slingshot, pirates, wormhole, beacon, riptide, comet, reactor, quiet drift) | 27 |
| **Emergency relief** | `event-relief` | 3 |
| **Catastrophes** | `event-incident-meteor`, `event-incident-nuclear`, `event-incident-solar`, `event-incident-alien` | 12 |
| **Quick Guide** | `guide-what`, `guide-how`, `guide-where`, `guide-leave` | 12 |
| **Captain's Log** | `log-grounded`, `log-almost`, `log-ready` | 4 |
| **Total** | **40 cues** | **115 sentence units** |

Each of the three profiles ships every sentence unit: **345 committed clips**,
about 10.8 MB total (`public/audio/voice/<profile>/<cue>__s<n>.m4a`).

## Asset manifest

`public/audio/voice/manifest.json` is generated with the audio tree. It is the
machine-readable contract used by `npm run voice:verify` and the test suite:

```ts
type VoiceManifest = {
  version: string;            // `${packageVersion}+${contentHash8}`
  profiles: Array<{ id: string; engine: 'kokoro' | 'say'; voice: string;
                    license: string; attribution: string }>;
  clips: Array<{ cueId: string; segment: number; profile: string; file: string; bytes: number;
                 sha256: string; durationMs: number; textSha: string }>;
  totals: { cues: number; segments: number; clips: number };
};
```

- `file` is repository-relative (`public/audio/voice/<profile>/<cue>__s<n>.m4a`).
- `sha256` hashes the encoded bytes; `textSha` hashes the spoken sentence.
- `durationMs` comes from the encoded file; browsers may report slightly
  different metadata.
- A profile without a licence and attribution string fails generation.
- The manifest carries no player data, tokens or tags.

## Version derivation

`public/js/audio-version.js` is a generated module:

```js
export const AUDIO_VERSION = '3.57.0+56190bd8';
```

`<package version>` is `package.json.version`; `<content hash8>` is the first
eight hex characters of the SHA256 over every
`profile|cueId|segment|textSha` line (sorted). Consequences:

- Re-running generation with unchanged sentences produces the same version.
- Editing one sentence changes its `textSha`, so the version and every audio URL
  change and players never hold a stale immutable clip.
- `public/js/narrator.js` imports `AUDIO_VERSION`; no hardcoded version remains.

## Generation

Generation is a maintainer action, never a build step. It renders the whole
matrix into a temporary tree and swaps it into place only after every clip
encodes and validates; a failure (missing clip, zero bytes, clip shorter than
120 ms) leaves the previous tree untouched.

### Kokoro (GEORGE)

```sh
python3 -m venv /tmp/kokoro-tts
/tmp/kokoro-tts/bin/pip install kokoro soundfile
KOKORO_PYTHON=/tmp/kokoro-tts/bin/python node scripts/generate-voice.mjs
```

`scripts/kokoro-synth.py` renders all sentence WAVs in one process; the Node
generator encodes them to the browser contract:

```
public/audio/voice/<profile>/<cue>__s<n>.m4a
# e.g. public/audio/voice/george/event-relief__s1.m4a
```

### macOS profiles (DANIEL / SAMANTHA)

The same generator uses `say` + `afconvert`; no extra Python needed:

```sh
node scripts/generate-voice.mjs
```

The generator also rewrites the documented cache-bust examples in this file and
[EDGE_DEPLOYMENT.md](EDGE_DEPLOYMENT.md) so documentation cannot drift from the
assets. `NARIMATO_SKIP_KOKORO=1` is intentionally refused: skipping the neural
profile would ship a partial tree.

## Verification

```sh
npm run voice:verify      # counts, hashes, durations, version, no missing clip
npm test                  # includes test/narration-manifest.test.js
```

`voice:verify` prints the matrix and exits non-zero when the manifest, the
version module, `narrative-data.js` or the committed files disagree. It needs no
TTS and no macOS tools, so it runs in CI.

## Other open-source voice generators

- **[Kokoro-82M](https://github.com/hexgrad/kokoro)** — already used here.
  Apache 2.0, 82M parameters, 54 voices, CPU-friendly; best quality-per-size for
  English narration.
- **[Piper](https://github.com/rhasspy/piper)** — extremely fast offline neural
  TTS. The maintained `piper1-gpl` engine is GPL-3.0 and each voice model has its
  own dataset license; check the voice card before shipping generated audio.
- **Coqui XTTS v2 / F5-TTS / Bark** — expressive, but license caveats: XTTS v2
  weights are non-commercial, and voice cloning has separate consent concerns.

Do not clone a celebrity or third-party voice without permission. The included
voices are generic synthesized narrators.
