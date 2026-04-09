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
- `assemble-sqlite-dbs.js`: converts the generated SQL into real local SQLite database artifacts under `assets/data/`
- `validate-sqlite-dbs.ts`: validates the assembled DB files, FTS tables, seed rows, and DB-backed resolver path
- `build-tube-graph.js`: validates the graph seed and rewrites `assets/tubeGraph.json`
- `generate-bus-routes.js`: validates the route seed and rewrites `assets/busRoutes.json`
- `generate-pois-db.js`: emits `pois.db` schema and seed SQL scaffolding
- `generate-location-aliases-db.js`: emits `location_aliases.db` schema and seed SQL scaffolding from local station data only

## Generated Schema Contracts

`pois.db` scaffold:

- table: `pois`
- columns: `id`, `canonical_name`, `category`, `latitude`, `longitude`, `zone`, `search_terms`
- assembly step: creates `pois_fts` as an SQLite FTS5 virtual table backed by the scaffolded seed data

`location_aliases.db` scaffold:

- table: `location_aliases`
- columns: `alias`, `normalized_alias`, `canonical_name`, `entity_type`, `source`
- index plan: `normalized_alias` unique index for exact/alias lookup before fuzzy matching
- assembly step: creates `location_aliases_fts` as an SQLite FTS5 virtual table for offline alias search support

## Local Commands

Run all Stage 2 pipeline scaffolds:

```bash
npm run stage2:sql
```

Run individual scaffold steps:

```bash
node scripts/data-pipeline/build-tube-graph.js
node scripts/data-pipeline/generate-bus-routes.js
node scripts/data-pipeline/generate-pois-db.js
node scripts/data-pipeline/generate-location-aliases-db.js
```

Assemble real SQLite database files from the generated SQL:

```bash
npm run stage2:assemble
```

Validate the resulting DB files:

```bash
npm run stage2:validate
```

Validate the Node-first Stage 2 code path:

```bash
npm run stage2:test
```

## Fixture-Based vs Production-Ready

- `assets/tubeGraph.json` and `assets/busRoutes.json` use deterministic London fixtures rather than full licensed production exports
- `assets/data/pois.db` and `assets/data/location_aliases.db` are real SQLite files assembled locally from fixture SQL and safe for Node-first testing
- `london.mbtiles` and `valhalla_tiles/` are represented in the asset registry but still require external offline data packaging in a later stage

## External Data Still Needed Later

- TfL or licensed offline exports for the full Tube graph and bus route network
- curated POI exports suitable for SQLite FTS5 ingestion
- mobile-ready packaging of the assembled `.db` artifacts alongside future production data ingestion

This stage stays local-only and Node-testable by design.