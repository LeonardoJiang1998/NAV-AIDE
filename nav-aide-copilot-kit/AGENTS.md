# NAV AiDE Agent Instructions

This repository supports Copilot cloud agent and IDE agents.

## Mission

Build NAV AiDE as an offline-first London travel assistant MVP and maintain a simple GitHub Pages marketing site.

## Priorities

1. Respect the offline-first architecture.
2. Follow the phase order.
3. Prefer small, safe, testable changes.
4. Keep mobile app work and docs-site work cleanly separated.

## Must-follow technical rules

- OS STT for speech input
- OS TTS for speech output
- Gemma 4 E2B via `llama.rn` only
- EntityResolver required before routing/search
- No cloud AI APIs
- No Expo Go
- No accounts/login in MVP
- No LiteRT-LM in MVP

## Task execution guidance

- When asked to build the app, start from the earliest unfinished phase.
- When asked to work on the site, limit changes to `docs/` unless documentation updates are also required.
- When modifying mobile code, consult `.github/instructions/mobile.instructions.md`.
- When modifying docs or GitHub Pages content, consult `.github/instructions/docs.instructions.md`.

## Refusal conditions

Do not introduce any architecture change that makes core routing, POI search, map rendering, voice I/O, or LLM inference depend on the network.
