# NAV AiDE

**Your AI London guide. Works underground.**

NAV AiDE is an offline-first London travel assistant built for international tourists. It runs entirely on-device — no cloud APIs, no internet required — so core features work in airplane mode, on the Tube, and anywhere you lose signal. Voice input supports 140+ languages while keeping all location names grounded in English through local data indices.

## Features

- **Voice input in 140+ languages** — OS-native speech-to-text with on-device intent extraction
- **Offline tube and bus routing** — Dijkstra shortest-path on a local transport graph
- **Walking directions** — offline turn-by-turn via Valhalla tile engine
- **POI search** — full-text search over local points of interest using SQLite FTS5
- **On-device AI** — Gemma 4 E2B running locally via `llama.rn`, used strictly for intent extraction and natural-language responses
- **Offline maps** — MapLibre GL rendering with bundled MBTiles
- **LOST? recovery helper** — a dedicated screen for tourists who are disoriented, providing step-by-step guidance to reorient
- **Text-to-speech output** — OS-native TTS reads responses aloud in the user's language

## App Screens

The MVP has four screens accessible via bottom tab navigation:

| Screen | Purpose |
|--------|---------|
| **GO** | Main query interface — ask for routes, nearby POIs, or general London travel help |
| **LOST?** | Panic-mode helper for disoriented tourists — guides you back to safety |
| **Maps** | Offline map viewer with station and POI overlays |
| **Settings** | Asset status checks, permission management, runtime diagnostics |

## Architecture

NAV AiDE uses a two-layer design that separates pure business logic from mobile platform code:

- **`src/core/`** — Offline business logic with zero React Native dependencies. Fully testable in Node.js.
- **`src/app/`** — React Native shell, mobile adapters, and screens. Depends on core.

### Query Pipeline

Every user query flows through this pipeline in order:

```
rawInput → FuzzyMatcher → IntentExtractor → EntityResolver → POIService / Dijkstra → ValhallaBridge → ResponseRenderer
```

**EntityResolver** runs before any routing or search — the LLM never resolves locations. All location grounding uses local indices. If confidence is below threshold, the app shows disambiguation options instead of guessing.

### Key Modules

| Area | Module | Purpose |
|------|--------|---------|
| Routing | `src/core/routing/Dijkstra.ts` | Shortest path on tube graph |
| Routing | `src/core/routing/ValhallaBridge.ts` | Walking routes via offline Valhalla tiles |
| Search | `src/core/poi/FuzzyMatcher.ts` | Fuzzy string matching for quick lookups |
| Search | `src/core/poi/POIService.ts` | SQLite FTS5 POI search |
| Pipeline | `src/core/pipeline/QueryPipeline.ts` | Main query orchestrator |
| Pipeline | `src/core/pipeline/EntityResolver.ts` | Location and station name resolution |
| LLM | `src/core/llm/IntentExtractor.ts` | Structured intent extraction |
| LLM | `src/core/llm/ResponseRenderer.ts` | Natural language response generation |
| Contracts | `src/core/runtime/` | Runtime abstractions (model adapter, offline runtime, device ID) |
| Mobile | `src/app/pipeline/createMobilePipeline.ts` | Composes RN-safe QueryPipeline |
| Mobile | `src/app/screens/` | GO, LOST?, Maps, Settings screens |
| Mobile | `src/app/state/AppShellContext.tsx` | Global app state via React Context |

## Getting Started

### Prerequisites

- **Node.js 20+**
- **React Native CLI** (not Expo)
- **Xcode** (for iOS builds)
- **Android SDK** (for Android builds)
- **CocoaPods** (for iOS native dependencies)

### Install

```bash
npm install
cd ios && pod install && cd ..   # iOS only
```

### Generate Data Assets

The data pipeline builds deterministic fixture-based JSON assets and SQLite databases:

```bash
npm run stage2:sql        # generate JSON + SQL scaffolds
npm run stage2:assemble   # assemble SQLite DBs from generated SQL
npm run stage2:validate   # validate DB tables, FTS, and seed rows
```

Or run the full pipeline in one step:

```bash
npm run stage2:assets
```

### Build

```bash
npm run build             # TypeScript compilation
```

### Test

```bash
npm test                  # runs all unit and golden tests
```

### Run

```bash
npm start                 # start Metro dev server
npm run ios               # run on iOS simulator/device
npm run android           # run on Android emulator/device
```

### Bundle

```bash
npm run bundle:ios
npm run bundle:android
```

## Project Structure

