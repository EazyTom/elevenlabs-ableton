# Changelog

All notable changes to **elevenlabs-ableton** are documented here. Versions follow [Semantic Versioning](https://semver.org/).

Extension release version is defined in `src/version.ts` (`EXTENSION_VERSION`) and mirrored in `manifest.json` / `package.json`.

Feature-level versions are tracked in `FEATURE_VERSIONS` inside `src/version.ts` for incremental capability tracking.

<a id="v070"></a>

## [0.7.0] — 2026-08-02

### Added

- **Music inpainting (music_v2)** — **Extend Music**, **Regenerate Section**, **Make Seamless Loop**, and **Generate Similar Music** on audio clips and arrangement selections
- **Eleven v3 TTS** — model picker in the TTS modal (Flash v2.5 default, Eleven v3 quality) with discrete v3 stability and audio-tag hints
- **Music v2 defaults** — music generation defaults to `music_v2`, 48 kHz quality options, optional seed (composition-plan path), Live key/scale in composed prompts
- **Song ID persistence** — `store_for_inpainting` on generate; `elevenlabs-config.json` tracks song IDs for re-upload fallback

### Changed

- **Music API** — migrated from raw REST to typed `client.music.compose()`; removed invalid `generation_mode`; v1/v2 composition plans split correctly
- **Dependencies** — `@elevenlabs/elevenlabs-js` ^2.60.0, TypeScript ^7.0.2, Node.js ≥ 24.16.0
- **Context menus** — table-driven registration in `src/menu-registry.ts` (23 menu actions)

### Fixed

- **Music v2 + negative prompt** — no longer sends v1 `MusicPrompt` shape to v2 (API error)
- **Seamless Loop toggle** — documented interim behavior; true loops via inpainting glue-chunk workflow

<a id="v060"></a>

## [0.6.0] — 2026-06-12

### Added

- **Drum Rack SFX pad-slot modal** — seven configurable pad slots (type dropdown, style phrase, editable characteristics, per-pad auto-duration); **Build entire drum kit** presets types and randomizes phrases; consecutive mapping from **Start pad**
- **Drum Rack SFX from MIDI clip slot** — **Generate Drum Rack SFX (ElevenLabs)** on Session View MIDI clip slots when the track hosts a Drum Rack
- **API key onboarding** — paste-and-save modal when no key is configured; validates against ElevenLabs when online
- **Manage ElevenLabs API Key** — Drum Rack and Audio Track context menus; show/hide saved key, update, or remove `api-key.txt`

### Changed

- **Drum Rack SFX** — unified menu label **Generate Drum Rack SFX (ElevenLabs)**; modal title **Drum Rack SFX**; removed GM mapping, variants/loop, single-pad picker, and auto-load variants modes
- **Drum kit persistence** — remembers pad layout (type, phrase, duration, enabled) in `elevenlabs-config.json`; characteristics re-derived from type on open
- **API key resolution** — resolved before progress dialogs; environment variable still takes precedence over saved file

<a id="v050"></a>

## [0.5.0] — 2026-06-07

### Added

- **Session View voice isolation** — **Isolate Voice** on `ClipSlot` (audio tracks) and `AudioClip`; replaces the clip in the same slot and preserves loop settings
- **Screenshots** — `docs/*.png` for README and release notes

### Changed — modal functionality & UI

- **Generate Sound Effects** / **Generate Music** modal titles and unified **Generate Text-to-Speech** menu labels
- **Music modal** — **Set tempo** on by default (slider starts at Live’s current tempo); when enabled, writes tempo to the Live Set on generate; **30 s** manual duration default with **Auto duration** off by default; genre grid cleanup; hints grouped; Seamless Loop above Model/Quality
- **SFX modal** — **Auto duration** on by default with toggle **above** the duration slider
- **Model / Quality** — inline label + dropdown on one row, half-width selects (shared `select-row` + theme override)
- **Modal base CSS** — `label.select-row` row layout fixes label stacking above dropdowns

### Changed — code optimization

- **`isAudioClipSlot()`** / **`resolveAudioClipSlot()`** — Session audio generators and batch TTS skip MIDI-track clip slots (handlers guard before modals; SDK `ClipSlot` menus still appear on MIDI slots)
- **`audioClipSlotsFromSelection()`** — filters multi-slot batch TTS to audio tracks only
- **`normalizeSfxModalResult()`** / **`normalizeMusicModalResult()`** — consistent default flags for auto-duration
- **`ui-branding.ts`** — half-width select override after global `width: 100%` theme rule

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
