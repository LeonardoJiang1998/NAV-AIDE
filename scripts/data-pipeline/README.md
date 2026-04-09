# NAV AiDE Phase 1 Data Pipeline

This directory scaffolds the offline asset pipeline required by Phase 1.

## Offline Asset Coverage

The Phase 1 scaffold represents these offline assets in code or scripts:

1. `assets/tubeGraph.json`
2. `assets/busRoutes.json`
3. `london.mbtiles`
4. `valhalla_tiles/`
5. `pois.db`
6. `location_aliases.db`
7. station alias seed data sourced from `scripts/prompt-validation/fixtures/stations.json`

## Resolution Order

`raw query -> exact canonical match -> exact alias match -> fuzzy canonical/alias match -> disambiguation -> unresolved`

EntityResolver thresholds are explicit in `src/core/pipeline/EntityResolver.ts`:

- `EXACT_MATCH_THRESHOLD = 1.0`
- `ALIAS_MATCH_THRESHOLD = 0.93`
- `FUZZY_RESOLVE_THRESHOLD = 0.78`
- `DISAMBIGUATION_THRESHOLD = 0.72`
- `MIN_SCORE_GAP = 0.05`

If the best candidate is below the resolve threshold but above the disambiguation threshold, the resolver returns a disambiguation result instead of guessing.

## Scripts

- `generate-pois-db.js`: scaffolds SQL seed output for the future `pois.db`
- `generate-location-aliases-db.js`: scaffolds SQL seed output for the future `location_aliases.db`
- `build-tube-graph.js`: validates and copies the sample graph fixture into `assets/tubeGraph.json`

## Running the Scaffolds

```bash
node scripts/data-pipeline/build-tube-graph.js
node scripts/data-pipeline/generate-pois-db.js
node scripts/data-pipeline/generate-location-aliases-db.js
```

These commands do not create final production databases yet. They provide deterministic fixtures and SQL scaffolding so the Phase 1 logic can be tested in Node.js.