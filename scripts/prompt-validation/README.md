# NAV AiDE Phase 0 Prompt Validation

This directory contains the Phase 0 harness for validating JSON-only intent extraction before any React Native app work begins.

## Files

- `run.js`: validation runner
- `intent-extraction.prompt.md`: reusable prompt template
- `intent-schema.json`: reusable JSON schema for extraction output
- `seeds.json`: multilingual seed queries with expected structured output
- `fixtures/stations.json`: station list fixture injected into the prompt

## What It Checks

- station fixture loading
- prompt rendering with a user query
- JSON parsing from the model runner
- response shape against the explicit schema contract
- detected language correctness for each seed
- writes the latest run summary and per-seed details to `scripts/prompt-validation/results/`

## Quick Start

Run the mock harness:

```bash
node scripts/prompt-validation/run.js
```

Run against a local command that reads the prompt on stdin and writes JSON to stdout:

```bash
node scripts/prompt-validation/run.js --runner command --command "your-local-model-command"
```

Or set the command once:

```bash
export NAV_AIDE_PHASE0_COMMAND="your-local-model-command"
node scripts/prompt-validation/run.js --runner command
```

Run against a local Ollama daemon using schema-constrained JSON generation:

```bash
node scripts/prompt-validation/run.js --runner ollama --model gemma4:e2b
```

Override the default Ollama URL if needed:

```bash
export NAV_AIDE_PHASE0_OLLAMA_URL="http://127.0.0.1:11434"
export NAV_AIDE_PHASE0_MODEL="gemma4:e2b"
node scripts/prompt-validation/run.js --runner ollama
```

## Current Limitation

This repository still does not include a checked-in `llama.rn` integration path, so the Phase 0 harness validates against a local Ollama daemon for now. That is sufficient for prompt validation, but it is not yet the final in-app runtime.

## Expected Exit Codes

- `0`: every seed passed
- `1`: at least one seed failed or the configured command could not run

## Output Files

- `results/latest-summary.json`: top-level pass and fail summary
- `results/latest-details.json`: expected versus actual output for every seed