# NAV AiDE — Phase 1 Data Pipeline and Core Resolution

Use this prompt in Copilot Agent mode to execute **Phase 1 only**.

## Goal

Generate or scaffold the offline data pipeline and implement the core resolution algorithms that can be tested in Node.js.

## Required outputs

- `assets/tubeGraph.json` schema + sample fixture strategy
- `scripts/data-pipeline/` scripts and README
- `pois.db` generation script scaffold
- `location_aliases.db` generation script scaffold
- definitions or loaders for:
  - `london.mbtiles`
  - `valhalla_tiles/`
  - `busRoutes.json`
- `src/core/routing/Dijkstra.ts`
- `src/core/poi/FuzzyMatcher.ts`
- `src/core/pipeline/EntityResolver.ts`
- unit tests for Dijkstra and EntityResolver

## Rules

- Do not skip the local resolution order.
- Do not use the LLM in EntityResolver.
- Keep everything testable outside React Native.

## Acceptance criteria

- All 7 offline assets are represented in code or pipeline scaffolding
- Dijkstra tests pass
- EntityResolver tests pass
- Confidence thresholds are implemented exactly as specified
