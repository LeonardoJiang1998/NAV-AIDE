# NAV AiDE — Next Steps Plan

## Current State Summary

The app is **structurally complete**: all 4 screens, full query pipeline, mobile adapters, voice I/O, state management, offline map surface, download management, and native configs are implemented. TypeScript compiles clean. 72/72 tests pass. The codebase has zero TODO/FIXME markers.

**Phases 1 and 2 are complete.** Test coverage is comprehensive (72 tests) and production data is loaded: 174 tube stations across all 11 Underground lines (Zones 1–6), 29 bus routes, 122 POIs, and 198 location aliases. What remains is real-device validation, asset packaging, and shipping preparation.

---

## Phase 1: Test Coverage Expansion ✓

**Status:** Complete. 72/72 tests passing across unit, golden, and integration suites. All test files implemented: FuzzyMatcher, POIService, ValhallaBridge, DisruptionService, TubeGraphTransforms, EntityResolver, NodeFixtureAssetLoader, SqliteEntityRecordLoader, RuleBasedModelBridge, AssetPathResolver. 12 golden pipeline test cases covering route, fare, POI, disambiguation, unresolved, and walking scenarios.

---

## Phase 2: Production Data Pipeline ✓

**Status:** Complete. Production-scale data replaces all fixtures.

### 2.1 Tube graph — DONE
- 174 stations across all 11 Underground lines (Bakerloo, Central, Circle, District, Hammersmith & City, Jubilee, Metropolitan, Northern, Piccadilly, Victoria, Waterloo & City)
- 248 edges with realistic inter-station travel times
- Full Zone 1–2 coverage; key Zone 3–6 stations and termini (including Heathrow, Stanmore, High Barnet, Edgware, Morden, Epping approaches, Uxbridge, Richmond, Wimbledon)
- Expanding to the full ~272 stations is a straightforward seed-file addition if needed

### 2.2 Bus routes — DONE
- 29 tourist-relevant routes covering Zone 1–3 (22 day routes + 7 Night Bus routes)
- Routes serve all major tourist corridors and key transport hubs

### 2.3 POI database — DONE
- 122 curated POIs across categories: museums (16), landmarks (22), parks (12), attractions (6), hospitals (9), police stations (7), embassies (12), transport hubs (12), shopping (8), entertainment (7), markets (3), pharmacies (3), tourist info (2), services (2), library (1)
- Strong LOST?-screen coverage: 9 hospitals, 7 police stations, 12 embassies

