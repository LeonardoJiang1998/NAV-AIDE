# NAV AiDE — Phase 5 Native Offline Runtime

Use this prompt in Copilot Agent mode to execute **Phase 5 only**.

## Goal

Replace Phase 4 shell placeholders with real on-device runtime paths for assets, voice, and local model inference.

## Required work

1. Implement a real offline asset lifecycle:
   - download orchestration for required asset bundles
   - checksum validation and failure handling
   - local status persistence for downloaded assets
2. Replace model-loading placeholders with a real `llama.rn` integration path using the downloaded local GGUF model only.
3. Replace voice capability placeholders with real OS STT and OS TTS wiring in GO and LOST? flows.
4. Back the shell state with real local storage where needed so asset, permission, and feedback state survive app restarts.
5. Keep the existing Node.js pipeline contracts valid while the mobile runtime becomes native-backed.

## Rules

- Do not introduce any cloud AI API or remote fallback.
- Do not let the LLM perform routing, POI lookup, or free-form London reasoning.
- Continue rejecting hallucinated place names before they reach the UI.
- Preserve offline-first behavior when the network is unavailable.
- Do not expand scope into new product features unrelated to native runtime hardening.

## Acceptance criteria

- Offline assets can be downloaded, validated, and surfaced with explicit failure states.
- The app loads Gemma 4 E2B through `llama.rn` from a local asset path.
- GO and LOST? use OS speech services instead of capability stubs.
- Local state needed for offline operation persists across app restarts.
- Existing build, test, and bundle validation still pass.