# NAV AiDE — full session handover

**Date written:** 2026-04-27 03:05 BST
**Branch:** `claude/adoring-mcnulty-d8fbc9` (17 commits ahead of `origin/main`, all pushed)
**State:** 118/118 tests pass · TypeScript clean · simulator running cleanly · sub-second query responses

This doc is the single source of truth for the next Claude session. Read it end-to-end before doing any work.

---

## 1. Where everything lives

### Worktrees on the user's Mac

```
/Users/yoda/Desktop/NAV-AIDE/                                  ← main worktree (on `main`)
/Users/yoda/Desktop/NAV-AIDE/.claude/worktrees/
  ├── adoring-mcnulty-d8fbc9/                                  ← THIS BRANCH, all current work
  ├── vigorous-varahamihira-e9995a/                            ← stale
  └── zen-swirles/                                             ← stale (had Metro running here originally)
```

**Always `cd` into `/Users/yoda/Desktop/NAV-AIDE/.claude/worktrees/adoring-mcnulty-d8fbc9` for work.**

### Repo layout (only the parts you'll touch often)

```
adoring-mcnulty-d8fbc9/
├── .claude/skills/karpathy-guidelines/SKILL.md   ← Karpathy guidelines, auto-loaded by Claude Code
├── CLAUDE.md                                     ← project instructions
├── HANDOVER.md                                   ← this file
├── NEXT_STEPS.md                                 ← roadmap (slightly stale, see §6 here)
├── README.md
├── SESSION_LOG.md                                ← per-iteration record of this session
├── SESSION_NOTES/                                ← screenshots: baseline-*, iter1..9-*, final-*
├── assets/
│   ├── tubeGraph.json                            ← 435 stations, 575 edges
│   ├── busRoutes.json                            ← 29 routes (22 day + 7 night)
│   ├── data/pois.db                              ← SQLite, 2218 POIs (with nearest_station col)
│   ├── data/location_aliases.db                  ← SQLite, 478 alias rows
│   ├── data/london.mbtiles                       ← 160 OSM raster tiles, 5.8 MB
│   └── map-tiles/{z}/{x}/{y}.png                 ← extracted tile dir for file:// loading
├── scripts/data-pipeline/                        ← regen pipeline (TfL + OSM + MBTiles)
│   ├── build-tube-graph-from-tfl.js
│   ├── build-pois-from-osm.js
│   ├── build-london-mbtiles.mjs
│   ├── extract-mbtiles-to-dir.mjs
│   ├── generate-pois-db.js
│   ├── generate-location-aliases-db.js
│   ├── assemble-sqlite-dbs.js
│   └── tfl-source/                               ← raw upstream snapshots (TfL JSON, Overpass JSON)
├── scripts/dev/remote-ask.mjs                    ← `npm run ask -- "query"` CLI
├── src/
│   ├── core/                                     ← pure TS, Node-testable (no RN deps)
│   │   ├── llm/{IntentExtractor,IntentOrderCorrector,ResponseRenderer}.ts
│   │   ├── pipeline/{QueryPipeline,EntityResolver,RouteNarrative,TubeGraphTransforms}.ts
│   │   ├── pipeline/createQueryPipelineRuntime.ts
│   │   ├── poi/{POIService,FuzzyMatcher}.ts
│   │   ├── routing/{Dijkstra,ValhallaBridge,HaversineWalkingRouter}.ts
│   │   └── runtime/                              ← contracts
│   └── app/                                      ← React Native shell
│       ├── components/{CollapsibleCard,SectionCard,StatusChip,RouteCard,LineChip,
│       │              StationSuggestions,SystemAlertsCard,BusRoutesList}.tsx
│       ├── map/{TubeLineMap,OfflineMapSurface,buildMapStyle}.ts(x)
│       ├── model/{LocalModelManager,LlamaBackedAdapters}.ts
│       ├── pipeline/{createMobilePipeline,RuleBasedModelBridge,mobileFixtures}.ts
│       ├── screens/{GoScreen,LostScreen,MapsScreen,SettingsScreen,shared}.tsx
│       ├── state/{AppShellContext,readiness}.ts(x)
│       ├── storage/{ReactNativeSQLiteAdapter,PersistentStorage}.ts
│       ├── runtime/{ReactNativeOfflineAssetLoader,ReactNativeDeviceIdProvider,DeviceDemoAssets}.ts
│       └── navigation/AppNavigator.tsx
└── tests/{unit,golden,unit/app}/                 ← 118 tests, tsx --test
```

