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

**v0.6.0** — Drum Rack SFX pad-slot refactor, API key onboarding & management

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

- Long operations: `withElevenLabsProgress()` in `pipelines.ts` — resolves API key **before** opening the progress dialog via `resolveApiKeyWithPrompt()`; shows errors via `formatApiError` + `showError`
- Arrangement audio outbound: `renderPreFxAudio(track, start, end)` — prefer over raw `clip.filePath` when FX/warp matter
- Inbound audio: temp file → `importIntoProject` → `createAudioClip` / `replaceSample`
- Modals: inject branding via `ui-branding.ts` (`prepareModalHtml()`); logo **140×35 px**

---

## Modal UI windows (Extension Host webview)

Modals are **HTML files** in `ui/` loaded as data URLs by the Ableton Extension Host webview. They are **not** React/Vue — plain HTML + inline `<script>` + optional page-local `<style>`. TypeScript in `src/ui.ts` imports them as strings (`import x from "../ui/foo-modal.html"`) via `src/html.d.ts`.

### How a modal opens and returns data

1. **Prompt function** in `src/ui.ts` (e.g. `promptSfx`, `promptDrumRackSfx`) prepares HTML, calls `showModal<T>()`.
2. **`showModal`** wraps HTML with `prepareModalHtml(html, subtitle)` from `ui-branding.ts` (theme CSS, `modal-base.css`, logo header), then `context.ui.showModalDialog(dataUrl, width, height + MODAL_HEADER_EXTRA_HEIGHT)`.

   Since **Live 12.4.5b4**, `showModalDialog` **no longer retains data between calls** — each invocation starts fresh. Do not rely on WebView state persisting across modal opens.
3. **Webview JS** calls `closeWithResult({ ... })` → posts `{ method: "close_and_send", params: [JSON.stringify(result)] }` via `webkit.messageHandlers.live` or `chrome.webview`.
4. **`parseJson<T>()`** in `ui.ts` parses the returned string; `{ cancelled: true }` → prompt returns `null`.

**Keyboard:** most modals bind `Escape` → cancel, `Ctrl/Cmd+Enter` → submit.

**Sizing:** pass body content height to `showModal`; header height is added automatically. Tall modals (Drum Rack SFX) use ~520×920. Scroll via `overflow-y: auto` on `body` when needed.

### Modal inventory

| HTML | Prompt / entry | Subtitle | Notes |
|------|----------------|----------|-------|
| `tts-modal.html` | `promptTts` | Text-to-Speech | `{{VOICE_OPTIONS}}` injection |
| `sfx-modal.html` | `promptSfx` | Generate Sound Effects | `{{SFX_PROMPT_RANDOMIZER}}`; `normalizeSfxModalResult` |
| `music-modal.html` | `promptMusic` | Generate Music | `{{MUSIC_PROMPT_RANDOMIZER}}`, `{{LIVE_TEMPO}}`; reads Live tempo |
| `drum-rack-sfx-modal.html` | `promptDrumRackSfx` | Drum Rack SFX | **7 pad slots** — see below |
| `api-key-modal.html` | `promptApiKey` / `resolveApiKeyWithPrompt` | ElevenLabs API Key | Show/hide key; manage mode |
| `dialogue-modal.html` | `promptDialogue` | Text to dialogue | Three voice dropdowns |
| `sfx-variant-picker-modal.html` | `promptSfxVariantPick` | Pick variant | Radio list after multi-gen SFX/Music |
| `voice-modal.html` | `promptVoice` | Voice selection | |
| `clone-voice-modal.html` | `promptCloneVoice` | Clone voice | |
| `align-lyrics-modal.html` | `promptAlignLyrics` | Align lyrics | |
| `pronunciation-modal.html` | `promptPronunciationRule` | | |
| `stem-separation-modal.html` | `promptStemSeparation` | | |
| `transcript-modal.html` | `showTranscript` | Transcript | Read-only display |
| `result-modal.html` | `showResult` | | Info dialog, no JSON return |

