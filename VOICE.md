# NARIMATO — Narration Voices

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) · [STR-01](https://github.com/moldovancsaba/narimato/issues/35) · [AUD-01](https://github.com/moldovancsaba/narimato/issues/37)
<!-- delivery-ssot:end -->

Narration is prerecorded and shipped locally; the game never calls a cloud TTS
service. Each cue is split into sentence clips, so subtitles and voice stay in
sync and narration can pause between sentences.

Assets are served versioned (`?v=3.6.0`) with immutable cache headers. The
narration engine prefetches the first sentence of every cue at idle with at most
three concurrent requests, then warms the next sentence while the current clip
plays. Bump `AUDIO_VERSION` in `public/js/narrator.js` whenever replacing clips.

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

## Generation

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
# e.g. public/audio/voice/george/intro-wormhole__s1.m4a
```

### macOS profiles (DANIEL / SAMANTHA)

The same generator uses `say` + `afconvert`; no extra Python needed:

```sh
node scripts/generate-voice.mjs
```

If Kokoro is not installed, set `KOKORO_PYTHON` or temporarily remove the
`george` entry from `VOICE_PROFILES` when regenerating the macOS voices.

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
