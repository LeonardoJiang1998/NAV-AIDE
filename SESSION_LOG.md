# Autonomous build-loop session log

Started 2026-04-27 02:08 BST. Branch `claude/adoring-mcnulty-d8fbc9`.
Karpathy-guidelines skill in effect: surgical changes, simplicity first.
OpenClaw (Nova / mimo-v2.5-pro) is the executor; Claude is planner + reviewer.

## Baseline state (commit `0405bf9`)

- 108 tests pass · TypeScript clean
- Real London data in DBs: 435 stations, 575 edges, 2218 POIs, 478 aliases
- Gemma 3 1B IT Q4_K_M loaded, walking via Haversine, POI fallback wired
- MBTiles (160 tiles) + flat tile dir deployed to simulator
- Tube line map renders with TfL colours; route highlight wired
- 4 screens decluttered with `CollapsibleCard`

Baseline screenshots in `SESSION_NOTES/baseline-{go,lost,maps,settings}.png`.

## Defect backlog (ranked)

| # | Defect | Severity | Notes |
|---|---|---|---|
| 1 | Settings screen is wall of diagnostics, no actual settings | HIGH | Subtitle promises "preferences, permissions, queued feedback" but body is just `SystemAlertsCard` |
| 2 | GO header chip says "fallback mode" by default | MED | Misleading — model is loaded, SQLite runs, only MBTiles checksum is missing. Reword or remove. |
| 3 | Tube line map stations overlap visually | MED | 435 stations in a fixed frame is too dense at default zoom |
| 4 | Maps "London city" tab not yet verified | MED | OSM tiles wired but unverified |
| 5 | First-launch experience (no model, no DBs) | LOW | Currently shows alert wall instead of friendly loading UI |
| 6 | Bus routes have zero UI surface | LOW | 29 routes seeded but never rendered |
| 7 | LOST? "Speak" button styling unverified mid-listen | LOW | |

## Iterations

(filled in by the loop)

### Iteration 1 (02:08 → 02:20 BST)

**Settings screen rebuilt.** Surfaced Preferences and Permissions at the top with two-line label/hint per toggle. Offline content compacted to one card with action button. Demoted SystemAlertsCard, runtime probe, demo readiness, asset paths, device info, and DownloadScreen into separate `CollapsibleCard`s. About card replaces the multi-line attributions wall.

**GO header chip rephrased.** Was `fallback mode` whenever any non-essential asset (MBTiles, Valhalla) was missing. Now reflects what actually affects answer quality: SQLite + model. Three states: `ready` / `rule-based` / `limited`.

**Navigation ref + map-tab setter exposed in __DEV__.** `globalThis.__NAVAIDE_NAV_REF` (via `createNavigationContainerRef`) and `globalThis.__NAVAIDE_SET_MAP_TAB` so the autonomous loop can drive screens without taps.

**Verified offline city map paints from local tiles.** Switched MapsScreen to `city` tab via the new dev hook. MapLibre rendered real OSM tiles for Westminster / Mayfair / Lambeth / Southwark from `file://Documents/map-tiles/{z}/{x}/{y}.png`. Phase 4.2 functional.

Build clean · 108 tests pass.

Screenshots: `SESSION_NOTES/iter1-{go,settings,maps-tube,maps-city}.png`.

### Iteration 2 (02:20 → 02:25 BST)

**Tube line map readability.** Three changes:
1. `mapShell` height 380 → 520 px so Central London actually has room.
2. Switched to the runtime-built MapLibre style via `buildMapStyle`, so when the offline tile dir is on disk the tube lines paint on top of real street context. The tube map was previously a flat grey background — the lines made geometric sense but you couldn't tell which line was which without the chip legend below.
3. Zoom-interpolated line widths (2 px at z9 → 5 px at z15) and station radii (1.4 → 7 px). Stations hidden below z9 to keep the overview tidy.
4. Default zoom 10 → 11 so Zone 1 fills the frame.

Result: stations + lines + street context all readable in one frame. Camden, King's Cross, Westminster, Pimlico, City of London, Old Kent, Lambeth all labelled. See `SESSION_NOTES/iter2-tube.png`.

Build clean · 108 tests pass.

### Iteration 3 (02:25 → 02:30 BST)

**Empty input + loading state + accessibility on GO.**
- `runQuery` now early-returns on empty/whitespace input with a friendly hint pointing at the example chips. Was previously sending an empty string to the LLM (always unresolved, wasted 20s).
- Search button shows an `ActivityIndicator` next to "Routing…" while in flight. Previously just text-changed which is invisible to a tired user.
- Added `accessibilityLabel`, `accessibilityHint`, `accessibilityRole`, and `accessibilityState` on Search / Voice / Speak so VoiceOver users get useful announcements.

Build clean · 108 tests pass · Regression check: "Waterloo to Baker Street" still routes to 8-min Jubilee path with full station list.

Screenshots: `SESSION_NOTES/iter3-{go-fresh,lost}.png`.