### 2.4 Location aliases — DONE
- 198 aliases auto-expanded from 174 stations via the existing pipeline
- Includes Street→St abbreviations, special cases (King's Cross St Pancras → St Pancras, Kings Cross)

### 2.5 Asset versioning strategy
- DB checksums updated in `assetManifest.ts`
- Full OTA versioning deferred to Phase 4 (model/mbtiles assets)

---

## Phase 3: Walking Route Implementation

**Goal:** Replace the ValhallaBridge stub with real offline walking directions.

### 3.1 Evaluate Valhalla native module options
- Assess `valhalla-napi` or custom C++ bridge for React Native
- Determine GGUF tile size requirements for Central London walking graph
- Decide: full native Valhalla binding vs. simplified A* on OSM extract

### 3.2 Implement native walking router
- Build or integrate the chosen native module
- Wire into `ValhallaBridge` replacing `AssetAwareWalkingRouter` stub
- Provide real distance, duration, and step-by-step walking instructions

### 3.3 Generate and bundle walking tiles
- Extract Central London walking graph from OSM data
- Package as offline Valhalla tiles
- Add to asset manifest and download flow

---

## Phase 4: Production Asset Packaging

**Goal:** Bundle or download all required assets for a fully offline device experience.

### 4.1 Gemma 4 E2B model file
- Obtain quantized GGUF for Gemma 4 E2B (target: 2-4GB for mobile)
- Test `llama.rn` loading on iOS and Android physical devices
- Validate structured intent extraction quality against golden test cases
- Determine: bundle with app vs. first-launch download

### 4.2 Offline map tiles
- Generate London MBTiles from OSM data using `tilemaker` or similar
- Test MapLibre GL rendering on both platforms
- Scope: Greater London at zoom levels 8–18

### 4.3 Asset download flow validation
- Test `DownloadService` end-to-end with real asset sizes
- Validate checksum verification, retry logic, and progress reporting
- Test interrupted/resumed downloads

### 4.4 App bundle size audit
- Measure total app size with bundled fixtures vs. downloaded assets
- Set target: <100MB initial install, <2GB with all downloaded assets
- Document which assets are bundled vs. downloaded

---

## Phase 5: Real-Device Validation

**Goal:** Validate the complete app on physical iOS and Android devices.

### 5.1 iOS physical device testing
- Validate microphone permissions (currently scaffolded, not device-tested)
- Test `react-native-voice` STT in multiple languages
- Test `react-native-tts` output
- Validate GPS location services
- Test `llama.rn` model loading from app Documents container
- Validate offline map rendering from MBTiles
- Test full GO screen query flow end-to-end

### 5.2 Android physical device testing
- Validate RECORD_AUDIO + location permissions
- Test STT/TTS across languages
- Test model loading from external files directory
- Validate SQLite database access
- Test full offline flow (airplane mode)

### 5.3 Offline resilience testing
- Enable airplane mode, run all 4 screens
- Verify graceful degradation when specific assets are missing
- Confirm `fixture-fallback-mode` vs `real-asset-mode` reporting is accurate
- Test underground scenario (no GPS, no network)

### 5.4 Performance benchmarking
- Measure model inference latency (intent extraction + response rendering)
- Measure Dijkstra routing time on full tube graph
- Measure SQLite FTS5 query time on full POI database
- Set performance targets: <2s for route queries, <500ms for POI search

---

## Phase 6: CI/CD and Quality Gates

**Goal:** Automate build, test, and deployment verification.

### 6.1 GitHub Actions workflow
- TypeScript compilation (`npm run build`)
- Unit + golden tests (`npm test`)
- Data pipeline validation (`npm run stage2:test`)
- iOS + Android bundle verification (`npm run bundle:ios`, `npm run bundle:android`)

### 6.2 Pre-commit hooks
- TypeScript type checking
- Lint rules (add ESLint if not present)

### 6.3 Release automation
- Fastlane or similar for iOS/Android builds
- Automated version bumping
- TestFlight / Google Play internal track distribution

---

## Phase 7: Docs Site and Launch Prep

**Goal:** Complete the marketing site and prepare for public launch.

### 7.1 Real app screenshots
- Capture screenshots from each of the 4 screens on device
- Replace placeholder SVG in docs site

### 7.2 Privacy policy and terms
- Draft privacy policy (no accounts, no cloud data, device-only processing)
- Draft terms of service
- Host at real URLs and link from docs footer

### 7.3 Email signup backend
- Connect the waitlist form to a lightweight backend (e.g., Mailchimp, Buttondown)
- Add confirmation flow

### 7.4 App Store preparation
- App Store / Play Store metadata (description, screenshots, categories)
- App review guidelines compliance check
- Accessibility audit (VoiceOver, TalkBack)

---

## Recommended Priority Order

| Priority | Phase | Status |
|----------|-------|--------|
| ~~1~~ | ~~Phase 1: Test Coverage~~ | **Done** — 72/72 tests |
| ~~2~~ | ~~Phase 2: Production Data~~ | **Done** — 174 stations, 122 POIs, 29 routes |
| 3 | Phase 5: Device Validation | Next — catches platform-specific issues early |
| 4 | Phase 4: Asset Packaging | Required for real offline experience |
| 5 | Phase 6: CI/CD | Prevents regressions as complexity grows |
| 6 | Phase 3: Walking Routes | Nice-to-have for MVP; stub is acceptable for launch |
| 7 | Phase 7: Launch Prep | Final polish before public release |

---

## Out of Scope (v2+)

Per the do-not-build list in `.github/instructions/mobile.instructions.md`:
- User accounts / login
- Cloud AI APIs
- Camera OCR features
- Santander Cycles routing (dock locations only in MVP)
- Journey history
- LiteRT-LM integration
