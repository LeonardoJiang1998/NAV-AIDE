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

## Pre-Shell Handoff

Safe to carry into Phase 3 unchanged:

- `src/core/routing/Dijkstra.ts`
- `src/core/poi/FuzzyMatcher.ts`
- `src/core/poi/POIService.ts`
- `src/core/pipeline/EntityResolver.ts`
- `src/core/pipeline/QueryPipeline.ts`
- `src/core/pipeline/createQueryPipelineRuntime.ts`
- `src/core/llm/IntentExtractor.ts`
- `src/core/llm/ResponseRenderer.ts`
- `src/core/services/DisruptionService.ts`
- `src/core/runtime/ModelAdapterContracts.ts`
- `src/core/runtime/OfflineRuntimeContracts.ts`

RN-specific adapters still needed in the next phase:

- `src/core/pipeline/NodeFixtureAssetLoader.ts`: Node fixture loader only, not a mobile asset loader
- `src/core/pipeline/SqliteEntityRecordLoader.ts`: depends on `node:child_process` and the `sqlite3` CLI
- `src/analytics/DeviceID.ts`: depends on `node:crypto`
- model adapters that call `llama.rn`
- SQLite adapters backed by `react-native-sqlite-storage`
- disruption-cache and walking-routing asset readers backed by mobile file storage

Known RN compatibility risks before shell work:

- direct `node:` imports are not portable to React Native
- CLI-driven SQLite access must be replaced with RN SQLite bindings
- JSON import-attribute usage should stay isolated in Node-only loaders
- offline asset path resolution must move behind RN file-system adapters in Phase 3

## Phase 3A Setup

Install JavaScript dependencies:

```bash
npm install
```

Install iOS pods:

```bash
cd ios && pod install && cd ..
```

Phase 3A verification:

```bash
npm run build
npm test
npm run bundle:ios
npm run bundle:android
```

Added Phase 3A runtime wiring:

- no new JavaScript dependencies were added in this pass; the runtime adapters are built on the existing `llama.rn`, `react-native-fs`, and `react-native-sqlite-storage` dependencies already present in the repo
- `createMobilePipeline()` now composes RN asset resolution, RN-safe device ID generation, `llama.rn` model adapters, and RN SQLite validation behind the shared runtime contracts
- the shell remains screen-light on purpose; this phase only prepares the runtime and bundle path for later feature screens

Platform-specific steps:

- iOS: run `cd ios && pod install && cd ..` after dependency changes and before building in Xcode or on simulator/device
- Android: the current Gradle setup uses React Native autolinking; no extra manual linking was needed for this pass
- if `react-native-sqlite-storage` prints the existing configuration warning during bundling, keep the package installed and verify native config with `npx react-native config`; bundling still succeeds in the current repo state

Runtime asset placement:

- bundled JSON fixtures continue to provide `tubeGraph.json` and `busRoutes.json`
- runtime-resolved assets are searched under the app document, library, cache, and main bundle roots in that order
- the model file is expected at `models/gemma4-e2b.gguf`
- SQLite assets are expected at `data/pois.db` and `data/location_aliases.db`
- optional disruption cache is expected at `cache/disruptions.json`
- walking-routing assets are expected under `valhalla_tiles/`

Simulator versus physical device:

- simulator validation is best for Metro bundling, shell boot, and adapter wiring checks
- physical device validation is still needed for real `llama.rn`, on-device file placement, microphone permissions, and native SQLite behavior against shipped assets
- until production assets are copied into device-visible paths, the pipeline falls back to rule-based adapters so the shell can still invoke the runtime without full UI work

## Phase 3C Physical Device Demo Setup

Exact asset placement paths are relative to the app sandbox. The shell searches these roots in order:

- app Documents
- app Library
- app Caches
- Android external app files directory when available
- app main bundle

Required relative paths:

- `models/gemma4-e2b.gguf`
- `data/pois.db`
- `data/location_aliases.db`
- `maps/london.mbtiles`
- `routing/valhalla_tiles/`
- optional: `cache/disruptions.json`

Physical device setup steps:

1. Install the app on the device once so the sandbox exists.
2. iOS device:
	Place demo assets into the app Documents container for bundle ID `org.reactjs.native.example.NavAideShell` using Finder file sharing or Xcode device container access. The target relative paths are `Documents/models/gemma4-e2b.gguf`, `Documents/data/pois.db`, `Documents/data/location_aliases.db`, `Documents/maps/london.mbtiles`, and `Documents/routing/valhalla_tiles/`.
3. Android device:
	Place demo assets into the app files directory for application ID `com.navaideshell`. The most practical demo path is `/storage/emulated/0/Android/data/com.navaideshell/files/` with the same relative layout: `models/gemma4-e2b.gguf`, `data/pois.db`, `data/location_aliases.db`, `maps/london.mbtiles`, and `routing/valhalla_tiles/`.
4. Launch the app and open Settings.
5. Tap `Refresh status` to rerun model, SQLite, map, walking-asset, and disruption-cache checks.
6. On Android, tap `Request Android demo permissions` to request microphone and location access. On iOS, validate the microphone and location prompts on first use because the shell can only scaffold those checks without an additional permission library.
7. Confirm the Settings screen reports `real-asset-mode` before presenting a full internal device-backed demo.

Device-backed versus fallback expectations:

- `real-asset-mode` means the local GGUF model loaded, SQLite runtime mode is active, MBTiles are present, walking tiles are present, and STT/TTS runtime checks passed.
- `fixture-fallback-mode` remains explicit whenever any of those checks fail or assets are missing.
- fallback mode is acceptable for shell walkthroughs, but it should not be presented as a full offline-device demo.

## Product Notes

NAV AiDE is multilingual, offline-first, and built for London travel, with planned emphasis on offline maps, door-to-door directions, and the LOST? helper. The MVP remains local-data-first and does not use cloud AI APIs.
