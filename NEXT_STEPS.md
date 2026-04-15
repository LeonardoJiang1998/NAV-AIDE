# NAV AiDE — Next Steps Plan

## Current State Summary

**Live in the app on simulator:** end-to-end on-device intent extraction, routing on a 435-station TfL graph, SQLite-backed POI search over 860 London attractions, rich multi-line journey narratives, a real tube line map painted in official TfL colours, and a draggable OSM city map.

Verified on iPhone 16 Pro simulator (iOS 18.5, Gemma 3 1B IT Q4_K_M via `llama.rn` 0.5.11):

- **Heathrow T5 → Canary Wharf** → "Start at Canary Wharf. Take the Elizabeth line 13 stops to Heathrow Terminals 2 & 3. Change to the Piccadilly line and ride 1 stop to Heathrow Terminal 5. Total travel time: 28 minutes." *(28 s, origin/destination flip now auto-corrected)*
- **Stratford → Wimbledon** → 3-segment cross-London route with Central + Elizabeth + District interchanges spelled out *(38 min, 20 s inference)*
- **Waterloo → Baker Street** → "Take the Jubilee line 4 stops from Waterloo to Baker Street. Stops on the way: Westminster, Green Park, Bond Street. Total travel time: 8 minutes." *(8 min, 24 s inference)*
- **Find the British Museum** → POI lookup ✓
- **Remote control CLI**: `npm run ask "your query"` drives the running app from the terminal.

## What's Done ✓

### Phase 1 — Test Coverage
- 89+ tests across unit, golden, and integration suites
- New coverage: `RouteNarrative.test.ts`, `IntentOrderCorrector.test.ts`, `AssetManager.test.ts`, `readiness.test.ts`

### Phase 2 — Production Data Pipeline
- Tube graph: 435 stations / 575 edges from TfL Line Sequence API (11 tube + DLR + Elizabeth + 6 Overground)
- Location aliases: 478 rows regenerated from the live tube graph
- POIs: 860 rows from OSM Overpass API across 10 categories
- Bus routes: 29 tourist routes (22 day + 7 night) from codex PR #5
- Raw source snapshots committed in `scripts/data-pipeline/tfl-source/` for reproducibility

### Phase 4.1 — Gemma model integration
- Gemma 3 1B IT Q4_K_M (769 MB) deployed and verified
- Gemma 4 E2B Q4_K_M (3.2 GB) saved but blocked on `llama.rn` 0.12 (supports only through `gemma3`)
- Adapter uses `messages` array format to apply Gemma chat template

### Phase 5 (partial) — Device Validation
- iPhone 12 Pro Max (iOS 26.3.1) verified — inference runs, 6–26 s per query
- STT permission guard fixed
- Remote debugger harness + `globalThis.__NAVAIDE_PIPELINE` exposure for CLI-driven testing

### UI & UX polish (this session)
- **Rich journey narrative** — multi-line routes naming specific TfL lines and interchanges
- **Tube line map** (`TubeLineMap.tsx`) — MapLibre renders the 435-station network in official TfL colours with interchange dots and a legend
- **London city map** — OSM raster tiles wired into the offline style; the Maps screen now shows real streets
- **Route highlight** — running a query on GO draws the resolved path on the tube line map via `AppShellContext.setLastRoute`
- **Line chips** (`LineChip.tsx`) — Pantone-matched pills for every TfL line
- **Station autocomplete** (`StationSuggestions.tsx`) — inline typeahead over all 435 station names
- **Quick examples** — preset natural-language queries on the GO screen
- **Origin/destination corrector** — Gemma 3 1B flips origin and destination surprisingly often; `IntentOrderCorrector.ts` now cross-checks the raw query and flips back when the word order contradicts the extraction
- **"Where is X?" handling** — rule-based bridge now maps that phrasing to `nearest_station`
- **Remote control CLI** — `npm run ask "your query"` pipes queries to the running app via Metro's debugger

