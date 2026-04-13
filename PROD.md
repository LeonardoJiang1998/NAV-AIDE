# NAV AiDE Developer Production Guide

This document is the single reference for developers contributing to NAV AiDE. It covers environment setup, architecture, contracts, conventions, and troubleshooting. Read the [README](README.md) for the product overview; read this document to understand how the code works.

---

## Table of Contents

1. [Development Environment Setup](#1-development-environment-setup)
2. [Architecture Deep Dive](#2-architecture-deep-dive)
3. [Core Pipeline Contracts](#3-core-pipeline-contracts)
4. [LLM Integration](#4-llm-integration)
5. [Entity Resolution](#5-entity-resolution)
6. [Data Pipeline](#6-data-pipeline)
7. [Mobile Runtime](#7-mobile-runtime)
8. [Testing Strategy](#8-testing-strategy)
9. [CI/CD](#9-cicd)
10. [Coding Conventions](#10-coding-conventions)
11. [Troubleshooting](#11-troubleshooting)
12. [Decision Log](#12-decision-log)

---

## 1. Development Environment Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime for core logic, tests, data pipeline |
| npm | 10+ | Package management |
| TypeScript | 5.8+ | Installed via devDependencies |
| React Native CLI | 20.x | Native build toolchain (not Expo) |
| Xcode | 15+ | iOS builds (macOS only) |
| Android SDK | 34+ | Android builds |
| CocoaPods | latest | iOS native dependency management |
| sqlite3 CLI | 3.x | Data pipeline asset assembly |

### First-time setup

```bash
# Clone and install
git clone <repo-url> && cd NAV-AIDE
npm install

# iOS native dependencies (macOS only)
cd ios && pod install && cd ..

# Generate offline data assets
npm run stage2:sql          # JSON + SQL scaffolds
npm run stage2:assemble     # SQLite DBs from SQL (requires sqlite3 CLI)
npm run stage2:validate     # Validate tables, FTS, seed rows

# Verify everything works
npm run build               # TypeScript compilation (tsc)
npm test                    # Unit + golden tests
```

### Shorthand commands

```bash
npm run stage2:assets       # sql + assemble + validate in one step
npm run stage2:test         # assets + build + test
npm run phase3a:verify      # build + test + bundle:ios + bundle:android
```

### Running the app

```bash
npm start                   # Metro dev server
npm run ios                 # iOS simulator
npm run android             # Android emulator
```

---

## 2. Architecture Deep Dive

### Two-layer design

```
src/
  core/       Pure offline business logic. Zero React Native imports.
              Testable in Node.js. This layer MUST NOT import from src/app/.

  app/        React Native shell: screens, native adapters, state management.
              Imports from src/core/ freely.
```

This separation ensures the entire query pipeline can be developed and tested in Node.js before any mobile integration. Any new core module must remain Node-testable.

### Query pipeline flow

Every user query traverses these stages in order:

```
User Input
    |
    v
FuzzyMatcher (fast-path hints)     Extracts station name hints from raw text
    |
    v
IntentExtractor                    LLM or rule-based: produces IntentExtraction JSON
    |
    v
EntityResolver                     Grounds extracted names to local entity records
    |
    +--- resolved -----> POIService / Dijkstra / ValhallaBridge
    |                         |
    +--- disambiguation ----> Return candidates to user
    |                         |
    +--- unresolved --------> Return "not found" response
                              |
                              v
                    DisruptionService        Fetches cached disruptions for route
                              |
                              v
                    ResponseRenderer         LLM or rule-based: produces natural language
                              |
                              v
                    QueryPipelineResult      Final structured result
```

**Critical rule:** EntityResolver runs before any routing or search. The LLM never resolves locations.

### Module dependency map

```
QueryPipeline (orchestrator)
  ├── IntentExtractor ← StructuredIntentModelAdapter (interface)
  │                      ├── LlamaBackedStructuredIntentAdapter (llama.rn)
  │                      └── RuleBasedStructuredModelClient (regex fallback)
  ├── EntityResolver ← EntityRecord[] (from fixtures or SQLite)
  ├── FuzzyMatcher (fast-path hint generation)
  ├── POIService ← FuzzyMatcher + POIRecord[]
  ├── Dijkstra ← WeightedGraph (tube network)
  ├── ValhallaBridge ← OfflineWalkingRouter
  │                     └── AssetAwareWalkingRouter (MVP stub)
  ├── ResponseRenderer ← NaturalLanguageRenderAdapter (interface)
  │                       ├── LlamaBackedRenderAdapter (llama.rn)
  │                       └── RuleBasedRenderClient (template fallback)
  ├── CacheAwareDisruptionService ← DisruptionSource
  │                                  └── StaticDisruptionSource
  └── EventLogger
```

### Key source files

| File | Role |
|------|------|
| `src/core/pipeline/QueryPipeline.ts` | Main orchestrator: routes intents to handlers |
| `src/core/pipeline/EntityResolver.ts` | 3-tier entity resolution with fuzzy matching |
| `src/core/pipeline/createQueryPipelineRuntime.ts` | Factory: assembles all dependencies |
| `src/core/llm/IntentExtractor.ts` | Structured JSON extraction from user queries |
| `src/core/llm/ResponseRenderer.ts` | NL rendering with hallucination guard |
| `src/core/routing/Dijkstra.ts` | Shortest path on weighted tube graph |
| `src/core/routing/ValhallaBridge.ts` | Walking route interface + MVP stub |
| `src/core/poi/FuzzyMatcher.ts` | Levenshtein + token overlap scoring |
| `src/core/poi/POIService.ts` | FTS5 POI search via FuzzyMatcher |
| `src/core/services/DisruptionService.ts` | TTL-cached disruption lookup |
| `src/app/pipeline/createMobilePipeline.ts` | Composes RN-safe pipeline with fallbacks |
| `src/app/pipeline/RuleBasedModelBridge.ts` | Regex intent extraction + template rendering |

---

## 3. Core Pipeline Contracts

### IntentExtraction

Produced by `IntentExtractor.extract()`. This is the JSON schema enforced on the LLM output:

```typescript
interface IntentExtraction {
  detectedLanguage: 'English' | 'Mandarin' | 'Spanish' | 'French' | 'Arabic' | 'Other';
  intent: 'route' | 'nearest_station' | 'poi_lookup' | 'lost_help' | 'fare' | 'unknown';
  origin: string | null;
  destination: string | null;
  poiQuery: string | null;
  requiresDisambiguation: boolean;
  rawQuery: string;   // Must exactly match the user's input
}
```

**Validation rules:**
- `detectedLanguage` and `intent` must be from the enum sets above
- `requiresDisambiguation` must be boolean
- `rawQuery` must preserve the original input verbatim

### QueryPipelineResult

Returned by `QueryPipeline.execute()`:

```typescript
interface QueryPipelineResult {
  status: 'complete' | 'needs_disambiguation' | 'unresolved';
  extraction: IntentExtraction;
  fastPathHints?: string[];
  origin?: ResolutionResult;
  destination?: ResolutionResult;
  poiResults?: POIResult[];
  route?: ShortestPathResult | null;
  tubeSegments?: TubeSegment[];
  walking?: WalkingRouteResult;
  disruptions: DisruptionEvent[];
  rendered: RenderedResponse | null;
}
```

**Status semantics:**
- `complete` — fully resolved, route/POI found, response rendered
- `needs_disambiguation` — entity resolution ambiguous, user must choose
- `unresolved` — entity not found in local data or no route exists

### RenderedResponse

```typescript
interface RenderedResponse {
  text: string;                    // Natural language output
  referencedPlaceNames: string[];  // Place names used in the text
}
```

Every referenced place name is validated against an allowed list. If a name appears that was not in the allowed list, `assertNoHallucinatedPlaceNames()` throws.

### ResolutionResult

```typescript
interface ResolutionResult {
  status: 'resolved' | 'disambiguation' | 'unresolved';
  confidence: number;
  bestCandidate: ResolutionCandidate | null;
  candidates: ResolutionCandidate[];   // Top 3 candidates max
  normalizedQuery: string;
}

interface ResolutionCandidate {
  entity: EntityRecord;
  confidence: number;
  matchedBy: 'exact' | 'alias' | 'fuzzy';
  matchedValue: string;
}
```

---

## 4. LLM Integration

### Model adapter pattern

All LLM work flows through two interfaces defined in `src/core/runtime/ModelAdapterContracts.ts`:

```typescript
interface StructuredIntentModelAdapter {
  generateStructured<T>(request: { prompt: string; schema?: object }): Promise<T>;
}

interface NaturalLanguageRenderAdapter {
  renderNaturalLanguage(request: { prompt: string }): Promise<{ text: string; referencedPlaceNames: string[] }>;
}
```

This pattern enables swapping implementations without touching the pipeline:

| Adapter | Backend | Temperature | Use case |
|---------|---------|-------------|----------|
| `LlamaBackedStructuredIntentAdapter` | `llama.rn` | 0.1 | Production intent extraction |
| `LlamaBackedRenderAdapter` | `llama.rn` | 0.2 | Production NL rendering |
| `RuleBasedStructuredModelClient` | Regex + Fuse.js | N/A | Fallback intent extraction |
| `RuleBasedRenderClient` | Template parsing | N/A | Fallback NL rendering |

### Intent extraction prompt

```
Extract structured NAV AiDE travel intent as JSON.
Known station names:
Waterloo, Westminster, Green Park, Baker Street, ...
User query: How do I get from Waterloo to Baker Street?
Local fast-path hints: Waterloo, Baker Street
```

The LLM responds with JSON conforming to the IntentExtraction schema. `json_schema` strict mode is enforced via `llama.rn`.

### Response rendering prompt

```
Render a concise NAV AiDE response.
Intent: route
Summary: Route from Waterloo to Baker Street costs 8 minutes.
Allowed place names: Waterloo, Westminster, Green Park, Baker Street
```

### Hallucination guard

`ResponseRenderer.render()` calls `assertNoHallucinatedPlaceNames()` after every LLM response:

```typescript
export function assertNoHallucinatedPlaceNames(
  referencedPlaceNames: string[],
  allowedPlaceNames: string[]
): void {
  const hallucinated = referencedPlaceNames.filter(
    (name) => !allowedPlaceNames.includes(name)
  );
  if (hallucinated.length > 0) {
    throw new Error(`Hallucinated place names detected: ${hallucinated.join(', ')}`);
  }
}
```

If the LLM invents a place name not in the allowed list, the pipeline throws rather than returning fabricated data.

### Rule-based fallback

`RuleBasedModelBridge.ts` provides offline fallback when the Gemma model isn't loaded. It uses regex patterns for intent detection across 5 languages:

| Language | Detection | Example patterns |
|----------|-----------|-----------------|
| Mandarin | Unicode `[\u4e00-\u9fff]` | `最近`, `迷路`, `怎么从`, `多少钱` |
| Arabic | Unicode `[\u0600-\u06ff]` | `اقرب`, `تائه`, `خذني`, `كم تكلفة` |
| Spanish | Keyword match | `como voy`, `estoy perdido`, `busca`, `cuanto cuesta` |
| French | Keyword match | `comment aller`, `je suis perdu`, `trouve`, `quel est le tarif` |
| English | Default | `nearest`, `lost`, `find`, `fare`, `from...to` |

Station matching uses Fuse.js with `threshold: 0.35`. The fallback adapter chains: `LlamaBackedAdapter` tried first, falls through to `RuleBasedClient` on failure.

---

## 5. Entity Resolution

### Algorithm

`EntityResolver.resolve(query)` runs a 3-tier matching strategy:

```
Step 1: Normalize query via FuzzyMatcher.normalize()
        "Baker St" → "baker st"

Step 2: Exact canonical match
        Compare against all EntityRecord.canonicalName (normalized)
        If match → return { status: 'resolved', matchedBy: 'exact', confidence: 1.0 }

Step 3: Exact alias match
        Compare against all EntityRecord.aliases (normalized)
        If match → return { status: 'resolved', matchedBy: 'alias', confidence: 0.93 }

Step 4: Fuzzy ranking
        Rank all records using FuzzyMatcher.rank() against [canonicalName, ...aliases]
        Filter candidates with score >= DISAMBIGUATION_THRESHOLD (0.72)
        Take top 3 candidates

Step 5: Resolution decision
        If best score >= FUZZY_RESOLVE_THRESHOLD (0.78)
          AND (no second candidate OR gap >= MIN_SCORE_GAP (0.05)):
            → { status: 'resolved', matchedBy: 'fuzzy' }
        Else if candidates exist:
            → { status: 'disambiguation', candidates: [...] }
        Else:
            → { status: 'unresolved' }
```

### Threshold constants

```typescript
EXACT_MATCH_THRESHOLD    = 1.0    // Canonical name exact match
ALIAS_MATCH_THRESHOLD    = 0.93   // Alias exact match
FUZZY_RESOLVE_THRESHOLD  = 0.78   // Minimum for auto-resolve via fuzzy
DISAMBIGUATION_THRESHOLD = 0.72   // Minimum to appear as disambiguation candidate
MIN_SCORE_GAP            = 0.05   // Required gap between #1 and #2 to auto-resolve
```

### Tuning guidance

- **Lowering `FUZZY_RESOLVE_THRESHOLD`** (e.g., to 0.75): more queries auto-resolve, but risk of wrong match increases
- **Raising `MIN_SCORE_GAP`** (e.g., to 0.10): fewer false auto-resolves, but more disambiguation prompts
- **Lowering `DISAMBIGUATION_THRESHOLD`** (e.g., to 0.65): more candidates shown in disambiguation, including weaker matches

Changes to these thresholds require updating golden test expectations in `tests/golden/fixtures/query-pipeline-cases.json`.

### FuzzyMatcher scoring

The `FuzzyMatcher.score()` function combines two signals:

```
finalScore = (charSimilarity * 0.7) + (tokenOverlap * 0.3)
```

- **charSimilarity**: `1 - (levenshteinDistance / maxLength)`
- **tokenOverlap**: `sharedTokens / max(queryTokens, candidateTokens)`
- Special cases: exact match → 1.0, substring containment → 0.9

---

## 6. Data Pipeline

### Fixture strategy

The current data assets are **deterministic fixtures** — small, curated subsets of London data designed for development and testing. They are not production data.

| Asset | Fixture scope | Production scope |
|-------|---------------|------------------|
| `tubeGraph.json` | ~25 Central London stations | Full ~270-station Underground |
| `busRoutes.json` | 2 sample routes | Full TfL bus network |
| `pois.db` | Seed POIs (museums, landmarks) | Thousands of tourist-relevant POIs |
| `location_aliases.db` | Core station aliases | Full alias set + multilingual variants |

### Script inventory

All scripts live in `scripts/data-pipeline/`:

| Script | Output | What it does |
|--------|--------|-------------|
| `build-tube-graph.js` | `assets/tubeGraph.json` | Reads `seeds/tubeGraph.seed.json`, outputs graph with nodes + edges |
| `generate-bus-routes.js` | `assets/busRoutes.json` | Reads `seeds/busRoutes.seed.json`, outputs route list |
| `generate-pois-db.js` | SQL scaffold | Generates CREATE TABLE + INSERT for `pois` table with FTS5 |
| `generate-location-aliases-db.js` | SQL scaffold | Generates CREATE TABLE + INSERT for `location_aliases` with FTS5 |
| `assemble-sqlite-dbs.js` | `assets/data/*.db` | Pipes SQL scaffolds into `sqlite3` CLI to build real DB files |
| `validate-sqlite-dbs.ts` | Pass/fail | Validates tables exist, FTS indices work, seed rows present |

### SQLite schemas

**pois.db:**
```sql
CREATE TABLE pois (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  category TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  zone INTEGER,
  search_terms TEXT
);
CREATE VIRTUAL TABLE pois_fts USING fts5(canonical_name, search_terms);
```

**location_aliases.db:**
```sql
CREATE TABLE location_aliases (
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source TEXT
);
CREATE VIRTUAL TABLE location_aliases_fts USING fts5(alias, canonical_name);
```

### Running the pipeline

```bash
# Individual steps
npm run stage2:sql          # Generate JSON + SQL
npm run stage2:assemble     # Build SQLite DBs (requires sqlite3 CLI)
npm run stage2:validate     # Validate DBs

# All at once
npm run stage2:assets

# Full verification (assets + TypeScript build + tests)
npm run stage2:test
```

---

## 7. Mobile Runtime

### createMobilePipeline factory

`src/app/pipeline/createMobilePipeline.ts` is the single entry point that wires the entire RN-safe pipeline. It returns:

```typescript
interface MobilePipeline {
  knownStations: string[];
  entityResolver: EntityResolver;
  queryPipeline: QueryPipeline;
  runtimeAdapters: { assetLoader, sqliteAdapter, modelManager, deviceIdProvider };
  probeRuntime(): Promise<RuntimeProbeResult>;
  initializeRuntime(): Promise<RuntimeState>;
}
```

### Fallback chain

The mobile pipeline uses a layered fallback strategy at every critical junction:

```
LLM layer:
  LlamaBackedStructuredIntentAdapter  →  (on failure)  →  RuleBasedStructuredModelClient
  LlamaBackedRenderAdapter            →  (on failure)  →  RuleBasedRenderClient

Data layer:
  SQLite location_aliases.db  →  (if missing)  →  Fixture entity records
  SQLite pois.db              →  (if missing)  →  Fixture POI records
  File disruptions.json cache →  (if missing)  →  Fixture disruption events

Walking layer:
  Valhalla tiles              →  (if missing)  →  AssetAwareWalkingRouter returns "asset-unavailable"
```

Both the LLM model and the rule-based fallback are initialized at startup. If the model fails to load, the rule-based path is always ready.

### Asset resolution

`ReactNativeOfflineAssetLoader` searches for assets in these directories, in order:

1. App Documents directory
2. App Library directory
3. App Caches directory
4. Android external files directory (Android only)
5. App main bundle

Expected relative paths:

| Asset | Relative path |
|-------|--------------|
| Gemma model | `models/gemma4-e2b.gguf` |
| POI database | `data/pois.db` |
| Location aliases DB | `data/location_aliases.db` |
| Map tiles | `maps/london.mbtiles` |
| Walking tiles | `routing/valhalla_tiles/` |
| Disruption cache | `cache/disruptions.json` (optional) |

### Runtime probing

`probeRuntime()` checks all assets and returns a structured report:

```typescript
interface RuntimeProbeResult {
  modelLoaded: boolean;
  sqliteTablesValid: boolean;
  walkingAssetsAvailable: boolean;
  disruptionCachePresent: boolean;
  mapTilesPresent: boolean;
}
```

### Demo readiness

The Settings screen reports one of two modes:

- **`real-asset-mode`**: model loaded + entity SQLite + POI SQLite + STT + TTS + map + walking assets all present
- **`fixture-fallback-mode`**: one or more assets missing, with a detailed blocker list

---

## 8. Testing Strategy

### Framework

Tests use the **Node.js native `test` module** with the `tsx` runner. No Jest, Mocha, or other test frameworks.

```bash
npm test    # runs: tsx --test tests/**/*.test.ts
```

### Test structure

```
tests/
  unit/                              # Isolated module tests
    Dijkstra.test.ts                 # 3 tests: shortest path, disconnected, same origin
    EntityResolver.test.ts           # 7 tests: exact, alias, fuzzy, disambiguation, thresholds
    FuzzyMatcher.test.ts             # 18 tests: normalize, score, rank
    POIService.test.ts               # 7 tests: search, aliases, thresholds, limits
    ValhallaBridge.test.ts           # 5 tests: asset states, delegation
    DisruptionService.test.ts        # 8 tests: source filtering, cache TTL
    NodeFixtureAssetLoader.test.ts   # 2 tests: contract exposure, asset conversion
    SqliteEntityRecordLoader.test.ts # 2 tests: SQLite loading (requires sqlite3 CLI)
    TubeGraphTransforms.test.ts      # 6 tests: segment building, line changes
    app/
      RuleBasedModelBridge.test.ts   # 2 tests: route extraction, ambiguity
      AssetPathResolver.test.ts      # 2 tests: path normalization, multi-source resolution
  golden/                            # Integration tests
    runner.test.ts                   # 12 parametric cases + hallucination + device ID tests
    fixtures/
      query-pipeline-cases.json      # Golden test case definitions
    schemas/
      queryPipelineResult.schema.json # Result shape contract
    helpers/
      hallucinationAssertion.ts      # Hallucination check helper
    types.ts                         # GoldenPipelineCase type definition
```

### How golden tests work

Each case in `query-pipeline-cases.json` defines:
- `rawQuery`: the user input
- `extraction`: the expected IntentExtraction (used by the stub LLM client)
- `expectedStatus`, `expectedIntent`, `expectedRenderedText`: assertions
- `allowedPlaceNames`: whitelist for hallucination checks

The golden runner constructs a full pipeline with stub LLM adapters that return fixture-based responses, then asserts the entire pipeline result matches expectations.

### Adding a new golden test case

1. Add a new object to `tests/golden/fixtures/query-pipeline-cases.json`
2. Provide the `extraction` field — this is what the stub LLM will return
3. Set expected outputs (`expectedStatus`, `expectedRenderedText`, etc.)
4. Set `allowedPlaceNames` — the hallucination guard checks against this list
5. Ensure any referenced entities exist in the `entities` and `pois` arrays in `runner.test.ts`
6. Run `npm test` to verify

### Hallucination assertions

Golden tests verify that rendered output references only allowed place names:

```typescript
assertGoldenOutputHasNoHallucinations(result.rendered.referencedPlaceNames, goldenCase.allowedPlaceNames);
```

This catches cases where the LLM (or stub) introduces location names not grounded in local data.

---

## 9. CI/CD

### GitHub Actions workflow

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

**Job 1: `build-and-test`**
1. Checkout code
2. Setup Node.js 20 with npm cache
3. `npm ci`
4. `npm run build` (TypeScript compilation)
5. Install `sqlite3` CLI
6. `npm run stage2:assets` (generate + assemble + validate SQLite DBs)
7. `npm test` (unit + golden tests)

**Job 2: `bundle`** (depends on job 1 passing)
1. Checkout + setup Node.js 20
2. `npm ci`
3. `npm run bundle:ios`
4. `npm run bundle:android`

### GitHub Pages deployment

`.github/workflows/deploy-pages.yml` deploys the `docs/` directory to GitHub Pages on pushes to `main` that modify `docs/**`.

---

## 10. Coding Conventions

### TypeScript

- **Strict mode**: `"strict": true` in `tsconfig.json` — no implicit any, strict null checks, strict property initialization
- **Target**: ES2022
- **Modules**: ESNext with Bundler resolution (`"type": "module"` in package.json)
- **JSX**: `react-jsx` transform (no `React` import needed)

### File organization

- One class/interface per file when possible
- Contracts/interfaces go in `src/core/runtime/`
- Core logic must not import from `src/app/`
- Platform adapters go in `src/app/pipeline/` or `src/app/adapters/`

### Naming

- Files: PascalCase for classes/components (`EntityResolver.ts`, `GoScreen.tsx`), camelCase for factories/utilities (`createMobilePipeline.ts`)
- Interfaces: no `I` prefix — use descriptive names (`EntityRecord`, not `IEntityRecord`)
- Types: prefer `interface` for object shapes, `type` for unions/intersections

### Non-negotiable rules

These are hard constraints — violating them is a blocking review issue:

| Rule | Rationale |
|------|-----------|
| No cloud AI APIs | Offline-first identity; privacy guarantee |
| No Expo Go | Bare workflow required for llama.rn + native SQLite |
| No user accounts/login in MVP | Scope constraint |
| EntityResolver before routing/search | Prevents LLM hallucination in location grounding |
| Location names in original English | Consistent UX across all languages |
| Hallucination rejection | Safety: fabricated place names can misdirect tourists |
| OS-native STT/TTS only | No third-party voice APIs; offline requirement |
| All location grounding via local indices | LLM must not resolve locations from its own knowledge |

### Import style

```typescript
// Node built-ins
import test from 'node:test';
import assert from 'node:assert/strict';

// Internal (use .js extension for ESM compatibility)
import { Dijkstra } from '../../src/core/routing/Dijkstra.js';

// JSON imports use import attributes
import cases from './fixtures/cases.json' with { type: 'json' };
```

---

## 11. Troubleshooting

### `sqlite3: command not found` during data pipeline

The `assemble-sqlite-dbs.js` script shells out to the `sqlite3` CLI. Install it:

```bash
# macOS
brew install sqlite3

# Ubuntu/Debian
sudo apt-get install -y sqlite3

# CI (GitHub Actions)
# Already handled in ci.yml workflow
```

### `pod install` fails

```bash
cd ios
pod deintegrate
pod install --repo-update
cd ..
```

If `pod install` warns about React Native autolinking, run `npx react-native config` to verify native modules are detected.

### Metro bundler can't resolve module

Ensure `.js` extensions are used in all ESM imports. Metro uses the Bundler resolution strategy — TypeScript files are resolved but imports must reference `.js`:

```typescript
// Correct
import { Dijkstra } from '../routing/Dijkstra.js';

// Wrong — will fail in Metro
import { Dijkstra } from '../routing/Dijkstra';
```

### Tests fail with `ERR_UNKNOWN_FILE_EXTENSION`

Ensure `tsx` is installed and you're running tests via npm:

```bash
npm test                              # uses tsx via package.json script
npx tsx --test tests/**/*.test.ts     # direct invocation
```

### Model fails to load on device

1. Verify the GGUF file is at `Documents/models/gemma4-e2b.gguf` (iOS) or `files/models/gemma4-e2b.gguf` (Android)
2. Check Settings screen > Asset Status for the resolved path
3. Tap "Refresh status" to re-probe
4. Check that the file size matches the expected GGUF size (not a partial download)

The app will fall back to rule-based adapters if the model isn't found — check Settings for `fixture-fallback-mode`.

### 2 tests fail locally for SqliteEntityRecordLoader

These tests require `sqlite3` CLI and assembled SQLite databases. Run the data pipeline first:

```bash
npm run stage2:assets
npm test
```

If `sqlite3` is not available in your environment, these 2 tests will fail but all other tests (70+) will pass. The CI workflow installs `sqlite3` so these pass in CI.

### react-native-sqlite-storage warning during bundling

If bundling prints a configuration warning for `react-native-sqlite-storage`, this is expected. The package is installed and native config is correct. Verify with:

```bash
npx react-native config
```

Bundling will succeed despite the warning.

---

## 12. Decision Log

Key architectural decisions and their rationale:

### On-device LLM via llama.rn (not cloud API)

**Decision:** All AI inference runs on-device using Gemma 4 E2B via `llama.rn`.

**Rationale:** The core product promise is offline functionality. Cloud APIs fail underground, on flights, and without data plans — exactly when tourists need help most. On-device inference also avoids per-query costs and data privacy concerns.

**Trade-off:** Model quality is lower than cloud models, hence the strict pipeline design where the LLM only does intent extraction and text rendering — never location resolution or routing.

### EntityResolver mandatory before routing

**Decision:** All location names must be grounded through local data indices before any routing or search operation.

**Rationale:** LLMs hallucinate place names. A tourist asking "How do I get to Kensington Palace?" could receive directions to a non-existent station if the LLM resolves the name. EntityResolver ensures every location maps to a verified local record.

### Two-layer core/app split

**Decision:** `src/core/` has zero React Native dependencies and is fully testable in Node.js.

**Rationale:** Faster development cycle — core logic can be developed, tested, and validated without building a mobile app. Also enables future platform ports (web, desktop) by keeping the core portable.

### Rule-based fallback for LLM adapters

**Decision:** Every LLM adapter has a regex/template fallback that activates automatically when the model isn't available.

**Rationale:** The Gemma model requires a ~2-4GB download and device-specific loading. The app must be functional immediately after install, before the user downloads the model. Rule-based fallback provides degraded but usable intent detection in 5 languages.

### Node.js native test module (not Jest)

**Decision:** Tests use `node:test` with `tsx` runner instead of Jest or Mocha.

**Rationale:** Zero configuration, no transform complexity, native ESM support, fast startup. The project uses ES modules and JSON import attributes — Jest requires extensive configuration for this setup. `node:test` works out of the box with `tsx`.

### FuzzyMatcher over Fuse.js for entity resolution

**Decision:** Entity resolution uses a custom `FuzzyMatcher` (Levenshtein + token overlap) instead of the Fuse.js library already in dependencies.

**Rationale:** Fuse.js is used in the rule-based fallback for station matching, but EntityResolver needs precise control over scoring thresholds and disambiguation logic. The custom matcher exposes raw scores that map directly to the resolution thresholds, which Fuse.js's opaque scoring doesn't support.

### Fixture-based data pipeline

**Decision:** Data assets are generated from deterministic seed files rather than fetched from live APIs during development.

**Rationale:** Reproducible builds — every developer gets identical assets. No API key management, no rate limits, no network dependency during development. Production data ingestion is a separate phase that replaces the seeds while preserving the schema contracts.

### Apache 2.0 license

**Decision:** The project uses Apache License 2.0.

**Rationale:** Permissive open-source license that allows commercial use, modification, and distribution while providing patent protection. Compatible with the React Native ecosystem and most dependencies.
