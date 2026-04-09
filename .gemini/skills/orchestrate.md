# Phased Software Engineering Execution

Execute large refactors, migrations, feature work, testing efforts, and modularization through strict phases. Each subagent runs in an isolated Ralph workspace (CLAUDE.md + prd.json + progress.txt) and executes autonomously.

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

```bash
mkdir -p /tmp/<repo-name>-phases
git worktree add /tmp/<repo-name>-phases/<phase-name> -b <branch-name>
```

Each workspace gets: `progress.txt` initialized with header and timestamp.

Branch naming: `phase-a-<scope>`, `phase-b-<scope>`, etc.

**Rules:** One worktree per phase, one branch per phase. Do not start implementation without user approval.

---

### Phase 3 — Dependency Analysis, PRD Generation, and Parallel Implementation

Three sub-phases: **3a -> 3b -> 3c**.

#### Phase 3a — Dependency Analysis

For each phase determine: Produces, Consumes, Hard dependencies, Soft dependencies, Independence. Build the dependency graph. Identify parallel groups, sequential chains, and critical path.

#### Phase 3b — Generate Workspace Files

Create `execution.md` at repo root with: dependency graph (ASCII), parallel execution groups, execution order, critical path, risk assessment, rationale, model strategy.

For each workspace generate:

1. **`prd.json`** — User stories in Ralph JSON format. Stories must be completable in one pass, ordered by dependency, with verifiable acceptance criteria. Always include "Typecheck passes".

2. **`CLAUDE.md`** — Ralph agent instructions. The subagent reads prd.json, picks the highest priority pending/rejected story, implements ONE story, runs quality checks, outputs STORY_IMPLEMENTED, appends progress, and stops. The loop handles iteration.

3. **`ralph-loop.sh`** — Iteration engine. Spawns fresh agent instances in a loop, one story per iteration. Handles verifier quorum, consensus voting, model escalation on consecutive failures, and commit/reject decisions.

4. **`VERIFY.md`** — Verifier agent instructions. Reads the story's acceptance criteria, verifies each against the actual diff, outputs VOTE:PASS or VOTE:FAIL with specific criterion and reason.

5. **`patterns.json`** (repo root) — Populated between groups with reusable patterns learned from completed phases.

#### Phase 3c — Parallel Execution

Launch `ralph-loop.sh` for each phase following `execution.md` group ordering.

- Independent phases run in parallel
- Sequential groups wait for prior group to complete
- Between groups: extract patterns from progress.txt, inject into next group's CLAUDE.md
- Each iteration is a fresh agent instance with clean context
- Memory persists via prd.json, progress.txt, and git history
- Inherently resumable — re-run ralph-loop.sh to pick up from first pending/rejected story

**Model selection per phase:**
- **Sonnet** (default): Well-scoped implementation tasks, refactors, migrations
- **Haiku**: Mechanical tasks — config changes, simple file operations, boilerplate
- **Opus**: Complex architectural decisions, cross-cutting refactors, ambiguous requirements
- Auto-escalates to Opus on 2+ consecutive failures

---

### Phase 4 — Merge

Safely integrate all completed phase branches.

Create `merge_order.md` at repo root: merge order aligned with dependency graph, rationale, expected conflict areas, conflict resolution notes, validation steps.

Post-merge validation: complete test suite, typecheck, lint, quality checks. Phase 4 is NOT complete until the final merged result passes all checks.

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

## CLAUDE.md Template Summary

Each workspace CLAUDE.md instructs the subagent to:

1. Read prd.json and progress.txt (check Codebase Patterns first)
2. Check failure_log.json for prior failures on the story
3. Verify correct branch
4. Pick highest priority pending/rejected story, set status to "implementing"
5. If no stories remain -> PHASE_COMPLETE
6. Implement the single story
7. Quality Protocol: implement -> self-review against ALL acceptance criteria -> run quality checks -> verify again -> commit
8. Output STORY_IMPLEMENTED:[Story ID]
9. If stuck after 3 attempts -> output STORY_FAILED for model escalation
10. Append progress to progress.txt with learnings and patterns

**Red Flags for subagents:**

| Thought | Reality |
|---|---|
| "I'll implement two stories in one iteration" | ONE story per iteration. No exceptions. |
| "Tests mostly pass, I'll commit and fix later" | ALL commits must pass quality checks. |
| "I don't need to read progress.txt" | Progress.txt IS your memory. Read it FIRST. |
| "This is trivial, no need to run checks" | Every commit gets checked. No exceptions. |
| "I'll refactor this while I'm here" | Stay in scope. Implement the story. Nothing more. |

---

## ralph-loop.sh Summary

The iteration engine spawns fresh agent instances per story:

```
ralph-loop.sh [max_iterations] [default_model]
  Iteration 1: agent implements US-001 -> verifier quorum -> commit/reject
  Iteration 2: agent implements US-002 -> verifier quorum -> commit/reject
  ...
  Final iteration: agent outputs PHASE_COMPLETE -> loop exits
```

Key behaviors:
- Tags each attempt for rollback: `attempt-{STORY_ID}-v{N}`
- Verifier quorum: N agents independently vote PASS/FAIL
- Majority PASS -> commit; majority FAIL -> reject and log reason
- Model escalation: 2+ consecutive failures escalate from default to Opus
- De-escalation: success returns to default model
- Failure logging: records story ID, attempt number, files modified, failure type

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
git worktree list
git worktree remove /tmp/<repo>-phases/<phase> --force
git branch -D <branch>
git worktree prune
```

**The first deliverable is always Phase 1 planning only**, unless the user explicitly states that a later phase is already approved.
