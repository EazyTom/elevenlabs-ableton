# Agent instructions — elevenlabs-ableton

This project uses the **BMad Method** for planning and implementation.

## Read first

1. [docs/project-context.md](docs/project-context.md) — architecture, dev commands, conventions
2. [../ABLETON-ELEVENLABS-RESEARCH.md](../ABLETON-ELEVENLABS-RESEARCH.md) — ElevenLabs ↔ Ableton capability map
3. [bmad-output/planning-artifacts/sprint-status.yaml](bmad-output/planning-artifacts/sprint-status.yaml) — current sprint state
4. [docs/code-review-notes.md](docs/code-review-notes.md) — patterns and known gaps

## BMad config

- Team overrides: `_bmad/custom/config.toml`
- Do **not** edit installer-managed `_bmad/config.toml` — use `custom/` instead
- Planning artifacts: `bmad-output/planning-artifacts/`
- Implementation stories: `bmad-output/implementation-artifacts/stories/`

## Implementation rules

- Bump `src/version.ts` + `manifest.json` + `package.json` on releases
- Add new features to `FEATURE_VERSIONS` and `CHANGELOG.md`
- Run `npm run build` (or `npm run check:build`) before considering work complete
- Never commit API keys, `.env`, or `api-key.txt`

## Current release

**v0.5.0** — Session voice isolation, SFX/Music modal UX, Live tempo sync, audio-slot guards, UI layout polish

---

## Extension Host constraints (read before changing bundle / fetch / uploads)

The extension runs in **Live’s Extension Host** (Node 24), not a full browser or desktop Node app. Code that works in `tsx` tests or normal Node may **fail in Live**.

### Missing or unreliable globals

| Global | Status in Live | What to use instead |
|--------|----------------|---------------------|
| `Response` | Not available | `streamToBytes()` in `elevenlabs-client.ts` — `ReadableStream.getReader()`, never `new Response(stream)` |
| `URL` / `URLSearchParams` | Not available | String concat + `encodeURIComponent` (see `multipart-upload.ts` `buildUrl`) |
| Native `FormData` | Often missing | `install-globals.ts` falls back to `formdata-polyfill` |

### File uploads — do not use SDK FormData in the extension

`formdata-polyfill` + `fetch` **drops file parts** from multipart bodies. Symptom: HTTP 422 `Field required` on `body.file`, log shows only `UnprocessableEntityError`.

**Fix pattern (required for any new file-upload API):**

1. Read audio with `readAudioUpload()` from `multipart-upload.ts`
2. POST via `postMultipart()` / `postMultipartJson()` — manual multipart body, not ElevenLabs SDK `FormData` path
3. Store API key on client via `createClient()` + `clientApiKey()` when bypassing SDK

Stem separation already uses this (`separateMusicStems`). **Other SDK file APIs** (STT, voice clone, STS, forced alignment) still use `createReadStream` + SDK — they may hit the same bug in Live until migrated to `postMultipart`.

Regression test: `npx tsx scripts/test-stem-api.ts` (forces `formdata-polyfill` FormData).

### Bundle / polyfill policy — what not to add

These were tried and **reverted** because they broke extension load or stability:

- **Full `undici` bundle** in esbuild
- Large polyfill banners (`TextDecoder`, `ReadableStream`, `URLSearchParams`, `AbortSignal` chains)
- `src/bootstrap.ts`, `node-polyfills.ts`, `polyfill-first.ts` — deleted; do not reintroduce

**Current approach (keep it):**

- Entry: `src/extension.ts` with **`import "./install-globals.js"` as the first line**
- `build.ts`: small esbuild **banner** — Node built-ins only (`util`, `stream/web`, `buffer`)
- `install-globals.ts`: `formdata-polyfill` + Node `Blob`/`File`/streams — **no undici**
- Loaders: `.html` → `text`, `.png` → `dataurl` (logo in `ui-branding.ts`)

Bundle size ~8 MB is expected (ElevenLabs SDK + `formdata-polyfill`). Do not “optimize” by removing shims without testing in Live.

---

## Code standards

### Feature layout

```
elevenlabs-client.ts (API) → pipelines.ts (orchestration) → extension.ts (command + menu) → ui/*.html (modal)
```

- Long operations: `withElevenLabsProgress()` in `pipelines.ts` (shows errors via `formatApiError` + `showError`)
- Arrangement audio outbound: `renderPreFxAudio(track, start, end)` — prefer over raw `clip.filePath` when FX/warp matter
- Inbound audio: temp file → `importIntoProject` → `createAudioClip` / `replaceSample`
- Modals: inject branding via `ui-branding.ts` (`injectBranding()`); logo **140×35 px**

