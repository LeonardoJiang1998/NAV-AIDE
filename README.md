# NAV AiDE Copilot Kit

This package converts your original `prompt.md` into a **Copilot-ready file set** for both IDE-based workflows and repository/cloud-agent workflows.

## What's included

- `.github/copilot-instructions.md` — repository-wide instructions
- `.github/instructions/*.instructions.md` — path-specific instructions
- `.github/prompts/*.prompt.md` — phased prompt files for IDE prompt-file workflows
- `AGENTS.md` — agent instructions supported by Copilot cloud agent and CLI contexts
- `.github/agents/nav-aide-builder.agent.md` — custom agent profile for IDE workflows that support custom agents

## Why this structure

GitHub's docs support several related but different mechanisms:

- repository-wide custom instructions via `.github/copilot-instructions.md`
- path-specific instructions via `.github/instructions/**/*.instructions.md`
- prompt files in `.github/prompts/*.prompt.md`
- agent instructions via `AGENTS.md`
- custom agent profiles in `.github/agents/*.agent.md`

This kit gives you all of them in a way that fits NAV AiDE's phased build approach.

## Suggested usage

### Option A — VS Code / JetBrains / IDE workflow

1. Copy the files into the root of your repository.
2. Use the prompt files from `.github/prompts/` phase by phase.
3. Optionally select the `nav-aide-builder` custom agent if your IDE supports it.

### Option B — GitHub repository / cloud agent workflow

1. Copy:
   - `.github/copilot-instructions.md`
   - `.github/instructions/`
   - `AGENTS.md`
2. Ask the agent to start with the earliest unfinished phase.
3. Use the phased prompt files as task briefs if needed.

## Recommended order

1. `nav-aide-phase-0.prompt.md`
2. `nav-aide-phase-1.prompt.md`
3. `nav-aide-phase-2.prompt.md`
4. `nav-aide-phase-3.prompt.md`
5. `nav-aide-phase-4.prompt.md`
6. `nav-aide-phase-5.prompt.md`
7. `nav-aide-github-pages.prompt.md`

## Notes

- This kit is intentionally split by phase because a single giant one-shot prompt is much less reliable for a React Native + offline-data + GitHub Pages project.
- Review and adjust commands, dependency versions, and CI details inside your actual repo before running everything end to end.
