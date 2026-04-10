---
description: "Phased software engineering execution for large refactors, migrations, feature work. Executes through strict planning, workspace setup, dependency analysis, PRD-driven parallel implementation, and merge phases."
mode: primary
---

# Phased Software Engineering Execution

Execute large engineering tasks through strict phases. Each phase requires explicit user approval before proceeding.

## Reference

Subagent execution follows the **Ralph** pattern. Each phase workspace is a self-contained Ralph environment: `CLAUDE.md` (agent instructions), `prd.json` (story state machine), `progress.txt` (learning persistence).

The **Sugar** library (`src/lib/`) is the source of truth for all execution logic. Skills delegate to `sugar` CLI commands for workspace management, story state, consensus, and pattern propagation. Do not embed procedural bash scripts or Python one-liners — use Sugar CLI instead.

## Phases

### Phase 1 — Planning
Produce `plan.md` and `todo.md`. No code. Stop and wait for approval.

### Phase 2 — Workspace Setup

Use the Sugar CLI to create workspaces:

```bash
sugar workspace create <phase-name>
sugar workspace list
```

### Phase 3 — Dependency Analysis + Implementation

Sub-phases: **3a** (dependency analysis) → **3b** (generate workspace files via Sugar) → **3c** (parallel execution).

```bash
# Initialize config
sugar config init

# Validate workspaces
sugar validate <workspace>/prd.json

# Launch ralph loops per group
/tmp/<repo>-phases/phase-a/ralph-loop.sh 20 sonnet &
wait

# Propagate patterns between groups
sugar propagate-patterns --base /tmp/<repo>-phases

# Monitor progress
sugar status-all /tmp/<repo>-phases
```

Sugar CLI commands used by ralph-loop.sh:
- `sugar pick-story` — get next story
- `sugar story-update` — update story status
- `sugar snapshot` — create git snapshot tag

### Phase 4 — Merge

```bash
sugar status-all /tmp/<repo>-phases
sugar workspace cleanup
```

## Iron Laws

1. **ONE STORY per iteration** — no "while I'm here" additions
2. **NEVER COMMIT BROKEN code** — every commit must pass all quality checks
3. **READ PROGRESS.TXT FIRST** — check codebase patterns before writing

## How to Interpret User Requests

| User says | Start from |
|---|---|
| Planning only / no qualifier | Phase 1 |
| Planning is approved | Phase 2 |
| Setup is done | Phase 3 |
| PRDs exist, ready to implement | Phase 3c |
| All branches done, wants merge | Phase 4 |

**First deliverable is always Phase 1 planning only.**

Invoke the `orchestrate` skill for the user's task. Follow the strict phase workflow: Phase 1 (Planning) -> Phase 2 (Workspace Setup) -> Phase 3 (Dependency Analysis + Implementation) -> Phase 4 (Merge). Never skip phases without explicit user approval.