### Two HTML preparation patterns

**A — Static + small replace** (SFX, Music, TTS voices):

```typescript
template.replace(/\{\{VOICE_OPTIONS\}\}/g, buildVoiceOptionsHtml(voices))
```

Randomizer scripts are built in TS (`buildSfxPromptRandomizerScript()`, `buildMusicPromptRandomizerScript()`) and injected as `<script>` blocks.

**B — Dynamic row builder in TS** (Drum Rack SFX):

- `buildDrumPadRowsHtml(persisted)` generates all 7 pad rows server-side (escape user text with `escapeHtml()`).
- `buildDrumPadRandomizerScript()` from `drum-kit.ts` injects `DRUM_TYPES`, style banks, characteristics map, and webview helpers (`randomizePadPhrase`, `applyTypeCharacteristics`).
- Placeholders in `drum-rack-sfx-modal.html`: `{{DRUM_PAD_RANDOMIZER}}`, `{{DRUM_PAD_ROWS}}`, `{{START_NOTE_OPTIONS}}`, `{{KICK_KEY_OPTIONS}}`, `{{OVERWRITE_CHECKED}}`.

Prefer **pattern B** when the modal has repeating indexed rows (pads, variants). Keep row IDs stable: `padEnabled_0`, `padType_0`, `padPhrase_0`, etc.

### Styling modals

- **Global layout/components:** `ui/modal-base.css` — flex column body, `.checkbox`, `.tempo-row`, `.buttons`, `.error`, range sliders.
- **Colors/fonts:** only via CSS variables from `src/ui-theme.ts` (`--c-bg`, `--c-accent`, …). `ui-branding.ts` injects `:root { … }`.
- **Modal-specific layout:** short `<style>` block at bottom of the HTML file (Drum Rack uses `.pad-row`, `.pad-duration-row`, compact headers).
- **Half-width selects:** `.select-row select` or `.stack-column select` in branding shell (SFX/Music Model+Quality rows).
- Do **not** hardcode hex colors in HTML.

### Normalization (TS side)

Modal JSON is raw user input. Always normalize in `ui.ts` before returning to pipelines:

| Modal | Normalizer | Key defaults |
|-------|------------|--------------|
| SFX | `normalizeSfxModalResult` | `autoDuration: true`, clamp variants 1–10 |
| Music | `normalizeMusicModalResult` | tempo, genres, length ms |
| Drum Rack | `normalizeDrumRackSfxModalResult` + `normalizeDrumPads` | per-pad duration on 0.5s grid, `autoDuration` default true |

Types live in `src/types.ts`. Pipeline reads normalized result only.

---

## Drum Rack SFX (v0.6.0 — pad-slot model)

**Menu (consistent naming):** `Generate Drum Rack SFX (ElevenLabs)` on `DrumRack` and MIDI `ClipSlot` (via `ensureDrumRackFromClipSlot` in `drum-io.ts` — auto-inserts empty Drum Rack when track has no devices).

**Feature version:** `drumRackSfx: "1.2.0"` in `FEATURE_VERSIONS`.

### Architecture (no legacy modes)

v0.6.0 **replaced** the old three-mode modal (single pad + auto-load variants + build kit with fixed piece rows). There is now **one flow**: loop enabled pads in `pipelineDrumRackSfx`.

```
extension.ts → promptDrumRackSfx → pipelineDrumRackSfx → generateSfx per pad → ensureSimplerOnPad → importBytesToSimpler
```

### Data model — `src/drum-kit.ts`

