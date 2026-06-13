# Roadmap — elevenlabs-ableton

## Shipped

| Version | Highlights |
|---------|------------|
| **0.1.0** | TTS → clip slot & arrangement |
| **0.2.0** | SFX, music, batch TTS, voice changer, vocal isolation, Scribe, Simpler, post-import FX |
| **0.3.0** | Voice picker, text-to-dialogue, drum rack SFX, transcribe → MIDI |
| **0.4.0** | Stem separation, voice clone, forced alignment → MIDI, pronunciation rules, refactor |
| **0.5.0** | Session voice isolation, modal UX/tempo sync, audio-slot guards, UI layout |
| **0.6.0** | Drum Rack SFX pad-slot modal, API key onboarding & management, MIDI clip slot drum entry |

---

## Surface coverage (v0.4.0)

### `@elevenlabs/elevenlabs-js` — client resources

| Client | Used in extension | Notes |
|--------|-------------------|-------|
| `textToSpeech` | ✓ `convert` | Default model `eleven_flash_v2_5`; pronunciation locators |
| `textToSoundEffects` | ✓ `convert` | |
| `music` | ✓ `compose`, `separateStems` | Not using `stream`, `composeDetailed`, `videoToMusic`, `upload` |
| `textToDialogue` | ✓ `convert` | Two-speaker script only |
| `speechToSpeech` | ✓ `convert` | Voice changer |
| `audioIsolation` | ✓ `convert` | Vocal isolation |
| `speechToText` | ✓ `convert` | Scribe `scribe_v2` |
| `forcedAlignment` | ✓ `create` | User transcript → MIDI |
| `voices` | ✓ `search`, `ivc.create` | Page 1 only; no pagination |
| `pronunciationDictionaries` | ✓ `createFromRules` | Single-rule create; not `list` / `get` UI |
| `textToSpeech` | ○ unused | `convertWithTimestamps`, `stream`, `streamWithTimestamps` |
| `textToVoice` | ○ | Voice design / remix from prompt |
| `dubbing` | ○ | Async dubbing jobs |
| `models` | ○ | Model picker in modals |
| `usage` / `workspace` | ○ | Cost / quota preview |
| `history` | ○ | Re-use past generations |
| `conversationalAi` / `speechEngine` | ○ | Real-time agents — high complexity |
| `audioNative` / `studio` / `productions` | ○ | Publishing / content mgmt |
| `samples` | ○ | Voice sample management |

### Ableton SDK — scopes used

| Scope | Features |
|-------|----------|
| `ClipSlot` | TTS, SFX, music, dialogue |
| `ClipSlotSelection` | Batch TTS |
| `AudioTrack.ArrangementSelection` | Generate, transform, transcribe, align, clone, stems |
| `AudioClip` | Transcribe, align, clone, stems |
| `AudioTrack` | Pronunciation rules |
| `Simpler` | TTS / SFX sample replace |
| `DrumRack` / MIDI `ClipSlot` | Drum Rack SFX (7 pad slots) |
| `MidiTrack` | Created for lyric markers (not a context menu scope) |

**Not yet used:** `Song.cuePoints`, `MidiTrack`/`MidiClip` direct menus, `DeviceParameter` automation, `WarpMode` post-import, `Scene` scope.

---

## Planned v0.5.0

Prioritized by **value × utility ÷ complexity**.

### Tier A — High value, low–medium complexity (target v0.5.0)

| Feature | Value | Complexity | APIs / work |
|---------|-------|------------|-------------|
| **Settings / voice manager modal** | High — surfaces cloned voices + active pronunciation dict | Low | `storage.ts` + extend `ui.ts`; merge into voice picker |
| **Voice picker pagination + search** | High — 50-voice cap is limiting | Medium | `voices.search` with `nextPageToken` |
| **Model picker in TTS modal** | Medium — quality vs latency choice | Low | `models.list` or hardcoded list + `generateTts` `modelId` |
| **TTS with timestamps → MIDI** | High — karaoke / subtitle markers without STT | Medium | `textToSpeech.convertWithTimestamps` → `timedWordsToLyricNotes` |
| **Usage / character estimate in modals** | Medium — avoids surprise bills | Low–Med | `usage` or client-side char count + tier docs |
| **Post-build smoke test in CI** | High for sharing | Done | `scripts/post-build-check.ts`, `npm run check:api` |

### Tier B — Medium value, medium complexity (v0.5.0 or v0.6.0)

| Feature | Value | Complexity | APIs / work |
|---------|-------|------------|-------------|
| **Voice design from prompt** | Medium — custom voices without recording | Medium | `textToVoice.createPreviews` → `create` → storage |
| **Music composition plan UI** | Medium — structured sections vs one-shot prompt | Medium | `music.compositionPlan` + `compose` |
| **Transcribe → copy to clipboard / export** | Medium — lyric workflow | Low | modal action + `fs` write to `storageDirectory` |
| **Scribe with speaker diarization** | Medium — multi-vocalist sessions | Low | `speechToText` `diarize: true` in transcript modal |
| **Cue-point TTS placement** | Medium — place audio at markers | Medium | `Song.cuePoints` + `createAudioClip` at `cue.time` |
| **Pronunciation dictionary list / switch** | Medium — manage multiple dicts | Low | `pronunciationDictionaries.list` + storage UI |

### Tier C — High value, high complexity (v0.6.0+)

| Feature | Value | Complexity | Notes |
|---------|-------|------------|-------|
| **Dubbing pipeline** | High for video/film users | High | `dubbing` async job + poll + import |
| **Music stem → group tracks** | Medium | Medium | Create group track per stem set |
| **Text-to-dialogue 3+ speakers** | Low–Med | Medium | Dynamic script UI |
| **Conversational AI in Live** | Experimental | Very high | WebSocket; no Live audio tap |
| **Generation history browser** | Medium | Medium | `history` + re-import |
| **Warp mode on import** | Low–Med | Low | `WarpMode` enum post-`createAudioClip` |

### Tier D — Polish / maintainability (ongoing)

| Item | Complexity |
|------|------------|
| Split `extension.ts` → `src/commands/*.ts` | Low |
| User-facing error modal (not only progress text) | Low |
| Temp file cleanup after `importIntoProject` | Low |
| Include cloned voices in `fetchVoices()` cache | Low |
| `LICENSE` file (MIT or project choice) | Trivial |

---

## Recommended v0.5.0 release scope

Ship these five for a strong release:

1. Settings / voice manager (cloned voices + pronunciation status)
2. Voice picker search + pagination
3. Model picker (TTS)
4. TTS timestamps → MIDI lyric markers
5. Character / usage hint in TTS modal

Plus: `npm run check:api` documented in README for pre-share validation.

---

## Validation commands

```bash
npm run build              # runs postbuild → check:build
npm run check:build        # bundle + unit checks (no API key)
npm run check:api            # + API smoke (TTS + voices)
npm run check:api:full       # + SFX (extra cost)
```

See [pre-release-checklist.md](pre-release-checklist.md).
