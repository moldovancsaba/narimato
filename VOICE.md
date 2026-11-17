# NARIMATO — Narration Voices

Narration is prerecorded and shipped locally; the game never calls a cloud TTS
service. Each cue is split into sentence clips, so subtitles and voice stay in
sync and narration can pause between sentences.

## Included profiles

| Profile | Voice | Accent | Notes |
|---|---|---|---|
| `daniel` (default) | Daniel | UK English | British male narrator |
| `samantha` | Samantha | US English | US female narrator |

Switch profiles in **Field Manual → NARRATOR**. The choice is persisted in
`localStorage` (`icosa.voiceProfile`). Both profiles are rendered from
`public/js/narrative-data.js` by `scripts/generate-voice.mjs`.

The current clips are generated with macOS `say` + `afconvert`:

```sh
node scripts/generate-voice.mjs
```

Output layout:

```
public/audio/voice/<profile>/<cue>__s<n>.m4a
```

## Open-source voice generators

If you want to replace/augment the macOS voices with open-source TTS:

- **[Kokoro-82M](https://github.com/hexgrad/kokoro)** — Apache 2.0 weights,
  82M parameters, 54 voices, CPU-friendly. Best quality-per-size for English
  narration and the easiest open-source upgrade. `pip install kokoro soundfile`.
- **[Piper](https://github.com/rhasspy/piper)** — very fast offline neural TTS;
  the maintained `piper1-gpl` engine is GPL-3.0 and each voice model carries its
  own license (check the individual voice card). Good for low-CPU/offline builds.
- **Coqui XTTS v2 / F5-TTS / Bark** — expressive, but check licenses: XTTS v2
  weights are non-commercial, and voice cloning has separate consent concerns.

For a new engine, keep the sentence file naming contract and call it once per
sentence in `scripts/generate-voice.mjs`:

```
public/audio/voice/<profile>/<cue>__s<n>.m4a   # e.g. daniel/intro-wormhole__s1.m4a
```

Do not commit a cloned celebrity/third-party voice without permission; the
two included profiles are generic system voices.
