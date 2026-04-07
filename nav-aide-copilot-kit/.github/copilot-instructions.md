# NAV AiDE — Repository-wide Copilot Instructions

This repository contains **NAV AiDE**, a fully offline, AI-powered London travel assistant for international tourists, plus a simple GitHub Pages marketing site.

Read these instructions before making any changes. If a more specific path-based instructions file applies, use both this file and the path-based file.

## Non-negotiable architecture

- NAV AiDE MVP uses **OS STT** for speech recognition and **OS TTS** for speech output.
- **Gemma 4 E2B via `llama.rn` is the only LLM** and is used only for:
  - structured intent extraction
  - natural-language response rendering
- The LLM must **not** do routing, POI lookup, translation as a separate subsystem, or free-form London reasoning.
- All location and entity grounding must resolve through **local indices and routing data**, never through the LLM's own knowledge.

## Product constraints

- Core features must work in **airplane mode**.
- No cloud AI APIs.
- No fallback models.
- No Expo Go.
- No user accounts or login in MVP.
- Location names must remain in **original English** in every output.
- If the LLM output contains a hallucinated place name, reject it and do not display it.

## Implementation priorities

1. Follow the build phases in order.
2. Prefer small, reviewable PRs over giant refactors.
3. Scaffold and test infrastructure first, then feature integration.
4. For mobile code, TypeScript strict mode and React Native bare workflow only.
5. For docs site, use static HTML/CSS only unless explicitly told otherwise.

## Before editing code

- Check whether there is a matching instructions file in `.github/instructions/`.
- Preserve the repository structure requested by the NAV AiDE spec.
- Keep comments concise and useful.
- Do not silently swap libraries, runtimes, or architecture choices.

## Testing expectations

- Core pipeline must be testable in Node.js before app integration.
- Golden tests are required.
- If a change affects entity resolution, routing, prompt parsing, or output rendering, update or add tests.

## When uncertain

- Ask for clarification only if a blocking ambiguity remains after checking the repo instructions.
- Otherwise make the safest interpretation that preserves the offline-first architecture.
