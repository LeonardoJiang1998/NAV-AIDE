# NAV AiDE

NAV AiDE is an offline-first London travel assistant for international tourists. The MVP is designed to keep core travel guidance available in airplane mode using local routing data, local entity resolution, OS speech services, and on-device AI.

Tagline: Your AI London guide. Works underground.

## Current Scope

The repository currently includes:

- Node-first offline data pipeline scaffolding under `scripts/data-pipeline/`
- local routing and resolution modules under `src/core/`
- unit tests for Dijkstra and EntityResolver under `tests/unit/`
- a static GitHub Pages intro site under `docs/`

This stage does not add React Native screens or cloud-backed services.

## Stage 2 Local Runbook

Install dependencies:

```bash
npm install
```

Generate the deterministic offline data scaffolds:

```bash
npm run stage2:data
```

Compile and run the Node-first verification path:

```bash
npm run stage2:test
```

Run only the unit tests:

```bash
npm test
```

## What Stage 2 Implements

Fully implemented in this repo:

- `src/core/routing/Dijkstra.ts`
- `src/core/poi/FuzzyMatcher.ts`
- `src/core/pipeline/EntityResolver.ts`
- Node-testable unit coverage for Dijkstra and EntityResolver
- local fixture assets for `tubeGraph.json` and `busRoutes.json`
- generation scaffolds for `pois.db` and `location_aliases.db`

Scaffolded only in this stage:

- `pois.db` and `location_aliases.db` are emitted as schema-plus-seed SQL scaffolds, not packaged binary SQLite files
- `london.mbtiles` and `valhalla_tiles/` remain declared offline assets pending later ingestion work
- Tube and bus assets use deterministic London fixture seeds rather than full production network exports

Still requiring external data or manual setup later:

- full licensed/offline transport datasets
- curated POI export ingestion for SQLite FTS5
- final SQLite assembly of generated SQL into shipping `.db` files

## Stage 2 Commands

Individual commands:

```bash
node scripts/data-pipeline/build-tube-graph.js
node scripts/data-pipeline/generate-bus-routes.js
node scripts/data-pipeline/generate-pois-db.js
node scripts/data-pipeline/generate-location-aliases-db.js
npm run build
npm test
```

## Product Notes

NAV AiDE is multilingual, offline-first, and built for London travel, with planned emphasis on offline maps, door-to-door directions, and the LOST? helper. The MVP remains local-data-first and does not use cloud AI APIs.
