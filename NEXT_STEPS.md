# NAV AiDE — Next Steps Plan

## Current State Summary

The app is **structurally complete**: all 4 screens, full query pipeline, mobile adapters, voice I/O, state management, offline map surface, download management, and native configs are implemented. TypeScript compiles clean. 28/30 tests pass. The codebase has zero TODO/FIXME markers.

What remains is hardening, production data, real-device validation, and shipping preparation.

---

## Phase 1: Test Coverage Expansion

**Goal:** Close the unit test gaps identified in the MVP spec before adding new features.

### 1.1 FuzzyMatcher unit tests (`tests/unit/FuzzyMatcher.test.ts`) — NEW FILE
- Test `normalize()` with Unicode diacritics, mixed case, whitespace
- Test `levenshtein()` distance correctness
- Test `score()` with exact, close, and distant matches
- Test `rank()` ordering and threshold filtering

### 1.2 POIService unit tests (`tests/unit/POIService.test.ts`) — NEW FILE
- Test search with matching POIs returns ranked results
- Test search with no matches returns empty
- Test confidence threshold filtering (0.7 cutoff)
- Test result limit (default top 3)

### 1.3 ValhallaBridge unit tests (`tests/unit/ValhallaBridge.test.ts`) — NEW FILE
- Test `AssetAwareWalkingRouter` returns hardcoded estimates when assets available
- Test returns `asset-unavailable` status when assets missing
- Test `ValhallaBridge` delegates correctly to injected router

### 1.4 DisruptionService unit tests (`tests/unit/DisruptionService.test.ts`) — NEW FILE
- Test `CacheAwareDisruptionService` returns cached data within TTL
- Test cache expiry triggers re-fetch
- Test `StaticDisruptionSource` filtering by line

### 1.5 Additional golden test cases
- Add cases for multi-leg routes (line changes)
- Add cases for bus-only queries
- Add edge cases: empty input, very long input, injection attempts

---

## Phase 2: Production Data Pipeline

**Goal:** Replace fixture data with real London transport and POI data.

### 2.1 TfL tube graph ingestion
- Ingest full London Underground network from TfL Open Data (station locations, line connections, travel times)
- Replace the 25-station Central London fixture with the complete ~270-station network
- Preserve the existing `tubeGraph.json` schema contract

### 2.2 TfL bus routes ingestion
- Ingest London bus route data from TfL Open Data
- Replace the 2-route fixture with the full bus network
- Preserve the existing `busRoutes.json` schema contract

### 2.3 POI database expansion
- Source curated London POI dataset (tourist attractions, landmarks, hospitals, police stations, embassies)
- Populate `pois.db` with real entries and FTS5 indexing
- Ensure LOST?-relevant POIs are well-represented (police stations, hospitals, hotels, embassies, transport hubs)

### 2.4 Location aliases expansion
- Expand `location_aliases.db` with common tourist misspellings, abbreviations, and multilingual variants
- Add aliases for major landmarks (e.g., "Big Ben" → "Elizabeth Tower / Westminster")

### 2.5 Asset versioning strategy
- Define a schema version + checksum manifest for over-the-air asset updates
- Implement version checking in `DownloadService` so deployed apps can receive updated data

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

| Priority | Phase | Rationale |
|----------|-------|-----------|
| 1 | Phase 1: Test Coverage | Low risk, high value — validates existing code before changes |
| 2 | Phase 2: Production Data | Transforms the app from demo to usable product |
| 3 | Phase 5: Device Validation | Catches platform-specific issues early |
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
