# elevenlabs-ableton — Project Context

Lean reference for BMad agents and Cursor. Full integration research: [ABLETON-ELEVENLABS-RESEARCH.md](../../ABLETON-ELEVENLABS-RESEARCH.md).

## What this is

Ableton Live **extension** (not a standalone app) that calls **ElevenLabs** APIs from the Node Extension Host and imports generated audio into the Live Set.

| Item | Value |
|------|-------|
| **Release** | `0.5.0` (`src/version.ts`) |
| **Live** | 12.4 Alpha + Developer Mode |
| **Ableton SDK** | `@ableton-extensions/sdk` 1.0.0-beta.0, API `"1.0.0"` |
| **ElevenLabs SDK** | `@elevenlabs/elevenlabs-js` ^2.51.0, bundled via esbuild |
| **Entry** | `dist/extension.js` (CJS bundle ~3.9 MB) |

## Dev commands

```bash
cd elevenlabs-ableton
npm run build          # production bundle
npm start              # build:dev + extensions-cli run
npm start   # auto: --storage-directory + --temp-directory from .env
extensions-cli run --storage-directory D:\Repos\ElevenLabs --temp-directory D:\Repos\ElevenLabs\.elevenlabs-temp
```

## Architecture (src/)

| Module | Role |
|--------|------|
| `extension.ts` | `activate()`, commands, context menus |
| `version.ts` | `EXTENSION_VERSION`, `FEATURE_VERSIONS` |
| `elevenlabs-client.ts` | API wrappers (TTS, SFX, music, STS, STT, dialogue, voices) |
| `pipelines.ts` | Progress dialogs + Live import orchestration |
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

**Persisted config:** `{storageDirectory}/elevenlabs-config.json` — cloned voices, pronunciation dictionaries, active dict ID.

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
