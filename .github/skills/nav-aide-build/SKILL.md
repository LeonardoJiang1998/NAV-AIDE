---
name: nav-aide-build
description: 'Build or continue NAV AiDE in phased order. Use when asked to build NAV AiDE, continue the app, implement the next unfinished phase, work on a specific phase, scaffold the offline-first mobile app, or update the GitHub Pages site without violating the repository architecture.'
argument-hint: 'Describe the scope, for example: "build the next unfinished phase" or "phase 2 only"'
user-invocable: true
---

# NAV AiDE Build

Use this skill for repeatable NAV AiDE implementation work. It turns broad requests such as "build the app" into a constrained workflow that respects the repository architecture, phase order, and acceptance checks.

## Load Before Coding

Always read these files first:

- `.github/copilot-instructions.md`
- `AGENTS.md`
- `.github/instructions/mobile.instructions.md` when touching `src/`, `tests/`, `scripts/`, `assets/`, `android/`, or `ios/`
- `.github/instructions/docs.instructions.md` when touching `docs/` or `README.md`

If the workspace includes `.github/agents/nav-aide-builder.agent.md` and the request is broad, you may use that custom agent for context isolation. If not, follow this same workflow directly in the current agent.

## When To Use

Use this skill when the request includes any of these intents:

- build NAV AiDE
- continue NAV AiDE
- implement the next phase
- scaffold the mobile app
- work on phase 0, 1, 2, 3, or 4
- finish the offline-first app foundation
- update the NAV AiDE GitHub Pages site without touching mobile code

## Hard Constraints

Never violate these rules:

- Offline-first core features must work without network access.
- OS STT is required for speech input.
- OS TTS is required for speech output.
- Gemma 4 E2B via `llama.rn` is the only LLM.
- The LLM is only for structured intent extraction and natural-language response rendering.
- The LLM must never do routing, POI lookup, translation as a separate subsystem, or free-form London reasoning.
- All place grounding must go through local indices and routing data.
- Reject hallucinated place names.
- Keep location names in original English in every output.
- No cloud AI APIs, no fallback models, no Expo Go, no accounts or login in MVP.

## Build Workflow

1. Classify the request.
   - Docs-site only: limit edits to `docs/` and related top-level docs.
   - Specific phase: do only that phase.
   - Broad app build request: find the earliest unfinished phase and stop after completing that phase.

2. Determine the current target phase.
   - Start with Phase 0 and move forward only when its acceptance criteria are satisfied.
   - Do not assume a later phase is valid just because some files exist.
   - Use the phase prompts in `.github/prompts/` as the source of truth for scope and acceptance criteria.

3. Choose the earliest unfinished phase using these checks.
   - Phase 0 is unfinished if `scripts/prompt-validation/` or its validation harness, multilingual seed inputs, schema checks, or README are missing.
   - Phase 1 is unfinished if offline asset scaffolding is missing, or if `Dijkstra`, `FuzzyMatcher`, `EntityResolver`, or their tests are absent or failing.
   - Phase 2 is unfinished if `QueryPipeline`, `IntentExtractor`, `ResponseRenderer`, `POIService`, `ValhallaBridge`, disruption/cache interfaces, analytics modules, or `tests/golden/` are missing.
   - Phase 3 is unfinished if the bare React Native TypeScript shell, 4-tab navigation, download scaffolding, map integration points, or `llama.rn` model-loading skeleton are missing.
   - Phase 4 is unfinished if GO, LOST?, Maps, and Settings MVP flows are not wired end to end with required error states.

4. Open the authoritative prompt for the chosen phase.
   - Phase 0: `.github/prompts/nav-aide-phase-0.prompt.md`
   - Phase 1: `.github/prompts/nav-aide-phase-1.prompt.md`
   - Phase 2: `.github/prompts/nav-aide-phase-2.prompt.md`
   - Phase 3: `.github/prompts/nav-aide-phase-3.prompt.md`
   - Phase 4: `.github/prompts/nav-aide-phase-4.prompt.md`
   - Docs site only: `.github/instructions/docs.instructions.md`

5. Implement only the selected phase.
   - Prefer the smallest complete slice that satisfies the phase prompt.
   - Fix root causes rather than adding placeholders that cannot be validated.
   - For Phases 0 through 2, keep the core pipeline testable in Node.js before app integration.
   - Do not build app screens before Phase 3.
   - Do not leak work from one phase into the next unless the prompt explicitly requires it.

6. Validate before stopping.
   - Run relevant tests for the phase.
   - Add or update tests when changing entity resolution, routing, prompt parsing, or response rendering.
   - Preserve golden tests or add them when Phase 2 behavior changes.
   - Verify hallucinated place names are rejected before output reaches the user.
   - Confirm the acceptance criteria from the chosen phase prompt are met.

7. Stop cleanly at the phase boundary.
   - Summarize what changed.
   - State what tests or checks ran.
   - Name the next unfinished phase, if any.

## Decision Points

- If the user says "build NAV AiDE" without a phase, start at the earliest unfinished phase.
- If the user asks for a later phase but earlier phases are clearly incomplete, call that out and recommend finishing the earliest unfinished phase first.
- If the user asks for docs or the GitHub Pages site, do not expand into mobile app work.
- If a request would break the offline-first architecture, refuse that part and continue with a compliant implementation.

## Phase Completion Checks

- Phase 0: prompt validation harness runs locally, JSON shape is validated, and at least 30 multilingual seeds exist.
- Phase 1: offline assets are represented in scaffolding, Dijkstra tests pass, and EntityResolver tests pass.
- Phase 2: pipeline modules compile, the golden test framework exists, and hallucinated place names are asserted against.
- Phase 3: the app shell builds, 4 tabs exist, download flow is scaffolded, and model/map integration paths exist.
- Phase 4: the four MVP menus are functional, end-to-end flows exist, and required UI error states are wired.

## Output Style

- Keep progress updates short and factual.
- Explain assumptions only when they affect implementation decisions.
- End with the completed phase, verification status, and the next safe step.