### Asset paths on the user's Mac (NOT in repo)

```
~/Desktop/NAV-AIDE-assets/models/
  ├── gemma-3-1b.gguf                    769 MB — currently deployed (works with llama.rn 0.5.11)
  └── gemma4-e2b.gguf                    3.2 GB — saved, BLOCKED on llama.rn 0.12 (only supports up to gemma3)
```

---

## 2. Commits this session (in order, oldest first)

```
c8834d1 Fix "Take me to <POI>" and enrich POI lookups with walking leg
74f31a9 Round out partial-query previews: station-only destination + origin-only
41dd0b5 UX polish: humanize location-intent summaries + context-aware card title
524e806 Update stale 'not found' hint — British Museum now resolves
0d1b2f2 Offline city map: MBTiles pipeline + runtime file:// tile source
ce57bcb Vendor karpathy-guidelines as a project skill
0405bf9 CLAUDE.md: mention the karpathy-guidelines skill
99427e8 Iteration 1: Settings restructure + GO chip + dev hooks
0652cfb Iteration 2: tube line map sits on real streets, scales with zoom
d287bc6 Iteration 3: empty input guard + loading spinner + a11y on GO
81641b4 Iteration 4: surface 29 bus routes on Maps
e4c5781 Session log: 5 iterations recap + verification results
814030e Iteration 6: 13× query speedup via fast-first intent extractor
0abd880 Iteration 7: rule extractor word-boundary + trailing-punct strip
f57d2a1 Iteration 8: sub-second responses by deprioritizing LLM renderer
acfac0c Iteration 9: TubeLineMap auto-fits camera to highlighted route
69bdce4 Session log: 9-iteration summary + final state screenshots
```

---

## 3. Architecture summary

### Two-layer design

- `src/core/` — pure TypeScript, zero React Native imports, runs in Node.
- `src/app/` — React Native shell. Imports core. Lives behind iOS sim or device.

### Query pipeline (must preserve this order)

```
rawInput
  → FuzzyMatcher fast-path hints
  → IntentExtractor                    ← FastFirst(rule, llama) wrapped in Fallback(•, rule)
  → IntentOrderCorrector               ← post-process: fix origin/destination flips
  → EntityResolver                     ← stations from location_aliases.db
  → POIService (fuzzy on canonical+aliases, threshold 0.7)
  → Dijkstra on weighted tube graph
  → ValhallaBridge → HaversineWalkingRouter (no real Valhalla yet)
  → DisruptionService (StaticDisruptionSource)
  → ResponseRenderer                   ← Fallback(rule renderer, llama)
  → assertNoHallucinatedPlaceNames     ← guard
```

### What each adapter actually does today

- **`FastFirstStructuredIntentAdapter(rule, slow)`** — calls `rule` first; if `intent !== 'unknown'` AND has at least one of `origin/destination/poiQuery`, returns it. Otherwise calls `slow` (Llama). LLM error → keeps rule result.
- **`FallbackStructuredIntentAdapter(primary, fallback)`** — try primary, on throw use fallback. Wraps the FastFirst above with another rule client as last-ditch safety.
- **`RuleBasedRenderClient`** — extracts `Summary:` line from prompt, returns it verbatim plus the allowed place names. **Now the primary renderer.** Sub-millisecond.
- **`LlamaBackedRenderAdapter`** — kept as fallback. Almost never invoked.
- **`HaversineWalkingRouter`** — great-circle distance + 20% padding + 80 m/min. Returns `asset-unavailable` only if either coord is missing.

### Why query latency is 0.1–0.8 s now (was 40–80 s)

The LLM (Gemma 3 1B IT Q4_K_M) on the simulator takes ~15-25 s per inference call. Both extractor and renderer used to call it → 40–80 s per query. Now both default to the rule path:

- Extractor: rule extractor handles "X to Y", "Take me to Y", "Find X", "Where is X", etc. perfectly. LLM only kicks in when intent='unknown'.
- Renderer: `buildRouteNarrative` already constructs perfect prose, the LLM was just paraphrasing it. Rule renderer pipes it through.

Result: clean queries skip the LLM entirely. Genuinely-novel phrasings still go through Gemma (~20 s).

---

## 4. Live runtime state on the iPhone 16 Pro simulator

