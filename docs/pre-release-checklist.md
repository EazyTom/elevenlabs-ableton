# Pre-release checklist

Run before tagging a release or publishing to GitHub.

## Automated

Run locally before tagging a release. GitHub CI does not run on push or pull request (`workflow_dispatch` only).

```bash
npm run smoke                 # build + fake-host + API (does not start or connect to Live)
npm run smoke -- --music      # also run the credit-gated music v2.5 test
npm run smoke:live:12         # optional, only when you have already opened Live 12
npm run smoke:live:13         # optional, only when you have already opened Live 13
```

Optional (costs API credits):

```bash
npm run test:music           # music v2.5 composeDetailed + one seamless-loop inpaint
npm run smoke -- --music     # smoke, then the music test
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

Requires Live 12.4.15 beta or Live 13.0 beta, Developer Mode, `npm start` (`start:12` or `start:13`). Run the manual table once on each beta.

| # | Action | Pass |
|---|--------|------|
| 1 | Clip slot → Generate TTS | Audio clip appears, named and colored. Eleven v4 is in the model list |
| 2 | TTS modal → voice filters | Dropdowns narrow the voice list, including cloned voices |
| 3 | Arrangement selection → Generate SFX | Clip at selection |
| 4 | Generate Music (music v2.5) with locators | Clip plus arrangement locators |
| 5 | Audio clip → Extend Music | Imported clip is not truncated to the source length |
| 6 | Dialogue v4 with locators | Speaker locators on the arrangement |
| 7 | Transcribe with locators | Sentence locators |
| 8 | Voice changer / isolation / Scribe with Record File Type AIFF | Audio accepted |

## Known limitations (document, don't block release)

- Extensions require Live 12.4.15 beta or Live 13.0 beta. Retail Live 12.4.x has no Extension Host
- No streaming import into Live
- Voice picker loads up to 150 voices (3 pages) and filters them in the modal
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
| Add `LICENSE` file | Done — GPL-3.0-or-later |
| Commit or document `vendor/*.tgz` acquisition | High — tarballs are local, not on public npm |
| Clone voices not merged into voice picker dropdown | Done in v0.8.0 |
| No user-facing error modal on pipeline failure | Low |
| `README.md` GitHub URL placeholder `YOUR_ORG` | Update on publish |
