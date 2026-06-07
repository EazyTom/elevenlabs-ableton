# Changelog

All notable changes to **elevenlabs-ableton** are documented here. Versions follow [Semantic Versioning](https://semver.org/).

Extension release version is defined in `src/version.ts` (`EXTENSION_VERSION`) and mirrored in `manifest.json` / `package.json`.

Feature-level versions are tracked in `FEATURE_VERSIONS` inside `src/version.ts` for incremental capability tracking.

<a id="v040"></a>

## [0.4.0] — 2026-06-06

### Added

- **Music stem separation** — `music.separateStems` → ZIP extract (`fflate`) → one audio track per stem with mixer balance
- **Instant voice clone** — `voices.ivc.create` from clip or arrangement export; persisted in `elevenlabs-config.json`
- **Forced alignment → MIDI** — user-provided lyrics + `forcedAlignment` → precise lyric marker notes
- **Pronunciation dictionary** — `pronunciationDictionaries.createFromRules`; active dict auto-applied to TTS
- UI modals: `clone-voice-modal`, `align-lyrics-modal`, `pronunciation-modal`, `stem-separation-modal`, `result-modal`

### Changed (code review / refactor)

- `live-selection.ts` — shared arrangement helpers (`getPrimaryAudioTrack`, `arrangementClipArgs`)
- `voice-cache.ts` — 5-minute TTL cache for `voices.search` (avoids API call per modal)
- `storage.ts` — persisted config for cloned voices + pronunciation dictionaries
- `zip-io.ts` — stem ZIP extraction and filename-based mixer levels
- `audio-io.importBytesToSimpler` — DRY simpler sample replacement
- `midi-io` — unified `timedWordsToLyricNotes` for Scribe + forced alignment
- `pipelines.withElevenLabsProgress` — surfaces errors in progress dialog
- `extension.ts` — slimmer handlers via shared helpers; `registerMenus()` extracted
- TTS pipelines apply active pronunciation dictionary when configured

### Dependencies

- Added `fflate` for stem ZIP extraction

## [0.3.0] — 2026-06-06

### Added

- **Voice library picker** — `voices.search` populates dropdowns in TTS and voice-changer modals
- **Text-to-Dialogue** — two-speaker script (`1:` / `2:` prefixes) → clip slot + arrangement
- **Drum rack SFX** — `DrumRack` context menu → SFX into pad Simpler by MIDI note
- **Transcribe → MIDI lyrics** — Scribe word timestamps → C4 marker notes on new MidiTrack
- BMad Method integration: `docs/project-context.md`, sprint artifacts, `_bmad/custom/config.toml`, `AGENTS.md`
- Modules: `midi-io.ts`, `drum-io.ts`, `dialogue.ts`
- UI: `dialogue-modal.html`, `drum-rack-sfx-modal.html`

### Changed

- TTS and voice modals fetch voice list before display
- `transcribeWithWords()` split from plain transcript for MIDI workflow

## [0.2.0] — 2026-06-06

### Added

- **Sound Effects** — `ClipSlot` and `AudioTrack.ArrangementSelection` context menus
- **Music Generation** — `ClipSlot` and arrangement selection
- **Batch TTS** — `ClipSlotSelection` (multi-slot Session View, single generation → all slots)
- **Voice Changer** — arrangement selection → `renderPreFxAudio` → speech-to-speech → take lane clip
- **Vocal Isolation** — arrangement selection → audio isolation → take lane clip
- **Transcribe (Scribe)** — `AudioClip` (direct file path) and arrangement selection (pre-FX render)
- **Simpler TTS / SFX** — `Simpler.replaceSample` workflows
- **Post-import vocal FX** — arrangement TTS auto-sets track volume and reverb mix when available
- Modular source layout: `pipelines.ts`, `ui.ts`, `live-io.ts`, `version.ts`, `types.ts`
- UI modals: `sfx-modal.html`, `music-modal.html`, `voice-modal.html`, `transcript-modal.html`

### Changed

- Refactored TTS from monolithic `extension.ts` into pipeline modules
- `audio-io.ts` now supports `TakeLane` clip creation (required `startTime`)

## [0.1.0] — 2026-06-06

### Added

- Initial MVP: **Text-to-Speech** on `ClipSlot` and `AudioTrack.ArrangementSelection`
- `elevenlabs-client.ts` — API key resolution, `ElevenLabsClient`, `generateTts`
- `audio-io.ts` — temp file write, `importIntoProject`, `createAudioClip`
- `ui/tts-modal.html` — text + optional voice ID prompt
- Bundled `@elevenlabs/elevenlabs-js` via esbuild
