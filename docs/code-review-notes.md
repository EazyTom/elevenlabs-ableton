# Code Review Notes — v0.4.0

Senior JS review findings addressed in this release.

## Resolved

1. **DRY violation in `extension.ts`** — Arrangement handlers duplicated track resolution, duration math, and clip args. Extracted to `live-selection.ts`.

2. **Redundant API calls** — `voices.search` ran before every TTS/voice/dialogue modal. Added session-scoped cache with 5-minute TTL (`voice-cache.ts`).

3. **Simpler pipeline duplication** — `pipelineSimplerTts/Sfx` repeated temp-write + transaction. Consolidated into `audio-io.importBytesToSimpler()`.

4. **MIDI mapping duplication** — Scribe and forced alignment used parallel logic. Unified via `timedWordsToLyricNotes()` with type-specific filters upstream.

5. **Opaque errors** — `runSafe` only logged to console. `withElevenLabsProgress` now writes error message to progress dialog before rethrow.

6. **No persistent user prefs** — Cloned voices and pronunciation dictionaries now persist in `storageDirectory/elevenlabs-config.json`.

## Remaining opportunities (v0.5.0+)

See [roadmap.md](roadmap.md) for prioritized v0.5.0 features.

| Item | Notes |
|------|-------|
| ~~Batch TTS pronunciation~~ | Fixed in v0.4.0 |
| ~~No automated post-build check~~ | Fixed — `scripts/post-build-check.ts` |
| ~~TTS voice dropdown ignored on submit~~ | Fixed in `tts-modal.html` |
| `extension.ts` size | ~450 lines; split into `src/commands/*.ts` |
| Clone voices not in picker | `fetchVoices()` should merge `storage.clonedVoices` |
| User-facing error modal | Progress dialog only |
| Voice picker pagination | 50 voice cap |
| Temp file cleanup | After successful `importIntoProject` |
| ~~`LICENSE`~~ | Added — GPL-3.0-or-later |

## Patterns to follow

- New features: `elevenlabs-client.ts` (API) → `pipelines.ts` (orchestration) → `extension.ts` (command + menu) → `ui/*.html` (modal)
- Always use `withElevenLabsProgress` for long operations
- Register in `FEATURE_VERSIONS` + `CHANGELOG.md` on ship
