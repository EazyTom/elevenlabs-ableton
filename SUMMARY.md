# README — Table of Contents

Quick navigation for **[README.md](README.md)** (`elevenlabs-ableton` v0.5.0).  
All section links use GitHub-flavored markdown anchors into the README.

---

## Overview

- [Ableton Extension: elevenlabs-ableton](README.md#ableton-extension-elevenlabs-ableton)
- [What's new in v0.5.0](README.md#whats-new-in-v050)
- [Screenshots](README.md#screenshots)
- [What's new in v0.4.0](README.md#whats-new-in-v040)

---

## User guide

### [ElevenLabs API Ableton Extension](README.md#elevenlabs-api-ableton-extension)

- [Current Capabilities](README.md#current-capabilities)
- [SFX, Music & Drum Rack modals](README.md#sfx-music--drum-rack-modals)
  - [Sound effects (`Generate SFX`)](README.md#sound-effects-generate-sfx)
  - [Music (`Generate Music`)](README.md#music-generate-music)
  - [Drum rack SFX (`Drum Rack` context menu)](README.md#drum-rack-sfx-drum-rack-context-menu)
- [Prerequisites](README.md#prerequisites)
- [Storage directory & API key](README.md#storage-directory--api-key)
  - [Where to keep `api-key.txt`](README.md#where-to-keep-api-keytxt)
  - [How to configure the storage directory](README.md#how-to-configure-the-storage-directory)
  - [How the API key is resolved](README.md#how-the-api-key-is-resolved)
- [Extension Host compatibility](README.md#extension-host-compatibility)
- [ElevenLabs plan limits](README.md#elevenlabs-plan-limits)
- [Install & run (pre-built `.ablx`)](README.md#install--run-pre-built-ablx)
- [Persisted settings (in your storage directory)](README.md#persisted-settings-in-your-storage-directory)

---

## Release & roadmap

- [Features by release](README.md#features-by-release)
- [Roadmap](README.md#roadmap)
  - [Shipped (v0.5.0)](README.md#shipped-v050)
  - [Shipped (v0.4.0)](README.md#shipped-v040)
  - [Planned (v0.6.0+)](README.md#planned-v060)

---

## Developers

- [Developers Guide](README.md#developers-guide)
  - [Architecture (short)](README.md#architecture-short)
  - [Project structure](README.md#project-structure)
  - [SDK & dependency versions](README.md#sdk--dependency-versions)
- [Getting started (Git / GitHub)](README.md#getting-started-git--github)
  1. [Clone the repository](README.md#1-clone-the-repository)
  2. [Install Node dependencies](README.md#2-install-node-dependencies)
  3. [Add Ableton SDK vendor packages](README.md#3-add-ableton-sdk-vendor-packages)
  4. [Configure the Extension Host path](README.md#4-configure-the-extension-host-path)
  5. [Configure storage directory & API key](README.md#5-configure-storage-directory--api-key)
  6. [Build and run in Live](README.md#6-build-and-run-in-live)
  7. [Enable in Live](README.md#7-enable-in-live)
- [Package for release](README.md#package-for-release)
- [Development workflow](README.md#development-workflow)
  - [Adding a new feature (convention)](README.md#adding-a-new-feature-convention)
  - [BMad Method](README.md#bmad-method)
- [npm scripts](README.md#npm-scripts)

---

## Project docs & community

- [Documentation index](README.md#documentation-index)
- [License & attribution](README.md#license--attribution)
- [Support & contributing](README.md#support--contributing)

---

## Related files (outside README)

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](CHANGELOG.md) | Release notes — [v0.5.0](CHANGELOG.md#v050) |
| [LICENSE](LICENSE) | GPL-3.0-or-later |
| [AGENTS.md](AGENTS.md) | Agent / contributor conventions |
| [docs/v0.5.0-features.md](docs/v0.5.0-features.md) | Latest feature spec |
| [docs/roadmap.md](docs/roadmap.md) | Detailed roadmap |
| [docs/pre-release-checklist.md](docs/pre-release-checklist.md) | Pre-tag checklist |
| [docs/project-context.md](docs/project-context.md) | Lean project context |

### Screenshots (`docs/`)

| Preview | File |
|---------|------|
| Context menus | [Extension-Menu.png](docs/Extension-Menu.png) |
| Text-to-Speech modal | [Generate-TTS.png](docs/Generate-TTS.png) |
| Sound Effects modal | [Generate-SFX.png](docs/Generate-SFX.png) |
| Music modal | [Generate-Music.png](docs/Generate-Music.png) |
| Dialogue modal | [Text-to-Dialogue.png](docs/Text-to-Dialogue.png) |
