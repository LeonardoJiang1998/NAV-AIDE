# NAV AiDE

NAV AiDE is an offline-first London travel assistant for international tourists. The MVP is designed to keep core travel guidance available in airplane mode using local routing data, local entity resolution, OS speech services, and on-device AI.

Tagline: Your AI London guide. Works underground.

## Current Scope

The repository currently includes:

- Node-first offline data pipeline scaffolding under `scripts/data-pipeline/`
- local routing and resolution modules under `src/core/`
- unit tests for Dijkstra and EntityResolver under `tests/unit/`
- integrated QueryPipeline golden coverage under `tests/golden/`
- a static GitHub Pages intro site under `docs/`

This stage does not add React Native screens or cloud-backed services.

## Stage 2 Local Runbook

Install dependencies:

```bash
npm install
```

Generate the deterministic fixture-based JSON assets and SQL scaffolds:

```bash
npm run stage2:sql
```

Assemble real local SQLite artifacts from the generated SQL:

```bash
npm run stage2:assemble
```

Validate the assembled DB files, FTS tables, seed rows, and DB-backed EntityResolver path:

```bash
npm run stage2:validate
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
- `src/core/pipeline/SqliteEntityRecordLoader.ts`
- `src/core/pipeline/QueryPipeline.ts`
- `src/core/llm/IntentExtractor.ts`
- `src/core/llm/ResponseRenderer.ts`
- `src/core/poi/POIService.ts`
- `src/core/routing/ValhallaBridge.ts`
- Node-testable unit coverage for Dijkstra and EntityResolver
- golden-case integration coverage for route, fare, POI lookup, nearest-station, lost-help, disambiguation, and unresolved flows
- local fixture assets for `tubeGraph.json` and `busRoutes.json`
- generation scaffolds for `pois.db` and `location_aliases.db`
- repeatable local assembly of `assets/data/pois.db` and `assets/data/location_aliases.db`
- validation of tables, FTS tables, seed rows, and DB-backed resolution

Fixture-based but fully buildable in this stage:

- `assets/tubeGraph.json` and `assets/busRoutes.json` are deterministic London fixtures rather than full licensed production network exports
- `assets/data/pois.db` and `assets/data/location_aliases.db` are real SQLite files built locally from deterministic fixture SQL scaffolds

Still scaffolded only in this stage:

- `london.mbtiles` and `valhalla_tiles/` remain declared offline assets pending later ingestion work

Still requiring external data or manual setup later:

- full licensed/offline transport datasets
- curated POI export ingestion for SQLite FTS5
- production-grade assembly/packaging of those assets into mobile shipping bundles
- native React Native shell, map, download, and voice integration from the next phase onward

## Stage 2 Commands

Individual commands:

```bash
node scripts/data-pipeline/build-tube-graph.js
node scripts/data-pipeline/generate-bus-routes.js
node scripts/data-pipeline/generate-pois-db.js
node scripts/data-pipeline/generate-location-aliases-db.js
node scripts/data-pipeline/assemble-sqlite-dbs.js
tsx scripts/data-pipeline/validate-sqlite-dbs.ts
npm run build
npm test
```

## Product Notes

NAV AiDE is multilingual, offline-first, and built for London travel, with planned emphasis on offline maps, door-to-door directions, and the LOST? helper. The MVP remains local-data-first and does not use cloud AI APIs.
