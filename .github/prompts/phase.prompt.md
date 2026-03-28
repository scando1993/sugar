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

```bash
mkdir -p /tmp/<repo>-phases
git worktree add /tmp/<repo>-phases/<phase-name> -b <branch-name>
```

Initialize `progress.txt` in each workspace.

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

#### `execution.md` at repo root
1. Dependency graph (ASCII)
2. Parallel execution groups
3. Execution order
4. Critical path analysis
5. Risk assessment
6. Rationale

#### `prd.json` in each workspace

Convert tasks from `todo.md` into Ralph-format stories. Stories must be: one-pass completable, dependency-ordered, verifiably criteria'd, always include "Typecheck passes".

#### `CLAUDE.md` in each workspace

Write Ralph agent instructions. Template:

```markdown
# Ralph Agent — [Phase Name]

You are an autonomous coding agent working on phase "[phase-name]" of:
[full task description]

## Your Task
1. Read prd.json in this directory
2. Read progress.txt — check Codebase Patterns first
3. Verify branch [branch-name]
4. Pick highest priority story where passes: false
5. Implement that single story
6. Run quality checks
7. Pass → commit: feat: [Story ID] - [Story Title]
8. Fail → fix/retry 3x. If stuck: set notes in prd.json, log to progress.txt, git checkout -- ., next story
9. Set passes: true in prd.json
10. Append to progress.txt
11. Repeat until all pass
12. Push: git push origin [branch-name]

## Context
- Task: [full description]
- Workspace: [path]
- Branch: [branch]
- Prior patterns: [from completed phases]

## Task (repeated)
Read prd.json. Pick story. Implement. Quality check. Commit. Mark done. Repeat. Push.
```

---

### Phase 3c — Parallel subagent execution

#### Resuming
Inherently resumable — each workspace picks up from first `passes: false`.

#### Parallel execution

Follow `execution.md` group ordering. For each parallel group, launch ALL independent phases simultaneously.

**Strategy: launch via terminal**

For each phase in a parallel group, run an autonomous agent in its workspace:

```bash
# Launch all independent phases in parallel
(cd /tmp/<repo>-phases/phase-a && claude --dangerously-skip-permissions --print < CLAUDE.md > output.log 2>&1) &
PID_A=$!
(cd /tmp/<repo>-phases/phase-b && claude --dangerously-skip-permissions --print < CLAUDE.md > output.log 2>&1) &
PID_B=$!

# Wait for all to complete
wait $PID_A $PID_B

# Check results
echo "Phase A:" && cat /tmp/<repo>-phases/phase-a/output.log | tail -5
echo "Phase B:" && cat /tmp/<repo>-phases/phase-b/output.log | tail -5
```

If `claude` CLI is not available, tell the user to open multiple Copilot sessions — one per workspace — and invoke `/phase` with instructions to start from Phase 3c in that specific workspace.

**Between groups:**
1. Collect Codebase Patterns from completed workspaces
2. Update next group's `CLAUDE.md` with those patterns
3. Update `execution.md` with results
4. Launch next group

**Retry:** If a subagent completes but non-blocked stories remain `passes: false`, re-launch it.

#### Rules
- Never start dependent phase before prerequisites complete
- Propagate patterns between groups
- One story per commit

---

## Phase 4 — Merge

**Restate**: The original task is `${input}`. All phases complete. Merge safely.

Create `merge_order.md`: merge order, rationale, expected conflicts, resolution notes, validation steps, post-merge checklist.

**Manual:** stop after `merge_order.md`.

**Automatic:** merge in order, resolve conflicts, validate after each, update notes.

### Post-merge validation
Run full test suite + typecheck + lint on final result. Not complete until all pass.

---

## Abort and cleanup

```bash
git worktree list
git worktree remove /tmp/<repo>-phases/<phase> --force
git branch -D <branch>
git worktree prune
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
| `merge_order.md` | repo root | Phase 4 |

---

**First deliverable is always Phase 1 planning only.**

**Restate**: Given `${input}` — Phase 1. Produce `plan.md` and `todo.md`. Stop. Wait.
