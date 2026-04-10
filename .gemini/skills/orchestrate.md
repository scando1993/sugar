# Phased Software Engineering Execution

Execute large refactors, migrations, feature work, testing efforts, and modularization through strict phases. Each subagent runs in an isolated Ralph workspace (CLAUDE.md + prd.json + progress.txt) and executes autonomously.

## Reference

The **Sugar** library (`src/lib/`) is the source of truth for all execution logic. Skills delegate to `sugar` CLI commands for workspace management, story state, consensus, and pattern propagation. Do not embed procedural bash scripts or Python one-liners — use Sugar CLI instead.

## Iron Laws

- `NEVER MOVE TO THE NEXT PHASE WITHOUT EXPLICIT USER APPROVAL`
- `ONE STORY PER ITERATION — IMPLEMENT ONE, THEN STOP`
- `NEVER COMMIT CODE THAT FAILS QUALITY CHECKS`
- `READ PROGRESS.TXT BEFORE WRITING A SINGLE LINE`

## Prompt Reinforcement

Use **prompt repetition** at every decision boundary: state the task, provide context, give the instruction, restate context briefly, repeat the instruction. Apply at skill level, subagent level, and per-story.

---

## Phases Overview

### Phase 1 — Planning

Analyze the task and produce a complete execution plan. Do not implement any code.

Create `plan.md` at repo root:
- Objective, scope, assumptions, constraints, risks
- Dependency map — which parts depend on other parts
- Architecture / refactor / testing strategy
- Execution phases with dependency annotations
- Blockers

Create `todo.md` at repo root:
- Small, actionable, idempotent tasks grouped by phase
- Checkbox progress tracking (`- [ ]`)
- Dependency annotations per task
- Completion criteria per phase

**Rules:** Do not implement anything or create branches. Stop and wait for user approval.

---

### Phase 2 — Workspace and Branch Setup

Create an isolated Ralph workspace for each execution phase.

Use the Sugar CLI to create workspaces:

```bash
# Create workspace for each phase
sugar workspace create <phase-name>

# List created workspaces
sugar workspace list
```

Branch naming: `phase-a-<scope>`, `phase-b-<scope>`, etc.

**Rules:** One worktree per phase, one branch per phase. Do not start implementation without user approval.

---

### Phase 3 — Dependency Analysis, PRD Generation, and Parallel Implementation

Three sub-phases: **3a -> 3b -> 3c**.

#### Phase 3a — Dependency Analysis

For each phase determine: Produces, Consumes, Hard dependencies, Soft dependencies, Independence. Build the dependency graph. Identify parallel groups, sequential chains, and critical path.

#### Phase 3b — Generate Workspace Files

The Sugar library generates all workspace files. Use CLI commands:

```bash
# Initialize config if not present
sugar config init

# The orchestrator generates: execution.md, prd.json, CLAUDE.md, VERIFY.md, ralph-loop.sh per workspace
```

For each workspace, the library generates:
- **`prd.json`** — Ralph-format user stories with consensus state machine
- **`CLAUDE.md`** — Agent instructions with iron laws, quality protocol, red flags
- **`VERIFY.md`** — Verifier agent instructions with vote format
- **`ralph-loop.sh`** — Iteration engine that spawns fresh agents per story
- **`execution.md`** at repo root — dependency graph, parallel groups, model strategy

Story rules: completable in one pass, ordered by dependency, verifiable criteria, always include "Typecheck passes".

Validate each workspace: `sugar validate <workspace>/prd.json`

#### Phase 3c — Parallel Execution

Launch `ralph-loop.sh` for each phase following `execution.md` group ordering:

```bash
# Launch all independent phases in parallel
/tmp/<repo>-phases/phase-a/ralph-loop.sh 20 sonnet &
/tmp/<repo>-phases/phase-b/ralph-loop.sh 20 sonnet &
wait

# Propagate patterns between groups
sugar propagate-patterns --base /tmp/<repo>-phases

# Launch next group
/tmp/<repo>-phases/phase-c/ralph-loop.sh 20 sonnet &
wait
```

The `ralph-loop.sh` uses Sugar CLI for state management:
- `sugar pick-story` — get next story
- `sugar story-update` — update story status in prd.json
- `sugar snapshot` — create git snapshot tag before each attempt

Between groups: `sugar propagate-patterns` to extract and inject patterns.
Monitor progress: `sugar status-all /tmp/<repo>-phases`

**Model selection per phase:**
- **Sonnet** (default): Well-scoped implementation tasks, refactors, migrations
- **Haiku**: Mechanical tasks — config changes, simple file operations, boilerplate
- **Opus**: Complex architectural decisions, cross-cutting refactors, ambiguous requirements
- Auto-escalates to Opus on 2+ consecutive failures

---

### Phase 4 — Merge

Safely integrate all completed phase branches.

```bash
# View workspace status first
sugar status-all /tmp/<repo>-phases
```

Create `merge_order.md` at repo root: merge order aligned with dependency graph, rationale, expected conflict areas, conflict resolution notes, validation steps.

Post-merge validation: complete test suite, typecheck, lint, quality checks. Phase 4 is NOT complete until the final merged result passes all checks.

Cleanup:

```bash
sugar workspace cleanup
```

---

## How to Interpret User Requests

| User says | Start from |
|---|---|
| Planning only / no qualifier | Phase 1 |
| Planning is approved | Phase 2 |
| Setup is done | Phase 3 (3a -> 3b -> 3c) |
| PRDs exist, ready to implement | Phase 3c |
| All branches done, wants merge | Phase 4 |
| Testing only | Phase 1 (testing strategy), then normal flow |

---

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll just implement two quick stories in one iteration" | ONE story per iteration. The loop handles iteration. No exceptions. |
| "The tests mostly pass, I'll commit and fix later" | ALL commits must pass quality checks. Broken commits poison every future iteration. |
| "This dependency isn't really needed, I'll skip it" | The dependency graph exists for a reason. Never start dependent work before prerequisites complete. |
| "I know what changed, I don't need to read progress.txt" | Progress.txt IS your memory. You have NO context without it. Read it FIRST. |
| "This is a trivial change, I don't need to run checks" | Every commit gets checked. No exceptions. The one you skip is the one that breaks everything. |
| "I'll refactor this while I'm here" | Stay in scope. Implement the story. Nothing more. |

---

## Execution Rules

### Source of Truth
- Before Phase 3c: `todo.md`
- During Phase 3c: each workspace's `prd.json`
- After each phase: sync back to `todo.md`

### Commits
- One per story: `feat: [Story ID] - [Story Title]`
- Must pass quality checks
- Never bundle unrelated changes

### General
- Never skip phases or continue without approval
- Keep all tracking files current
- Document assumptions and blockers explicitly
- Propagate codebase patterns between groups

---

## Managed Files

| File | Location | Created in |
|---|---|---|
| `plan.md` | repo root | Phase 1 |
| `todo.md` | repo root | Phase 1 |
| `execution.md` | repo root | Phase 3b |
| `prd.json` | each worktree | Phase 3b |
| `progress.txt` | each worktree | Phase 2 |
| `CLAUDE.md` | each worktree | Phase 3b |
| `ralph-loop.sh` | each worktree | Phase 3b |
| `VERIFY.md` | each worktree | Phase 3b |
| `patterns.json` | repo root | Phase 3c |
| `merge_order.md` | repo root | Phase 4 |

---

## Abort and Cleanup

```bash
sugar workspace cleanup
```

**The first deliverable is always Phase 1 planning only**, unless the user explicitly states that a later phase is already approved.
