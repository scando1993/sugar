---
name: 'phase'
description: 'Phased software engineering execution — planning, workspace setup, dependency analysis, PRD-driven parallel implementation (Ralph pattern), and merge. Each phase gets a full Ralph workspace (CLAUDE.md + prd.json + progress.txt) for autonomous execution.'
agent: 'agent'
tools:
  - 'read_file'
  - 'write_file'
  - 'edit_file'
  - 'codebase_search'
  - 'run_in_terminal'
  - 'run_tests'
argument-hint: '<engineering task description>'
---

# Phased Software Engineering Execution

## Task
${input}

---

## Reference

Subagent execution follows the **Ralph** pattern (https://github.com/snarktank/ralph). Each phase workspace is a self-contained Ralph environment: `CLAUDE.md` (agent instructions), `prd.json` (story state machine), `progress.txt` (learning persistence).

The **Sugar** library (`src/lib/`) is the source of truth for all execution logic. Skills delegate to `sugar` CLI commands for workspace management, story state, consensus, and pattern propagation. Do not embed procedural bash scripts or Python one-liners — use Sugar CLI instead.

---

## Prompt reinforcement

Use **prompt repetition** at every decision boundary: state the task, provide context, give the instruction, restate context briefly, repeat the instruction. Apply at skill level, per-phase, and per-story.

---

## Core behavior

Execute in **strict phases**. Never proceed without **explicit user approval**.

Before every phase: **"The original task is: ${input}. This phase's goal is: [goal]."**

---

## Phase 1 — Planning

### Goal
Produce `plan.md` and `todo.md`. No code.

**Restate**: The original task is `${input}`. Planning only.

### Actions

Create `plan.md`: objective, scope, assumptions, constraints, risks, **dependency map**, strategy, execution phases with dependency annotations, blockers.

Create `todo.md`: small actionable tasks grouped by phase, checkboxes, dependency annotations, completion criteria.

### Rules
- Do not implement or create branches
- Stop and wait for approval

---

## Phase 2 — Workspace setup

### Goal
Create isolated Ralph workspaces per phase.

**Restate**: The original task is `${input}`. Create worktrees, no implementation.

### Actions

Use the Sugar CLI to create workspaces:

```bash
# Create workspace for each phase
sugar workspace create <phase-name>

# List created workspaces
sugar workspace list
```

Branch naming: `phase-a-<scope>`, `phase-b-<scope>`, etc.

---

## Phase 3 — Analysis, PRD generation, and parallel implementation

**Restate**: The original task is `${input}`. Analyze dependencies, generate Ralph workspaces, launch parallel subagents.

Sub-phases: **3a → 3b → 3c**.

---

### Phase 3a — Dependency analysis

For each phase: what it produces, consumes, hard/soft dependencies, independence.
Build dependency graph. Identify parallel groups, sequential chains, critical path.

---

### Phase 3b — Generate execution.md, prd.json, and CLAUDE.md per workspace

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

**Story rules:** completable in one pass, ordered by dependency (schema → backend → UI), verifiable criteria, always include "Typecheck passes".

#### `patterns.json` schema (repo root, populated between groups)

```json
{
  "patterns": [
    {
      "id": "P1",
      "learned_in": "phase-a",
      "description": "Use server actions instead of API routes for mutations",
      "applies_to": ["phase-b", "phase-c"],
      "confidence": "high"
    }
  ]
}
```

#### Rules
- Every workspace must have: `prd.json`, `progress.txt`, `CLAUDE.md`, `ralph-loop.sh`, `VERIFY.md`
- Do not proceed to 3c until all workspaces are fully set up
- Validate each `prd.json`: `sugar validate <workspace>/prd.json`

---

### Phase 3c — Parallel execution via ralph-loop.sh

#### How iteration works

Each `ralph-loop.sh` spawns fresh agent instances in a loop — one story per iteration, fresh context each time:

```
ralph-loop.sh
  ├── Iteration 1: claude < CLAUDE.md → implements US-001 → exits
  ├── Iteration 2: claude < CLAUDE.md → implements US-002 → exits
  ├── Iteration 3: claude < CLAUDE.md → outputs PHASE_COMPLETE
  └── Loop exits 0
```

Memory persists via `prd.json` (state), `progress.txt` (learnings), and git (code).

#### Execution

Follow `execution.md` group ordering. Launch ralph loops per group:

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

#### Model selection per phase
- **Sonnet** (default): Well-scoped implementation tasks
- **Haiku**: Mechanical tasks — config changes, boilerplate
- **Opus**: Complex architectural decisions, ambiguous requirements

Auto-escalates to Opus on 2+ consecutive failures.

#### Completion tracking
- Phase complete when `ralph-loop.sh` exits 0
- After each group: `sugar propagate-patterns` to extract and inject patterns
- Monitor progress: `sugar status-all /tmp/<repo>-phases`

#### Rules
- Never start dependent phase before prerequisites complete
- Propagate patterns between groups
- One story per commit

---

## Phase 4 — Merge

**Restate**: The original task is `${input}`. All phases complete. Merge safely.

```bash
# View workspace status first
sugar status-all /tmp/<repo>-phases
```

Create `merge_order.md`: merge order, rationale, expected conflicts, resolution notes, validation steps, post-merge checklist.

**Manual:** stop after `merge_order.md`.

**Automatic:** merge in order, resolve conflicts, validate after each, update notes.

### Post-merge validation
Run full test suite + typecheck + lint on final result. Not complete until all pass.

### Cleanup

```bash
sugar workspace cleanup
```

---

## Iron Laws

Three inviolable rules enforced in every workspace:

1. **ONE STORY per iteration** — no "while I'm here" additions
2. **NEVER COMMIT BROKEN code** — every commit must pass all quality checks
3. **READ PROGRESS.TXT FIRST** — check codebase patterns before writing

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

## Abort and cleanup

```bash
sugar workspace cleanup
```

---

## How to interpret user requests

| User says | Start from |
|---|---|
| Planning only / no qualifier | Phase 1 |
| Planning is approved | Phase 2 |
| Setup is done | Phase 3 |
| PRDs exist, ready to implement | Phase 3c |
| All branches done | Phase 4 |
| Testing only | Phase 1 (test strategy), then normal flow |

---

## Execution rules

### Source of truth
- Before 3c: `todo.md` — During 3c: `prd.json` per workspace — After: sync back to `todo.md`

### Commits
- One per story: `feat: [Story ID] - [Story Title]` — must pass quality checks

---

## Managed files

| File | Location | Created in |
|---|---|---|
| `plan.md` | repo root | Phase 1 |
| `todo.md` | repo root | Phase 1 |
| `execution.md` | repo root | Phase 3b |
| `prd.json` | each worktree | Phase 3b |
| `progress.txt` | each worktree | Phase 2 |
| `CLAUDE.md` | each worktree | Phase 3b |
| `ralph-loop.sh` | each worktree | Phase 3b |
| `VERIFY.md` | each worktree | Phase 3b (consensus only) |
| `patterns.json` | repo root | Phase 3c (between groups) |
| `merge_order.md` | repo root | Phase 4 |

---

**First deliverable is always Phase 1 planning only.**

**Restate**: Given `${input}` — Phase 1. Produce `plan.md` and `todo.md`. Stop. Wait.
