# elevenlabs-ableton — Project Context

Lean reference for BMad agents and Cursor. Full integration research: [ABLETON-ELEVENLABS-RESEARCH.md](../../ABLETON-ELEVENLABS-RESEARCH.md).

## What this is

Ableton Live **extension** (not a standalone app) that calls **ElevenLabs** APIs from the Node Extension Host and imports generated audio into the Live Set.

| Item | Value |
|------|-------|
| **Release** | `0.8.0` (`src/version.ts`) |
| **Live** | 12.4.15 beta or 13.0 beta + Developer Mode. Retail 12.4.x has no Extension Host. Both hosts run Node 24.14.1. |
| **Ableton SDK** | `@ableton-extensions/sdk` 1.0.0-beta.1, API `"1.0.0"` |
| **ElevenLabs SDK** | `@elevenlabs/elevenlabs-js` ^2.71.0, bundled via esbuild |
| **Entry** | `dist/extension.js` (CJS bundle ~5.2 MB) |

## Dev commands

```bash
cd elevenlabs-ableton
npm run build          # production bundle
npm start              # build:dev + Live (newest beta, or ABLETON_LIVE / EXTENSION_HOST_PATH)
npm run start:12       # Live 12 beta
npm run start:13       # Live 13 beta
npm run smoke          # build + fake host + API. Does not open Live
```

## Architecture (src/)

| Module | Role |
|--------|------|
| `extension.ts` | `activate()`, commands, context menus |
| `version.ts` | `EXTENSION_VERSION`, `FEATURE_VERSIONS` |
| `elevenlabs-client.ts` | API wrappers (TTS, SFX, music v2.5, inpaint, STS, STT, dialogue v4, voices) |
| `pipelines.ts` | Progress dialogs + Live import orchestration |
| `live-markers.ts` | Music, dialogue, and transcript cue points |
| `clip-metadata.ts` | `EL {feature}` names and feature colors |
| `audio-io.ts` | Temp files, `importIntoProject`, clips, Simpler |
| `midi-io.ts` | Scribe words → `NoteDescription[]` lyric markers |
| `drum-io.ts` | Drum rack pad → Simpler lookup |
| `dialogue.ts` | `1:` / `2:` script parser |
| `live-selection.ts` | Arrangement helpers |
| `live-io.ts` | Post-import mixer / reverb FX |
| `storage.ts` | `elevenlabs-config.json` persistence |
| `voice-cache.ts` | Voice list TTL cache |
| `zip-io.ts` | Stem ZIP extraction (`fflate`) |
| `ui.ts` | Modals (voice list injected at runtime) |
| `ui/*.html` | Live webview modals (esbuild `text` loader) |

## Audio pipelines

**Inbound:** API bytes → `tempDirectory` → `importIntoProject` → `createAudioClip` / `replaceSample`

**Outbound:** `renderPreFxAudio(track, start, end)` → ElevenLabs file upload APIs

## API key

1. `ELEVENLABS_API_KEY` environment variable
2. `{storageDirectory}/api-key.txt`

**Persisted config:** `{storageDirectory}/elevenlabs-config.json` — cloned voices, pronunciation dictionaries, active dict ID, last voice filter.

## Versioning

- **Release:** bump `EXTENSION_VERSION` in `version.ts` + `manifest.json` + `package.json`
- **Features:** add key to `FEATURE_VERSIONS` at `1.0.0`, bump when that feature changes
- **Changelog:** `CHANGELOG.md`

## BMad layout

| Path | Purpose |
|------|---------|
| `_bmad/` | Installer config (do not edit `config.toml` — use `_bmad/custom/`) |
| `_bmad/custom/config.toml` | Team overrides, agent persistent facts |
| `bmad-output/planning-artifacts/` | Sprint status, epics |
| `bmad-output/implementation-artifacts/` | Stories, reviews |
| `docs/` | Project knowledge (this file, roadmap, feature notes) |
| `.agents/skills/` | BMad workflow skills |

## Conventions

- TypeScript ESM source → esbuild bundles to CJS `dist/extension.js`
- `tsconfig.json`: `skipLibCheck: true` (elevenlabs-js ws types)
- Commands namespace: `elevenlabs-ableton.*`
- Prefer extending `pipelines.ts` + `elevenlabs-client.ts` over monolithic `extension.ts`
- No commits of API keys or `.env` secrets
