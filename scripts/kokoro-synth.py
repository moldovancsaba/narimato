#!/usr/bin/env python3
"""Render a JSON sentence manifest with Kokoro-82M to WAV files.

Invoked by scripts/generate-voice.mjs for the open-source GEORGE profile.
Requires: pip install kokoro soundfile (see VOICE.md).
Usage: python kokoro-synth.py manifest.json out_dir
Manifest: { "voice": "bm_george", "lang": "b", "sentences": [{"file":"cue__s1","text":"..."}] }
"""
import json
import sys
import wave

import numpy as np
import soundfile as sf
from kokoro import KPipeline

manifest_path, out_dir = sys.argv[1], sys.argv[2]
with open(manifest_path, "r", encoding="utf-8") as fh:
    manifest = json.load(fh)

pipeline = KPipeline(lang_code=manifest.get("lang", "b"))
voice = manifest.get("voice", "bm_george")
for entry in manifest["sentences"]:
    chunks = []
    for _gs, _ps, audio in pipeline(entry["text"], voice=voice):
        chunks.append(np.asarray(audio, dtype=np.float32))
    if not chunks:
        continue
    data = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    sf.write(f"{out_dir}/{entry['file']}.wav", data, 24000, subtype="PCM_16")
    print(f"  {entry['file']}.wav")
print(f"Kokoro rendered {len(manifest['sentences'])} sentences with {voice}.")
