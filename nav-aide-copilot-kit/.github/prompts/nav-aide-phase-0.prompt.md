# NAV AiDE — Phase 0 Prompt Validation

Use this prompt in Copilot Chat / Agent mode to execute **Phase 0 only**.

Your task is to prepare the repository for NAV AiDE prompt validation without starting the React Native app implementation yet.

## Goal

Confirm that Gemma 4 E2B can reliably return clean JSON for intent extraction across multilingual travel queries.

## Required work

1. Create `scripts/prompt-validation/`.
2. Add a small validation harness that:
   - loads a station list fixture
   - runs the intent extraction prompt
   - validates JSON shape
   - checks detected language field
3. Add at least 30 seed test inputs across:
   - English
   - Mandarin
   - Spanish
   - French
   - Arabic
4. Add a short README for how to run the validation locally.
5. Do **not** scaffold the mobile app yet.

## Acceptance criteria

- Phase 0 artifacts only
- No app screens created yet
- Validation harness is runnable
- Prompt and JSON schema are explicit and reusable
