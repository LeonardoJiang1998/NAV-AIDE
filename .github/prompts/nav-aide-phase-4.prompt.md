# NAV AiDE — Phase 4 Feature Integration

Use this prompt in Copilot Agent mode to execute **Phase 4 only**.

## Goal

Integrate the user-facing screens with the already-built core pipeline.

## Required work

### GO
- map with blue dot
- text + voice search
- transport selector
- route card
- TTS playback
- post-journey feedback

### LOST?
- Signpost flow using EntityResolver directly
- Ask People flow using OS STT -> LLM normalize -> EntityResolver
- disambiguation UI

### Maps
- layer toggles
- navigate-here CTA

### Settings
- preferences
- permissions
- feedback queue UI
- device info
- offline content status/update UI
- attributions

## Rules

- Never let the LLM resolve a location directly.
- Never proceed when entity confidence requires disambiguation.
- Preserve all required error states.

## Acceptance criteria

- End-to-end mobile flow exists
- All 4 menus are functional at MVP level
- Error states are wired into UI