```
NAV-AIDE/
├── src/
│   ├── core/             # Pure offline business logic (Node-testable)
│   │   ├── routing/      # Dijkstra, ValhallaBridge
│   │   ├── poi/          # FuzzyMatcher, POIService
│   │   ├── pipeline/     # QueryPipeline, EntityResolver
│   │   ├── llm/          # IntentExtractor, ResponseRenderer
│   │   ├── runtime/      # Runtime abstraction contracts
│   │   └── services/     # DisruptionService
│   └── app/              # React Native shell
│       ├── screens/      # GO, LOST?, Maps, Settings
│       ├── pipeline/     # Mobile pipeline factory
│       └── state/        # AppShellContext (global state)
├── assets/               # Bundled fixture data
│   ├── tubeGraph.json    # London tube network graph
│   ├── busRoutes.json    # London bus routes
│   └── data/             # Generated SQLite DBs (pois.db, location_aliases.db)
├── scripts/
│   └── data-pipeline/    # Asset generation and validation scripts
├── tests/
│   ├── unit/             # Unit tests (Dijkstra, EntityResolver, etc.)
│   └── golden/           # Integration tests with fixture-based assertions
├── docs/                 # Static GitHub Pages marketing site
├── ios/                  # iOS platform code
└── android/              # Android platform code
```

## Data Pipeline

NAV AiDE uses a deterministic, fixture-based data pipeline to generate its offline assets:

1. **`build-tube-graph.js`** — generates `assets/tubeGraph.json` (London tube network)
2. **`generate-bus-routes.js`** — generates `assets/busRoutes.json` (London bus routes)
3. **`generate-pois-db.js`** — generates SQL scaffolds for the POI database
4. **`generate-location-aliases-db.js`** — generates SQL scaffolds for location aliases
5. **`assemble-sqlite-dbs.js`** — assembles real SQLite databases from the SQL scaffolds
6. **`validate-sqlite-dbs.ts`** — validates tables, FTS indices, and seed rows

The current assets are deterministic fixtures suitable for development and testing. Production data ingestion (licensed transport datasets, curated POI exports) will replace these fixtures in a later phase.

## Testing

Tests use the **Node.js native test module** with the `tsx` runner — no Jest or Mocha.

- **Unit tests** (`tests/unit/`) — cover Dijkstra routing, EntityResolver, asset loaders, and model bridge
- **Golden tests** (`tests/golden/`) — integration tests with fixture-based assertions and hallucination checks; test cases defined in `tests/golden/fixtures/query-pipeline-cases.json`

Run all tests:

```bash
npm test
```

Full verification (data pipeline + build + tests):

```bash
npm run stage2:test
```

## Contributing

Contributions are welcome. Please follow these guidelines:

### Workflow

1. Fork the repository and create a feature branch
2. Make your changes
3. Run `npm run build` to verify TypeScript compilation passes
4. Run `npm test` to verify all tests pass
5. Submit a pull request with a clear description of your changes

### Code Standards

- **TypeScript strict mode** — all code must pass strict type checking
- **ES modules** — the project uses `"type": "module"` with ES2022 target
- **Node-testable core** — business logic in `src/core/` must remain testable in Node.js without React Native dependencies
- Changes to entity resolution, routing, prompt parsing, or output rendering **require test updates**

### Non-Negotiable Constraints

These rules define the project's identity and must not be violated:

- **No cloud AI APIs** — all inference runs on-device via `llama.rn`
- **No Expo Go** — React Native bare workflow only
- **No user accounts or login** in the MVP
- **No LiteRT-LM** in the MVP
- **EntityResolver before routing/search** — the LLM must never resolve locations
- **Location names in original English** — all outputs must preserve English place names
- **Hallucination rejection** — if the LLM produces an unrecognized place name, reject it
- **OS-native speech services** — `react-native-voice` for STT, `react-native-tts` for TTS
- **All location grounding through local indices** — never through LLM knowledge

### Additional Guidance

- See `CLAUDE.md` for detailed architecture notes, command reference, and coding guidance
- See `AGENTS.md` for AI agent integration rules
- See `.github/instructions/mobile.instructions.md` for mobile-specific development instructions

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native 0.85 (bare workflow) |
| Language | TypeScript (strict mode, ES2022) |
| On-device AI | Gemma 4 E2B via `llama.rn` |
| Maps | MapLibre GL Native |
| Database | SQLite with FTS5 via `react-native-sqlite-storage` |
| Navigation | React Navigation (bottom tabs) |
| Voice input | `@react-native-voice/voice` |
| Voice output | `react-native-tts` |
| Search | Fuse.js (fuzzy matching) |
| Walking routes | Valhalla (offline tiles) |

## License

This project is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full text.

## Acknowledgements

- [OpenStreetMap](https://www.openstreetmap.org/) contributors for map data
- [Transport for London](https://tfl.gov.uk/) for open transport data
