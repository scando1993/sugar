# Orchestration Skills

This repository contains reusable skills for phased software engineering execution, built for Claude Code and GitHub Copilot.

## Tech stack

- TypeScript 5.5, Node.js
- No runtime dependencies (dev-only: `@types/node`, `typescript`)

## Project structure

```
.claude/skills/           Claude Code skill definitions (SKILL.md per skill)
.github/prompts/          Copilot prompt files (*.prompt.md)
.github/agents/           Copilot custom agent profiles
src/                      TypeScript CLI (validate prd.json, report status)
```

Three skills: **orchestrate** (`/sugar`), **prd** (`/prd`), **ralph** (`/ralph`).

## Commands

```bash
npm run build             # Compile TypeScript
npm run dev               # Watch mode
npm test                  # Run tests (if present)
node dist/index.js validate <prd.json>    # Validate a prd.json file
node dist/index.js status <prd.json>      # Show story completion
node dist/index.js status-all <base-path> # Aggregate progress across phases
```

## Code style

- Strict TypeScript (`strict: true` in tsconfig)
- Types live in `src/types.ts`
- CLI entry point is `src/index.ts`
- No external runtime dependencies — keep it that way

## Boundaries

- Do not add runtime dependencies without explicit approval
- Do not modify the skill instruction format (SKILL.md frontmatter) without updating the corresponding prompt and agent files
- Keep Claude Code skills (`.claude/skills/`), Copilot prompts (`.github/prompts/`), and Copilot agents (`.github/agents/`) in sync when changing behavior
- Never commit secrets or API keys
