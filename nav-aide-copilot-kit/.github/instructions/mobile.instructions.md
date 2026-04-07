---
applyTo: "src/**/*.ts,src/**/*.tsx,tests/**/*.ts,tests/**/*.tsx,scripts/**/*.ts,scripts/**/*.js,assets/**/*.json,android/**,ios/**"
---
# NAV AiDE mobile implementation instructions

These instructions apply to the React Native mobile app, tests, and supporting pipeline scripts.

## Scope

Build a React Native (bare workflow) MVP for NAV AiDE with exactly 4 menus:
- GO
- LOST?
- Maps
- Settings

## Architecture rules

- Voice input: `react-native-voice` using OS STT
- Voice output: `react-native-tts` using OS TTS
- LLM: Gemma 4 E2B via `llama.rn` only
- Maps: `@maplibre/maplibre-react-native`
- Transport routing: custom Dijkstra in TypeScript
- Walking routing: Valhalla using offline prebuilt graph
- POI search: SQLite FTS5
- Location resolution: local alias index + EntityResolver
- File downloads: `react-native-fs`
- Navigation: `@react-navigation/bottom-tabs`

## Do not build

- user accounts
- cloud AI calls
- Expo Go support
- LiteRT-LM integration in MVP
- camera OCR features (v2 only)
- Santander Cycles routing (dock locations only in MVP)
- journey history (v2)

## Query pipeline contract

Always preserve this sequence:

`rawInput -> FuzzyMatcher fast path -> IntentExtractor -> EntityResolver -> POIService / Dijkstra -> ValhallaBridge -> ResponseRenderer`

Notes:
- EntityResolver is mandatory before routing/search.
- The LLM must not resolve locations.
- If confidence is below threshold, show disambiguation instead of guessing.

## Error-handling expectations

Every user-facing screen must explicitly handle:
- assets not downloaded
- model loading
- no GPS permission
- underground / last known location
- invalid JSON from LLM
- hallucinated locations
- no route found
- low-confidence STT
- signpost not resolved
- Ask People no match
- offline with cache
- offline without cache
- download failure
- checksum mismatch

## Code quality expectations

- Use TypeScript strict mode.
- Keep modules small and focused.
- Prefer pure functions for routing, matching, and resolution.
- Keep data contracts explicit with interfaces.
- Keep platform-specific code minimal and isolated.

## Test expectations

- Dijkstra, FuzzyMatcher, EntityResolver, and QueryPipeline must be testable outside the app.
- Golden tests must remain easy to extend.
- Add hallucination assertions for rendered output.