### Core bug fixes
- **`react-native-sqlite-storage` silent hang** (previous priority #1) — fix landed. We now rewrite absolute paths into Documents-relative paths and pass them via `createFromLocation` + `readOnly: true`, which is the library's supported pre-populated-DB API. **860 POIs + 435 aliases now reach the UI.**
- `AssetManager` requires checksum validation for required assets; optional disruption cache stays non-blocking
- `deriveDemoReadiness` / `deriveAssetDiagnostics` extracted as pure, unit-tested helpers in `readiness.ts`
- Invalid MBTiles / Valhalla tiles now correctly report as fallback blockers

---

## Known Issues

### "Where is X?" is still `intent: unknown` on Gemma 3 1B
Rule-based bridge handles it (falls through to `nearest_station`), but the first-choice LLM returns `unknown` for this phrasing. A bigger model or a prompt tweak would fix it.

### Gemma 3 1B can miss multi-word station names
"Heathrow Terminal 5" is correctly extracted, but some of the longer names (e.g. "King's Cross & St Pancras International") occasionally get truncated. The EntityResolver's alias index often recovers the right canonical name anyway.

### Walking directions still stubbed
`AssetAwareWalkingRouter` returns `asset-unavailable` until Valhalla tiles are wired up (Phase 3).

### MBTiles asset not yet bundled
The city map uses OSM raster tiles at runtime. For airplane-mode use we still need the MBTiles pipeline (Phase 4.2).

---

## Remaining Phases

### Phase 3 — Walking Route Implementation
Unchanged from before. Valhalla native module evaluation, walking tile extraction from OSM, integration into `ValhallaBridge`.

### Phase 4.2 — Offline map tiles (MBTiles)
Generate Greater London MBTiles from OSM PBF (tilemaker or similar), zooms 8–18, deploy to `Documents/maps/london.mbtiles`.

### Phase 4.3 — Asset download flow validation
End-to-end test with real asset sizes, checksum verification, resumable downloads.

### Phase 5.1 (remaining) — iOS physical device
- STT end-to-end in multiple languages
- TTS output validation
- GPS location services (needs `@react-native-community/geolocation`)
- Offline map rendering from MBTiles (blocked on 4.2)
- Airplane-mode release build verification

### Phase 5.2 — Android physical device testing
Not started.

### Phase 6 — CI/CD hardening
Pre-commit hooks, bundle-size regression checks, release automation.

### Phase 7 — Launch prep
Real device screenshots, privacy policy, App Store metadata.

### Future: Gemma 4 E2B
Already downloaded at `~/Desktop/NAV-AIDE-assets/models/gemma4-e2b.gguf` (3.2 GB). Swap in once `llama.rn` 0.12 stabilises — this should also fix the origin/destination flip at the source and improve the `unknown`-intent fallbacks.

---

## Recommended Priority (updated)

| Priority | Item | Rationale |
|---|---|---|
| 1 | **Phase 4.2 — offline MBTiles** | Only missing piece for a true airplane-mode demo of the Maps screen. |
| 2 | **Phase 3 — Valhalla walking** | Needed for "Mixed" transport mode and the last step of most journeys. |
| 3 | **Gemma 4 E2B upgrade** | Needs `llama.rn` 0.12 stable. Cleaner solution than the post-processing corrector. |
| 4 | **Phase 5.2 — Android validation** | Widen platform coverage before launch. |
| 5 | **Phase 5.1 remainder** | STT end-to-end, GPS, airplane-mode release build. |
| 6 | **Phase 6 — CI hardening** | Pre-commit, release automation. |
| 7 | **Phase 7 — launch prep** | Screenshots, privacy policy, store metadata. |

---

## Remote Control

```bash
# Run a query through the app from your terminal
npm run ask -- "How do I get from Waterloo to Baker Street?"

# Target a specific device
npm run ask -- --device "iPhone 16 Pro" "Heathrow Terminal 5 to Canary Wharf"

# Raw JSON output (good for scripting)
npm run ask -- --json "Find the British Museum"
```

Prerequisites: Metro running (`npm start`) and the app running in `__DEV__` (which exposes `globalThis.__NAVAIDE_PIPELINE`). To run the built-in auto-probe battery of test queries on next app launch, set `globalThis.__NAVAIDE_AUTO_PROBE = true` via the debugger.

---

## Out of Scope (v2+)

Unchanged — per `.github/instructions/mobile.instructions.md`: user accounts, cloud AI APIs, camera OCR, Santander Cycles routing, journey history, LiteRT-LM.
