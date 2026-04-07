# NAV AiDE — Phase 2 Core Logic in Node.js

Use this prompt in Copilot Agent mode to execute **Phase 2 only**.

## Goal

Build the core pipeline in Node.js before integrating the app UI.

## Required modules

- `src/core/pipeline/QueryPipeline.ts`
- `src/core/llm/IntentExtractor.ts`
- `src/core/llm/ResponseRenderer.ts`
- `src/core/poi/POIService.ts`
- `src/core/routing/ValhallaBridge.ts`
- disruption service with cache-aware interface
- `src/analytics/DeviceID.ts`
- `src/analytics/EventLogger.ts`

## Tests

Create the golden test structure in `tests/golden/` and add:
- fixtures
- schema/types
- runner
- hallucination assertion helper

Do not move on to app screens in this phase.

## Acceptance criteria

- Pipeline modules compile
- Golden test framework exists
- Rendered output is checked for hallucinated place names
- Node.js execution path is primary in this phase