### Errors

- User-facing: `formatApiError()` in `api-errors.ts` — handles `err.body.detail` as string, object, or **validation array** (`msg` fields)
- `UnprocessableEntityError` from SDK often has `message: "UnprocessableEntityError"` only; always read `statusCode` and `body`
- Throw `ElevenLabsHttpError` from `multipart-upload.ts` for direct fetch failures

### API key & storage

Resolution order (`resolveApiKey`):

1. `ELEVENLABS_API_KEY` env var
2. `{storageDirectory}/api-key.txt`
3. `ELEVENLABS_STORAGE_DIRECTORY` env (fallback search path)

Dev: `scripts/start-dev.ts` passes `--storage-directory` and `--temp-directory` from `.env`. Persisted config: `elevenlabs-config.json` in storage dir.

### Dev tooling

- `npm start` → `build:dev` + `start-dev.ts`
- **Do not** use `spawn(..., { shell: true })` with args on Windows (Node DEP0190). Spawn `process.execPath` + `node_modules/@ableton-extensions/cli/dist/cli.mjs` directly
- Post-build: `npm run check:build` (version sync, bundle markers); `npm run check:api` for live API smoke (needs key)

### Versioning & ship checklist

| Step | File / command |
|------|----------------|
| Bump release | `src/version.ts`, `manifest.json`, `package.json` |
| New feature | `FEATURE_VERSIONS` in `version.ts` |
| Changelog | `CHANGELOG.md` |
| Validate | `npm run build` → `npm run check:api` (optional) |
| Distribute | `npm run package` → `elevenlabs-ableton-{version}.ablx` (gitignored; attach to GH Release) |

---

## Adding a new feature (checklist)

1. API wrapper in `src/elevenlabs-client.ts` — if it uploads files, use `postMultipart` not SDK streams
2. Pipeline in `src/pipelines.ts` via `withElevenLabsProgress`
3. Modal in `ui/*.html` + prompt in `src/ui.ts` — colors from `src/ui-theme.ts`, layout from `ui/modal-base.css` (injected by `prepareModalHtml`)
4. Command + context menu in `src/extension.ts`
5. Register in `FEATURE_VERSIONS` + `CHANGELOG.md`
6. `npm run build` and smoke in Live (Developer Mode + `npm start`)

## Adding a new file-upload API (checklist)

1. Add helper call in `elevenlabs-client.ts` using `readAudioUpload` + `postMultipart` or `postMultipartJson`
2. Use `clientApiKey(client)` for `xi-api-key` header
3. Do **not** use `new URL()` for endpoint construction
4. Do **not** rely on `client.*.convert({ file: createReadStream(...) })` for Extension Host correctness
5. Extend `scripts/test-stem-api.ts` or add similar polyfill regression test
6. Ensure `formatApiError` surfaces real API messages in the progress/error dialog

---

## UI theme

| File | Role |
|------|------|
| [`src/ui-theme.ts`](src/ui-theme.ts) | **Edit colors here** — `ACTIVE_UI_THEME`, presets, CSS variable map |
| [`ui/modal-base.css`](ui/modal-base.css) | Shared modal layout/components (uses `--c-*` variables only) |
| [`src/ui-branding.ts`](src/ui-branding.ts) | Injects theme + base CSS + logo header into every modal |

To retheme: change `ACTIVE_UI_THEME` in `ui-theme.ts` (or add a preset to `UI_THEME_PRESETS`). Do **not** hardcode colors in `ui/*.html`.

---

## Common pitfalls (from v0.4.0 bugfixes)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Response is not defined` | `new Response(stream)` or SDK path using Response | `streamToBytes()` with `getReader()` |
| `URL is not defined` | `new URL()` in fetch helpers | String URL building |
| `UnprocessableEntityError` / missing `file` on upload | `formdata-polyfill` + fetch | `postMultipart()` |
| API key not found at runtime | `--storage-directory` not passed | `.env` + `start-dev.ts`, or user storage setup |
| Extension host crash on load | Heavy undici / polyfill cascade | Revert to minimal banner + `install-globals.ts` |
| Voice dropdown ignored | Modal submit reads wrong field | Read `voiceSelect` on submit (`tts-modal.html` pattern) |
| Log shows error class name only | SDK 422 body not parsed | `formatApiError` + log `err.body` in dev |

---

## Documentation index

| Doc | Use when |
|-----|----------|
| [README.md](README.md) | User setup, storage dir, `.ablx` install |
| [docs/roadmap.md](docs/roadmap.md) | v0.5.0+ scope |
| [docs/pre-release-checklist.md](docs/pre-release-checklist.md) | Before tagging a release |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
