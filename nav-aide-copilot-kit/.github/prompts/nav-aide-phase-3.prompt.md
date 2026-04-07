# NAV AiDE — Phase 3 React Native Shell

Use this prompt in Copilot Agent mode to execute **Phase 3 only**.

## Goal

Create the React Native bare-workflow shell and wire the model/download/map foundations.

## Required work

1. Scaffold the bare React Native TypeScript app.
2. Add dependency setup for:
   - bottom tabs
   - MapLibre
   - Voice
   - TTS
   - SQLite
   - RN FS
   - llama.rn
   - Fuse.js
3. Build:
   - DownloadScreen
   - asset manager scaffolding
   - manifest checker
   - 4-tab navigation shell
4. Add offline map integration points for MBTiles.
5. Add `llama.rn` integration skeleton for local GGUF model loading.

## Do not build yet

- final feature-complete GO flow
- LOST? resolution UI details
- complete Settings flows

## Acceptance criteria

- App shell builds
- 4-tab structure exists
- download flow is scaffolded
- model-loading path exists
- offline map layers are structurally supported