- **App PID** changes per launch; check with `pgrep -f NavAideShell`.
- **Container path** changes per install. Always re-resolve via `xcrun simctl get_app_container booted com.aidemainleo.navaideshell data`.
- **Documents/data/pois.db** + **location_aliases.db** present and loaded (sqlite-runtime, not fixture-fallback).
- **Documents/models/gemma4-e2b.gguf** is actually Gemma 3 1B IT Q4_K_M — filename matches the asset manifest contract; switch contents when llama.rn 0.12 lands.
- **Documents/maps/london.mbtiles** + **Documents/map-tiles/{z}/{x}/{y}.png** both deployed.

Everything Documents/ survives an app re-launch but **not** an app re-install (container UUID rotates). After `npx react-native run-ios`, redeploy:

```bash
CONTAINER=$(xcrun simctl get_app_container booted com.aidemainleo.navaideshell data)
mkdir -p "$CONTAINER/Documents/data" "$CONTAINER/Documents/models" "$CONTAINER/Documents/maps"
cp assets/data/pois.db "$CONTAINER/Documents/data/"
cp assets/data/location_aliases.db "$CONTAINER/Documents/data/"
cp assets/data/london.mbtiles "$CONTAINER/Documents/maps/"
rm -rf "$CONTAINER/Documents/map-tiles"
cp -r assets/map-tiles "$CONTAINER/Documents/"
cp ~/Desktop/NAV-AIDE-assets/models/gemma-3-1b.gguf "$CONTAINER/Documents/models/gemma4-e2b.gguf"
```

Simulator booted state: `iPhone 16 Pro (D7320A4D-2A64-4691-AF2C-E08A12CE9249)`.
Physical device on USB: `Zubiao's iPhone (00008101-001A7C3C0E92001E)` — needs cert trust on device after install.

---

## 5. Dev hooks (READ THIS — saves hours)

The simulator is hard to drive via clicks because macOS focus management blocks computer-use clicks. Instead, the app exposes these in `__DEV__`:

| Hook | Where | Use |
|---|---|---|
| `globalThis.__NAVAIDE_PIPELINE` | AppShellContext | full mobilePipeline for `queryPipeline.execute(...)`, runtimeAdapters, etc. |
| `globalThis.__NAVAIDE_NAV_REF` | AppNavigator (`createNavigationContainerRef`) | `.navigate('GO' | 'LOST?' | 'Maps' | 'Settings')` |
| `globalThis.__NAVAIDE_SET_MAP_TAB` | MapsScreen | `setActiveMap('tube' | 'city')` |
| `globalThis.__NAVAIDE_SET_LAST_ROUTE` | AppShellContext | seed the highlighted-route state |
| `globalThis.__NAVAIDE_AUTO_PROBE` | AppShellContext | when `true`, runs a 3-query battery on app mount |

Drive them via Metro's inspector WebSocket. Helper scripts already in place:

```bash
# /tmp helpers (re-create if /tmp got cleaned)
node /tmp/nav-helper.mjs <ws-url> "GO|LOST?|Maps|Settings"     # navigate
node /tmp/tap-helper.mjs <ws-url> "<JS expression>"            # eval anything
```

The repo's `npm run ask -- "your query"` (in `scripts/dev/remote-ask.mjs`) is the easiest way to run a query end-to-end and see the result.

To get the WS URL:

```bash
WS_URL=$(curl -s http://localhost:8081/json/list | python3 -c "
import json, sys
for d in json.load(sys.stdin):
    if 'iPhone 16 Pro' in d.get('deviceName',''):
        print(d['webSocketDebuggerUrl']); break")
```

---

## 6. What's done vs what's not

### Done this session (iterations 1–9)

1. **Settings restructure** — Preferences/Permissions/Offline content/Feedback at top, diagnostics in CollapsibleCards.
2. **GO header chip** — `ready` / `rule-based` / `limited` based on real signal (model + sqlite source), not all-or-nothing.
3. **Tube line map polish** — height 380→520, OSM streets behind, zoom-interpolated line widths + station radii, default zoom 10→11.
4. **GO empty-input guard + loading spinner + accessibility** — Search/Voice/Speak all have `accessibilityLabel`/`Hint`/`Role`/`State`.
5. **Bus routes UI** — `BusRoutesList` component with TfL-red day chips + Night-navy chips, expandable stops list.
6. **FastFirstStructuredIntentAdapter** — rule first, LLM fallback. Skipped LLM for clean queries (13× speedup).
7. **Rule extractor word-boundary + trailing-punct strip** — fixes "Tower of London" → "wer of London" bug, and "Buckingham Palace?" trailing-? leak.
8. **Rule renderer first** — LLM renderer demoted to fallback. Final speedup: 580–800× total.
9. **TubeLineMap auto-fits to highlighted route** — when `lastRoute` is set, camera centers on route mid-point at appropriate zoom.