| Export | Purpose |
|--------|---------|
| `DRUM_TYPES` | 8 selectable types: kick, snare, openHat, closedHat, rimshot, perc, clap, other |
| `DRUM_TYPE_STYLE_BANKS` | Per-type random phrase lists (20 phrases each) |
| `defaultCharacteristicsForType()` | Sound character per type (delivery rules appended separately) |
| `DRUM_PAD_SAMPLE_CONSTRAINTS` / `DRUM_PAD_AVOID_TERMS` | Shared 0.25 s lead-in, kit level, avoid clause |
| `DEFAULT_KIT_TYPE_BY_PAD` | 7 types for “Build entire kit” preset |
| `GM_DRUM_OFFSET_BY_TYPE` | GM offsets from root C when pad mapping is GM |
| `DRUM_PAD_SLOT_COUNT` | `7` |
| `resolveDrumPadPrompt(style, characteristics, typeId, pitchKey?)` | style + characteristics + constraints + avoid; pitch key for kick/snare |
| `drumPadMidiNote(padIndex, startNote, mode, typeId?)` | Sequential or GM MIDI note |
| `assertEnabledDrumPadsMidiRange()` | Range + GM duplicate-note guard |
| `buildDrumPadRandomizerScript()` | Injected into modal webview |

**Prompt assembly:** user style phrase + editable characteristics + shared delivery constraints. Kick/snare key applied when pad type matches. Avoid clause via `buildSfxApiText`.

### Modal behavior (`ui/drum-rack-sfx-modal.html`)

- **Default:** only Pad 1 enabled on open (enable state **not** persisted).
- **Build entire drum kit:** enables all 7, sets types from `DEFAULT_KIT_TYPE_BY_PAD`, calls `randomizePadPhrase(i)` each.
- **Root C:** C-2 through C3 (default C1). **Pad mapping:** Sequential or General MIDI.
- **Kick key / Snare key:** optional pitch character dropdowns.
- **Type change:** `applyTypeCharacteristics(padIndex)` refills characteristics textarea from injected map.
- **Duration slider:** `min=1 max=60 step=1` → seconds = value/2 (0.5s grid). Auto checkbox disables slider, shows “Auto”.
- **Submit:** `collectPads()` → `{ pads, startMidiNote, padMappingMode, kickKey, snareKey, overwriteOccupied, modelId, outputFormat, promptInfluence }`.

### Persistence — `storage.ts` / `elevenlabs-config.json`

On successful generate, `promptDrumRackSfx` saves via `saveDrumKitSettings`:

- **Saved:** padIndex, type, stylePhrase, durationSeconds, autoDuration, startMidiNote, padMappingMode, overwriteOccupied, kickKey, snareKey
- **Not saved:** enabled (always Pad 1 on open), characteristics (re-derived from type default on open and on type-change in webview)
- **Migration:** `normalizeStoredDrumKit()` accepts legacy `id` / `promptPrefix` fields from pre-v0.6 configs

### Pipeline — `pipelineDrumRackSfx`

For each **enabled** pad in `modal.pads`:

1. `midiNote = drumPadMidiNote(padIndex, startNote, padMappingMode, pad.type)`
2. Skip if occupied and `!overwriteOccupied` (track in `skipped[]`, `showResult` summary)
3. `resolveDrumPadPrompt` → `generateSfx` (SFX v2 only) with per-pad `autoDuration` / `durationSeconds`
4. `loadSfxToDrumPad` → creates chain + Simpler if missing

**Removed code (do not reintroduce):** `listPadsWithSimpler`, `generateDrumRackVariants`, auto-load variants, single-pad Simpler requirement.

### Tests

`scripts/post-build-check.ts`: bundle integrity + behavioral smoke (dialogue, clamps, drum-prompt, drum-mapping incl. GM duplicate guard, storage round-trip).

Spec: [docs/v0.6.0-features.md](docs/v0.6.0-features.md).

---

## API key modal (v0.6.0)

**Files:** `ui/api-key-modal.html`, `src/api-key.ts`, `prepareApiKeyModalHtml` / `promptApiKey` / `resolveApiKeyWithPrompt` in `ui.ts`.

