# NAV AiDE — Next Steps Plan

## Current State Summary

The app runs on-device with real London data and real LLM inference:

- **4 screens complete** — GO, LOST?, Maps, Settings render with live diagnostics
- **Real data** — 435 TfL Underground / DLR / Elizabeth / Overground stations, 575 edges, 860 OSM POIs, 478 location aliases
- **Real LLM** — Gemma 3 1B IT Q4_K_M (769 MB) loads via `llama.rn` and produces valid structured JSON intent + rendered responses
- **Verified on device** — iPhone 12 Pro Max (iOS 26.3.1) runs full query pipeline end-to-end in 6–26 s per query
- **72/72 tests pass**, TypeScript compiles clean, both platform bundles succeed

See [`project_phase2_complete.md`](../.claude/projects/-Users-yoda-Desktop-NAV-AIDE/memory/project_phase2_complete.md) for the phase history.

---

## What's Done ✓

### Phase 1 — Test Coverage Expansion
- DisruptionService test type error fixed
- Golden tests cover multi-leg routes, disambiguation, and hallucination checks
- Unit coverage across Dijkstra, EntityResolver, asset loaders, model bridge

### Phase 2 — Production Data Pipeline
- **Tube graph**: 35 fixture stations → **435 real stations**, 110 edges → **575 edges**. Source: TfL Line Sequence API (11 tube lines + DLR + Elizabeth line + 6 Overground branches). Resolves TfL HUB IDs vs stop-point IDs via `stopPointSequences[].stopPoint`.
- **Location aliases**: ~50 rows → **478 rows**. Regenerated from the live tube graph so the alias index always matches deployed stations. Handles `&` / `and`, `Street` / `St`, apostrophe variants.
- **POIs**: 3 fixture POIs → **860 real POIs** (museum 117, gallery 225, landmark 306, theatre 97, arts_centre 53, viewpoint 39, park 16, zoo 4, aquarium 2, attraction 1). Source: OSM Overpass API.
- **Pipeline scripts**: `build-tube-graph-from-tfl.js` and `build-pois-from-osm.js` committed alongside raw source snapshots in `scripts/data-pipeline/tfl-source/`, so the pipeline is fully reproducible offline.

### Phase 4 (partial) — Gemma model integration
- Gemma 3 1B IT Q4_K_M GGUF (769 MB) deployed and verified on both simulator and physical device
- Gemma 4 E2B Q4_K_M (3.2 GB) downloaded and saved, but **`llama.rn` 0.5.11 only supports `gemma` / `gemma2` / `gemma3` architectures** — Gemma 4 requires `llama.rn` 0.12.0-rc.8 or newer
- Adapter code switched from raw `prompt` to `messages: [{ role, content }]` format so `llama.rn` applies the Gemma chat template automatically
- Release-build scripts (`ios:release`, `ios:device-release`) added for airplane-mode testing with embedded JS bundle

### Phase 5 (partial) — Real-Device Validation
- iPhone 12 Pro Max (iOS 26.3.1) end-to-end verified:
  - "How do I get from Waterloo to Baker Street?" → 25.8 s, intent/origin/destination correct, rendered 8-min Jubilee route
  - "Find the British Museum" → 3.4 s, `poi_lookup` intent + rendered response
  - "Take me to Waterloo" → 7.5 s, destination-only route (rule-based bridge could not parse this)
  - `llama.rn` model loads from `Documents/models/gemma4-e2b.gguf`
  - Certificate trust flow documented
- iOS microphone permission guard fixed in `VoiceServices.ts` — was blocking the voice-search button on device because iOS permission state stayed `'unknown'`
- DEV-only remote-probe harness: pipeline exposed on `globalThis.__NAVAIDE_PIPELINE` via the Metro debugger, runs queries without UI interaction (used to get around macOS focus-management issues during automation)

---

## Known Issues (next session)

### ⚠ SQLite runtime silent hang on iOS (high priority)
When the app tries to open the deployed `Documents/data/pois.db` and `Documents/data/location_aliases.db`, `react-native-sqlite-storage` hangs without throwing. As a result the app falls back to the bundled fixture entities / POIs even though the database files exist at the expected paths.

Impact:
- Routing still works (tube graph is a JSON asset, imported into the JS bundle).
- POI lookup is limited to the fixture until this is fixed — "Find the British Museum" matches because the string is in the fallback fixture, but the other 859 POIs are unreachable from the UI.

Suspected cause: `SQLite.openDatabase({ name: absolutePath, location: 'default', readOnly: true })` in `src/app/storage/ReactNativeSQLiteAdapter.ts` combines an absolute path with `location: 'default'`, which the library may not expect. Try either:
1. Drop `location: 'default'` and pass just the absolute path, or
2. Switch to `location: 'Documents'` + the relative path `data/pois.db` (matching how the library usually resolves Documents-container paths on iOS).

### ⚠ `initializeRuntime()` occasionally hangs on device
Seen on iPhone 12 Pro Max — `mobilePipeline.initializeRuntime()` never resolves on some launches, which means `AppShellContext.refreshSystemState` stays in the initial state. Likely caused by the same SQLite adapter issue above (the probe awaits `sqliteAdapter.validateAsset` when the files exist, and that never returns). Fixing the SQLite adapter should unblock this.

### Gemma 3 1B sometimes flips origin/destination
Observed on real-data queries: "Waterloo to Baker Street" occasionally extracted as `origin=Baker Street, destination=Waterloo`. The route itself is correct but reversed. A 4B model (or Gemma 4 E2B once `llama.rn` updates) should resolve this — the 1B model is at the edge of what structured JSON extraction needs.

