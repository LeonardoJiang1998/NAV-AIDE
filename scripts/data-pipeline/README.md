# NAV AiDE Stage 2 Data Pipeline

This directory contains the Node-first offline data scaffolding for Stage 2. It builds deterministic local fixtures and database-generation scaffolds without introducing network dependencies or React Native runtime work.

## Offline Asset Coverage

Stage 2 represents these offline assets in code or pipeline scaffolding:

1. `assets/tubeGraph.json`
2. `assets/busRoutes.json`
3. `london.mbtiles`
4. `valhalla_tiles/`
5. `pois.db`
6. `location_aliases.db`
7. station alias seed data sourced from `scripts/prompt-validation/fixtures/stations.json`

## Resolution Order

`raw query -> exact canonical match -> exact alias match -> fuzzy canonical/alias match -> disambiguation -> unresolved`

EntityResolver thresholds are explicit in `src/core/pipeline/EntityResolver.ts` and must remain unchanged in this stage:

- `EXACT_MATCH_THRESHOLD = 1.0`
- `ALIAS_MATCH_THRESHOLD = 0.93`
- `FUZZY_RESOLVE_THRESHOLD = 0.78`
- `DISAMBIGUATION_THRESHOLD = 0.72`
- `MIN_SCORE_GAP = 0.05`

If the best candidate is below the resolve threshold but above the disambiguation threshold, the resolver must return disambiguation instead of guessing.

## Directory Layout

- `seeds/`: deterministic JSON seed inputs that remain safe for local Node tests
- `generated/`: emitted SQL scaffolds and manifests for future SQLite assembly
- `build-tube-graph.js`: validates the graph seed and rewrites `assets/tubeGraph.json`
- `generate-bus-routes.js`: validates the route seed and rewrites `assets/busRoutes.json`
- `generate-pois-db.js`: emits `pois.db` schema and seed SQL scaffolding
- `generate-location-aliases-db.js`: emits `location_aliases.db` schema and seed SQL scaffolding from local station data only

## Generated Schema Contracts

`pois.db` scaffold:

- table: `pois`
- columns: `id`, `canonical_name`, `category`, `latitude`, `longitude`, `zone`, `search_terms`
- index/FTS plan: keep `search_terms` ready for a future SQLite FTS5 virtual table without making this stage depend on native SQLite tooling

`location_aliases.db` scaffold:

- table: `location_aliases`
- columns: `alias`, `normalized_alias`, `canonical_name`, `entity_type`, `source`
- index plan: `normalized_alias` unique index for exact/alias lookup before fuzzy matching

## Local Commands

Run all Stage 2 pipeline scaffolds:

```bash
npm run stage2:data
```

Run individual scaffold steps:

```bash
node scripts/data-pipeline/build-tube-graph.js
node scripts/data-pipeline/generate-bus-routes.js
node scripts/data-pipeline/generate-pois-db.js
node scripts/data-pipeline/generate-location-aliases-db.js
```

Validate the Node-first Stage 2 code path:

```bash
npm run stage2:test
```

## What Is Scaffolded Only

- `pois.db` and `location_aliases.db` are not binary SQLite files yet; the scripts emit schema SQL, seed SQL, and manifest metadata under `scripts/data-pipeline/generated/`
- `assets/tubeGraph.json` and `assets/busRoutes.json` use deterministic London fixtures rather than full licensed production exports
- `london.mbtiles` and `valhalla_tiles/` are represented in the asset registry but still require external offline data packaging in a later stage

## External Data Still Needed Later

- TfL or licensed offline exports for the full Tube graph and bus route network
- curated POI exports suitable for SQLite FTS5 ingestion
- a repeatable SQLite assembly step that turns the emitted SQL scaffolds into shipping `.db` artifacts

This stage stays local-only and Node-testable by design.