| Entry | Behavior |
|-------|----------|
| `resolveApiKeyWithPrompt` | Called from `withElevenLabsProgress` before progress UI; opens modal if no env/file key |
| `promptManageApiKey` | Drum Rack / Audio Track menu; manage mode with Show/Hide, Remove |
| `readApiKeyFromStorageFile` | Loads full key for Show in manage modal (`{{EXISTING_KEY_SCRIPT}}` on DOMContentLoaded) |

**Resolution order:** `ELEVENLABS_API_KEY` env → `{storageDirectory}/api-key.txt`.

**Modal result type:** `ApiKeyModalResult` — `{ apiKey }`, `{ clearKey: true }`, or `{ cancelled: true }`.

**Validation:** `validateApiKey()` on save; unchanged key in manage mode → “API key unchanged” without rewrite.

**Critical:** never resolve API key inside `withinProgressDialog` — always before, so the user can paste a key without dismissing progress.

---

## Modal work checklist (agents)

1. Add or edit `ui/your-modal.html` — use `closeWithResult`, `setError`, theme variables only.
2. Add result interface to `src/types.ts`.
3. Add `promptYourFeature()` in `src/ui.ts` — prepare HTML, `showModal`, normalize, validate.
4. Wire command in `src/extension.ts`; pipeline in `pipelines.ts` via `withElevenLabsProgress`.
5. If injecting dynamic HTML, use `escapeHtml()` for all user/persisted strings.
6. If adding randomizer/JSON to webview, build script in TS module (see `drum-kit.ts` / `sfx-prompt.ts`) — avoid duplicating constants in HTML.
7. Bump `FEATURE_VERSIONS` + `CHANGELOG.md` on behavior change.
8. Run `npm run build` — post-build checks validate version sync and drum/API unit tests.

### Common modal pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| Modal returns `{}` / parse fails | Invalid JSON in `closeWithResult` | Always `JSON.stringify` plain objects |
| Randomizer undefined in webview | Script placeholder not replaced | Check `prepare*ModalHtml` replace order |
| Saved settings ignored | Normalizer drops fields | Update `normalize*` + `Stored*` types + migration |
| Drum pad row IDs mismatch | Index vs id confusion | Use numeric `padIndex` 0–6 consistently |
| Progress opens without key | Key resolved inside progress callback | Use `resolveApiKeyWithPrompt` before `withElevenLabsProgress` |
| XSS in injected rows | Unescaped persisted text | `escapeHtml()` in `buildDrumPadRowsHtml` |
| Theme colors wrong | Hardcoded colors in HTML | Use `--c-*` variables only |

### Errors

- User-facing: `formatApiError()` in `api-errors.ts` — handles `err.body.detail` as string, object, or **validation array** (`msg` fields)
- `UnprocessableEntityError` from SDK often has `message: "UnprocessableEntityError"` only; always read `statusCode` and `body`
- Throw `ElevenLabsHttpError` from `multipart-upload.ts` for direct fetch failures

### API key & storage

Resolution order (`resolveApiKey` in `api-key.ts`):

1. `ELEVENLABS_API_KEY` env var
2. `{storageDirectory}/api-key.txt`
3. Modal prompt via `resolveApiKeyWithPrompt()` (validates + saves)

Manage saved key: **Manage ElevenLabs API Key** on Drum Rack / Audio Track → `promptManageApiKey`.

Dev: `scripts/start-dev.ts` passes `--storage-directory` and `--temp-directory` from `.env`. Persisted config: `elevenlabs-config.json` in storage dir (`drumKit` section for last Drum Rack pad layout).

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
3. Modal in `ui/*.html` + prompt in `src/ui.ts` — see [Modal UI windows](#modal-ui-windows-extension-host-webview); colors from `src/ui-theme.ts`, layout from `ui/modal-base.css` (injected by `prepareModalHtml`)
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
| [docs/roadmap.md](docs/roadmap.md) | Shipped + planned scope |
| [docs/v0.6.0-features.md](docs/v0.6.0-features.md) | Drum Rack SFX pad-slot + API key (current) |
| [docs/pre-release-checklist.md](docs/pre-release-checklist.md) | Before tagging a release |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