### Unknown-intent fallback
"Where is Hampstead?" currently returns `intent: "unknown"`. The rule-based bridge doesn't map "where is X" to `nearest_station`, and Gemma 3 1B doesn't either. Either add a "where is …" regex rule in the rule bridge or tune the Gemma prompt.

---

## Phase 3 — Walking Route Implementation (still open)

`ValhallaBridge` returns the `asset-unavailable` stub. Remaining work as previously planned:

### 3.1 Evaluate Valhalla native module options
- Assess `valhalla-napi` or a custom C++ bridge for React Native
- Determine GGUF tile size requirements for Central London walking graph
- Decide: full native Valhalla binding vs. simplified A* on OSM extract

### 3.2 Implement native walking router
- Build or integrate the chosen native module, wire into `ValhallaBridge`
- Provide real distance, duration, and step-by-step walking instructions

### 3.3 Generate and bundle walking tiles
- Extract Central London walking graph from OSM data
- Package as offline Valhalla tiles and add to the asset manifest + download flow

---

## Phase 4 — Asset Packaging (partial)

### 4.1 Gemma model ✓ (Gemma 3 1B deployed; Gemma 4 E2B pending `llama.rn` upgrade)
- Once `llama.rn` 0.12+ stabilises, swap in Gemma 4 E2B Q4_K_M (`~/Desktop/NAV-AIDE-assets/models/gemma4-e2b.gguf`).
- Risk: 0.12 went through 9 RCs — test in a worktree before promoting.

### 4.2 Offline map tiles
- Generate Greater London MBTiles from OSM PBF using `tilemaker` or similar, zooms 8–18
- Place at `Documents/maps/london.mbtiles` on device
- Validate MapLibre rendering on both platforms

### 4.3 Asset download flow validation
- Test `DownloadService` end-to-end with real asset sizes
- Validate checksum verification, retry logic, progress reporting, interrupted/resumed downloads
- Update `assetManifest.ts` with real SHA-256 checksums (currently `awaiting-asset-*` placeholders)

### 4.4 App bundle size audit
- Measure total with bundled fixtures vs. downloaded assets
- Targets: <100 MB initial install, <2 GB with all downloaded assets

---

## Phase 5 — Real-Device Validation (remaining)

### 5.1 iOS physical device (partial — inference verified, rest pending)
- ✅ `llama.rn` model load from Documents container
- ⏳ Microphone permissions on device (guard fixed, end-to-end STT not retested)
- ⏳ `react-native-voice` STT in multiple languages
- ⏳ `react-native-tts` output validation
- ⏳ GPS location services (no geolocation package installed yet — `@react-native-community/geolocation` required)
- ⏳ Offline map rendering from MBTiles (depends on 4.2)
- ⏳ Full GO-screen UI query flow (depends on SQLite fix above so the UI doesn't stall on `initializeRuntime`)

### 5.2 Android physical device testing
All bullets as originally planned — Android not touched this session.

### 5.3 Offline resilience testing
- Release build (`npm run ios:release`) bundles the JS, enabling airplane-mode testing. Not yet run end-to-end on device.
- Verify graceful degradation when specific assets are missing
- Confirm `fixture-fallback-mode` vs `real-asset-mode` reporting is accurate

### 5.4 Performance benchmarking
- Measured on iPhone 12 Pro Max (CPU-only, A14 Bionic):
  - Route query (Waterloo → Baker Street): **25.8 s** including 1B model prefill
  - POI lookup: **3.4 s**
  - Model load: ~10 s on first query, warm thereafter
- Pending: Dijkstra-only time on full 435-station graph, SQLite FTS query time (after the adapter fix), target-tracking against <2 s route / <500 ms POI goals

---

## Phase 6 — CI/CD (existing workflow)

GitHub Actions is already wired up for build + test + data-pipeline verification (see commit `846e15a`). Future additions:
- Pre-commit hooks (TypeScript type checking, ESLint)
- Release automation (Fastlane, TestFlight / Play Internal)
- Bundle-size regression checks

---

## Phase 7 — Docs Site and Launch Prep

Unchanged from the original plan — still pending. Real device screenshots, privacy policy, waitlist backend, App Store prep.

---

## Recommended Priority Order (updated)

| Priority | Item | Rationale |
|---|---|---|
| 1 | **Fix SQLite runtime hang** (`ReactNativeSQLiteAdapter.ts`) | Unblocks 859 POIs in the UI and stops `initializeRuntime` stalls. Small change, big impact. |
| 2 | **Gemma 4 E2B upgrade** (when `llama.rn` 0.12 stabilises) | Fixes origin/destination flipping; "Effective 2B" at ~3 GB is our declared target. |
| 3 | **Add `@react-native-community/geolocation`** | Currently no iOS location permission prompt — "GPS permission" toggle in Settings is purely cosmetic. Required for underground-safe last-known-location behaviour. |
| 4 | **Phase 4.2 — offline map tiles** | Makes the Maps screen actually useful; unlocks end-to-end demo. |
| 5 | **Phase 3 — walking routes** | Needed to complete the "mixed" transport mode. |
| 6 | **Phase 5.2 — Android validation** | Widen the platform coverage before launch. |
| 7 | **Phase 6 — CI hardening** | Pre-commit + release automation. |
| 8 | **Phase 7 — launch prep** | Screenshots, privacy policy, App Store metadata. |

---

## Out of Scope (v2+)

Unchanged — per `.github/instructions/mobile.instructions.md`:

- User accounts / login
- Cloud AI APIs
- Camera OCR features
- Santander Cycles routing (dock locations only in MVP)
- Journey history
- LiteRT-LM integration
