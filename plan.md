# Refactor Plan: Extract Core Engine into TypeScript Library

## Objective

Extract the ralph loop, consensus algorithm, dependency analysis, pattern propagation, workspace management, and model tiering from skill markdown files into a TypeScript library (`src/`). Skills across all 8 platforms become thin wrappers that invoke the library via CLI commands. The library is also usable standalone for custom implementations.

## Problem

All orchestration logic currently lives as procedural markdown in `SKILL.md` files (656 lines in orchestrate alone). This means:

1. **Every platform duplicates logic** — 8 copies of the same ralph loop, consensus algorithm, etc. across `.claude/`, `.github/`, `.cursor/`, `.windsurf/`, `.cline/`, `.agents/`, `.opencode/`, `.gemini/`
2. **Updates require syncing 8 platforms** — change consensus quorum size = edit 8+ files
3. **No testability** — logic in markdown can't be unit tested
4. **No reuse** — external projects can't import the ralph loop or consensus algorithm as a library
5. **Embedded bash scripts** — `ralph-loop.sh` is generated inline from SKILL.md template strings

## Solution

Single TypeScript codebase as source of truth. Skills become thin instruction layers that tell the agent: "run `npx sugar <command>`". The library exposes both CLI and programmatic API.

## Architecture

```
src/
  index.ts              <-- CLI entry point (existing + new commands)
  types.ts              <-- Shared types (existing + expanded)
  lib/
    ralph-loop.ts       <-- Ralph iteration engine
    consensus.ts        <-- Verifier quorum + vote tally
    workspace.ts        <-- Worktree creation, template generation
    dependency.ts       <-- Dependency graph, parallel groups, critical path
    patterns.ts         <-- Pattern extraction + propagation
    orchestrator.ts     <-- Phase state machine, group execution
    model-tier.ts       <-- Model escalation / de-escalation logic
    templates/
      claude-md.ts      <-- CLAUDE.md template generator
      verify-md.ts      <-- VERIFY.md template generator
      ralph-loop-sh.ts  <-- ralph-loop.sh script generator
```

## Scope

### In scope

- Extract ralph loop logic from SKILL.md → `src/lib/ralph-loop.ts`
- Extract consensus algorithm → `src/lib/consensus.ts`
- Extract dependency analysis → `src/lib/dependency.ts`
- Extract pattern propagation → `src/lib/patterns.ts`
- Extract workspace setup → `src/lib/workspace.ts`
- Extract model tiering → `src/lib/model-tier.ts`
- Create orchestrator (phase state machine) → `src/lib/orchestrator.ts`
- Template generators for CLAUDE.md, VERIFY.md, ralph-loop.sh
- New CLI commands: `sugar run`, `sugar workspace`, `sugar analyze`, `sugar merge`
- Thin down all 8 platform skill files to invoke CLI
- Expose programmatic API via `src/lib/index.ts` for library consumers
- Unit tests for each module

### Out of scope

- Changing the workflow itself (phases, iron laws, story format)
- Changing prd.json schema
- New features beyond what SKILL.md already describes
- Platform-specific agent behavior (that stays in skill files)

## Dependency Map

```
Phase A: Core types + interfaces
  └── produces: expanded types.ts, config schema, event types
  └── depends on: nothing

Phase B: Library modules
  └── produces: ralph-loop.ts, consensus.ts, dependency.ts, patterns.ts, workspace.ts, model-tier.ts
  └── depends on: Phase A (types)

Phase C: Template generators
  └── produces: claude-md.ts, verify-md.ts, ralph-loop-sh.ts
  └── depends on: Phase A (types), Phase B (workspace for context)

Phase D: Orchestrator + CLI
  └── produces: orchestrator.ts, expanded CLI commands
  └── depends on: Phase B (all modules), Phase C (templates)

Phase E: Thin skills refactor
  └── produces: simplified SKILL.md files across 8 platforms
  └── depends on: Phase D (CLI must be working first)

Phase F: Tests
  └── produces: unit tests for all lib modules
  └── depends on: Phase B, Phase C, Phase D
```

## Parallel Groups

```
Group 1: [Phase A]                    — no deps
Group 2: [Phase B, Phase F-setup]     — after A
Group 3: [Phase C]                    — after A, B
Group 4: [Phase D]                    — after B, C
Group 5: [Phase E, Phase F-run]       — after D
```

## Critical Path

A → B → C → D → E

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SKILL.md has implicit agent-only logic (prompt repetition, red flags table) that can't be code | Skills too thin, lose agent guidance | Skills keep behavioral/prompt sections, only delegate execution commands |
| ralph-loop.sh calls `claude` CLI directly — library can't replace that | Loop still needs bash shim | Library generates the script; script calls library for state management |
| Breaking existing users who installed skills manually | Skills stop working after update | Backward compat: skills work standalone AND with library. Library enhances, doesn't replace |
| Consensus verification needs actual LLM calls | Can't unit test easily | Mock LLM interface, test vote tallying + state transitions in isolation |

## Key Design Decisions

1. **Skills = behavioral instructions + CLI delegation** — Skills still tell agents HOW to think (iron laws, red flags, prompt repetition). They delegate WHAT to execute to `npx sugar <command>`.

2. **ralph-loop.sh generated, not replaced** — The bash loop spawns fresh agent instances. Library generates it with correct config. Library also handles state (prd.json updates, vote tallying) that the bash script currently does inline with Python one-liners.

3. **Library-first, CLI second** — All logic lives in importable TypeScript modules. CLI is a thin wrapper. External projects can `import { RalphLoop, ConsensusEngine } from 'sugar'`.

4. **Config-driven** — `sugar.config.json` at repo root defines models, quorum size, escalation thresholds, quality check commands. Skills and ralph-loop.sh read from this instead of hardcoded values.

## Constraints

- Must remain compatible with all 8 platforms
- Must not change the user-facing workflow (4 phases, approval gates)
- Must not change prd.json schema (backward compat with existing PRD files)
- Node.js >= 18 (already in package.json)