### Done earlier in the project (already merged or on this branch from before)

- 435 TfL stations / 575 edges / 19 lines from TfL Line Sequence API
- 2218 OSM POIs (Overpass `nwr`) with nearest_station column
- 478 location aliases regenerated from live tube graph
- Gemma 3 1B IT Q4_K_M loaded via `llama.rn` 0.5.11 with messages format
- `react-native-sqlite-storage` absolute-path hang fix
- `IntentOrderCorrector` (catches Gemma's origin/destination flips)
- POI-aware routing (POI destination → nearestStation + walking leg)
- Partial-query previews (destination-only POI/station, origin-only)
- Tube line map with TfL Pantone colours, route highlight overlay
- MBTiles offline city map pipeline (`build-london-mbtiles.mjs`, `extract-mbtiles-to-dir.mjs`)
- `buildMapStyle.ts` runtime style picker (file:// when local, OSM HTTPS otherwise)
- Karpathy guidelines vendored as project skill
- 4-screen UI shell with `CollapsibleCard` pattern across screens
- Remote-CLI for driving the running app (`npm run ask`)

### NOT done — backlog ranked by impact

1. **STT round-trip on physical iPhone** (HIGH)
   - `react-native-voice` is wired and Settings shows STT/TTS available, but never round-tripped end-to-end.
   - Needs the physical device with the user's hands.
   - File: `src/app/voice/{useSpeechToText,VoiceServices}.ts`.

2. **TTS round-trip — "Speak" button after a result** (HIGH)
   - `react-native-tts` is wired; needs a real result on screen + button tap to verify audio.
   - Same file area.

3. **GPS / location permission on iOS** (HIGH)
   - No geolocation package installed yet. `@react-native-community/geolocation` is the standard option.
   - `permissions.gps` toggle in Settings is currently cosmetic.

4. **First-launch / loading skeleton** (MED)
   - When the app boots without model/DBs, the UI shows alert chips. A friendly skeleton would be better.

5. **Disambiguation flow visual verification** (MED)
   - `Park` → multi-candidate flow works mechanically (pipeline returns `needs_disambiguation`) but never screenshotted on a live screen.

6. **Phase 4.2 — bigger MBTiles coverage** (MED)
   - Current: Greater London z10–12 + Zone 1 z13–14 (160 tiles, 5.8 MB).
   - Run `node scripts/data-pipeline/build-london-mbtiles.mjs` with extended `SLICES` for Zone 2-3.

7. **Phase 3 — real Valhalla walking** (LOW, multi-day)
   - Current: `HaversineWalkingRouter` (great-circle + 20% padding). Good enough for MVP.
   - Real fix needs Valhalla native module + tile generation.

8. **Gemma 4 E2B upgrade** (LOW)
   - File at `~/Desktop/NAV-AIDE-assets/models/gemma4-e2b.gguf` (3.2 GB, downloaded).
   - Blocked: `llama.rn` 0.5.11 only supports up to `gemma3` arch. `llama.rn` 0.12.0-rc.8+ supports `gemma4`.
   - Risk: 0.12 went through 9 RCs, API may have breaking changes.

9. **Multi-language sample queries** (LOW)
   - `QUICK_QUERIES` in `GoScreen.tsx` is all English. App boasts 140 languages via OS STT but the chips don't show that.

10. **Performance benchmarking targets** (LOW)
    - NEXT_STEPS.md mentions `<2s for route queries` — already smashed (0.1 s for clean queries).
    - Tail latency for unknown-intent queries (LLM hits) still 20–60 s.

### Known runtime quirks

- **Container UUID rotates on app reinstall.** Always redeploy assets after `run-ios`. (See section 4.)
- **Metro must run from this worktree** (`adoring-mcnulty-d8fbc9`), not `zen-swirles`. Check with `ps aux | grep "react-native start"`.
- **macOS focus management** kicks Simulator out of focus after computer-use clicks. Use the dev hooks (section 5) instead of clicks.
- **JSON `awaitPromise: true` is unreliable in Hermes** — the `tap-helper` style write-result-to-global-then-poll pattern works around it.
- **First LLM query** still costs ~50 s when triggered (model warmup + full inference).

---

## 7. Test suite

```bash
npm test               # 118 tests, ~5–10 s
npm run build          # tsc clean
npm run stage2:assets  # regenerate DBs (only when seed changes)
```

Test files added this session:
- `tests/unit/FastFirstStructuredIntentAdapter.test.ts` (6 cases)
- `tests/unit/RuleBasedExtractor.test.ts` (4 cases)

Existing test areas:
- `tests/unit/` — Dijkstra, EntityResolver, FuzzyMatcher, POIService, RuleBasedModelBridge, Haversine, IntentOrderCorrector, RouteNarrative, asset loaders, model bridge, etc.
- `tests/unit/app/` — AssetManager, readiness helper, AssetPathResolver
- `tests/golden/` — pipeline integration with fixture cases (`tests/golden/fixtures/query-pipeline-cases.json`)

---

## 8. Tooling state on the user's Mac

- **Metro:** running on :8081 from `adoring-mcnulty-d8fbc9` worktree (PID changes; check `lsof -i :8081 | grep LISTEN`).
- **Simulator:** iPhone 16 Pro (iOS 18.5) booted, app launched.
- **Physical device:** Zubiao's iPhone, USB-connected, debug build installed but cert trust may need re-confirming.
- **OpenClaw:** at `/opt/homebrew/bin/openclaw` (v2026.4.22). Has a configured "main" agent named "Nova" using `xiaomi-coding/mimo-v2.5-pro`. **WARNING: it's slow** — ~50 s for a trivial reply, so I (this session) used it minimally and did most work directly. Smoke test: `openclaw agent --local --agent main --message "Reply PONG" --thinking off --json`.
- **Karpathy skills plugin:** auto-loaded by Claude Code from `.claude/skills/karpathy-guidelines/SKILL.md`. The four principles (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution) actively guided this session — surfacing tradeoffs (don't blindly delegate to OpenClaw), pushing back on cosmetic refactors, and verifying each iteration with simulator screenshots.

### Live verification commands the next session will need

```bash
# Confirm worktree + branch
cd /Users/yoda/Desktop/NAV-AIDE/.claude/worktrees/adoring-mcnulty-d8fbc9
git branch --show-current && git log --oneline origin/main..HEAD | wc -l   # expect 17

# Smoke-test routing
npm run ask -- "Waterloo to Baker Street"            # expect ~0.1s
npm run ask -- "Take me to the British Museum"       # expect ~0.8s

# Take a fresh screenshot of any tab
WS_URL=$(curl -s http://localhost:8081/json/list | python3 -c "
import json, sys
for d in json.load(sys.stdin):
    if 'iPhone 16 Pro' in d.get('deviceName',''): print(d['webSocketDebuggerUrl']); break")
node /tmp/nav-helper.mjs "$WS_URL" Maps && xcrun simctl io booted screenshot /tmp/check.png
```

---

## 9. Before doing any new work

1. **Read this whole file** (you're at the end of it).
2. **Read `SESSION_LOG.md`** in the active worktree for per-iteration detail and screenshot pointers.
3. **Run the smoke commands in §8** to confirm everything is still green.
4. **Pick from the backlog in §6.6** OR ask the user what they want next.
5. **Open the PR for `claude/adoring-mcnulty-d8fbc9` if it isn't open yet.** `gh` isn't authed on this machine; use the URL `https://github.com/LeonardoJiang1998/NAV-AIDE/pull/new/claude/adoring-mcnulty-d8fbc9` or have the user open it manually.

### Karpathy guidelines (always in effect)

- **Think before coding.** State assumptions. Surface tradeoffs. Push back when warranted.
- **Simplicity first.** Minimum code that solves the problem. No speculative flexibility.
- **Surgical changes.** Touch only what the request requires. Don't refactor adjacent code that isn't broken.
- **Goal-driven.** Define verifiable success criteria, loop until they're met.

The skill at `.claude/skills/karpathy-guidelines/SKILL.md` is auto-loaded.

---

## 10. Final notes

- The user explicitly trusts you with full Mac + iPhone control. Use it responsibly: never `git push --force`, never amend, never delete branches.
- Always work on `claude/adoring-mcnulty-d8fbc9` until told otherwise. Never commit to `main` directly.
- The session memory file at `~/.claude/projects/-Users-yoda-Desktop-NAV-AIDE/memory/project_phase2_complete.md` mirrors the high-level status; this `HANDOVER.md` is the canonical detailed source.
- This branch is **ready for PR review and merge** as far as I can tell. The user just needs to open it and look.
