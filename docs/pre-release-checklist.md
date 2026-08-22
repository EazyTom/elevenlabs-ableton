# Pre-release checklist

Run before tagging a release or publishing to GitHub.

## Automated

```bash
npm run build
npm run check:build          # bundle integrity + unit checks (no API key)
npm run check:api            # + ElevenLabs API smoke (needs API key)
```

Optional (costs API credits):

```bash
npm run check:api:full       # includes SFX generation test
```

## Version alignment

- [ ] `src/version.ts` `EXTENSION_VERSION`
- [ ] `manifest.json` `version`
- [ ] `package.json` `version`
- [ ] `CHANGELOG.md` entry
- [ ] `FEATURE_VERSIONS` updated for new features
- [ ] `post-build-check` version-sync passes

## Secrets & git

- [ ] No `api-key.txt` or `elevenlabs-config.json` staged
- [ ] `.env` not committed
- [ ] `vendor/*.tgz` present locally (or documented download step in README)

## Manual in Live (smoke)

Requires Live 12.4.5 beta or newer, Developer Mode, `npm start`.

| # | Action | Pass |
|---|--------|------|
| 1 | Clip slot → Generate TTS | Audio clip appears |
| 2 | TTS modal → Eleven v3 model | Speech generates with v3 stability |
| 3 | Arrangement selection → Generate SFX | Clip at selection |
| 4 | Multi clip slots → Batch TTS | All slots filled |
| 5 | Arrangement → Change Voice | Take lane clip |
| 6 | Audio clip → Transcribe | Transcript modal |
| 7 | Audio clip → Separate Stems (2-stem) | New tracks created |
| 8 | Audio track → Add Pronunciation Rule → TTS | Alias applied |
| 9 | Simpler → Generate SFX Sample | Sample replaced |
| 10 | Generate Music (music_v2) | Clip + song ID stored |
| 11 | Audio clip → Extend Music | Extended clip imported |
| 12 | Audio clip → Make Seamless Loop | Looping clip imported |

## Known limitations (document, don't block release)

- Extensions require Live 12.4.5 beta and Live 12 Suite
- No streaming import into Live
- Voice picker capped at 50 voices until v0.5.0 pagination
- Stem / music / clone features consume significant API credits

## Fixes applied before first public share (v0.4.0)

| Issue | Status |
|-------|--------|
| TTS modal ignored voice dropdown without manual override field | Fixed — submit reads `voiceSelect` |
| `api-key.txt` / `elevenlabs-config.json` not gitignored | Fixed |
| No post-build validation script | Fixed — `scripts/post-build-check.ts` |
| Roadmap listed batch TTS pronunciation as pending | Fixed — implemented in v0.4.0 |

## Remaining before share (recommended)

| Issue | Priority |
|-------|----------|
| Add `LICENSE` file | Medium |
| Commit or document `vendor/*.tgz` acquisition | High |
| Clone voices not merged into voice picker dropdown | Low (v0.5.0) |
| No user-facing error modal on pipeline failure | Low |
| `README.md` GitHub URL placeholder `YOUR_ORG` | Update on publish |
