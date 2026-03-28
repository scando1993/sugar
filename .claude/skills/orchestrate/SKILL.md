---
name: phase
description: Phased software engineering execution for large refactors, migrations, feature work, testing efforts, and modularization. Executes through strict planning → workspace setup → dependency analysis → PRD-driven parallel implementation → merge phases, with user approval required between each phase. Each subagent follows the Ralph agent pattern (one story at a time, atomic commits, progress tracking, pattern consolidation). Use when a task needs isolated workspaces per phase, atomic commits, parallel branches, and controlled merge sequencing.
argument-hint: "<engineering task description>"
allowed-tools: Agent, TaskCreate, TaskUpdate, TaskList, TaskGet, Bash, Read, Write, Edit, Glob, Grep
---

# Phased Software Engineering Execution

## Task
$ARGUMENTS

---

## Reference implementation

This skill's subagent execution model is based on **[Ralph](https://github.com/snarktank/ralph)** — an autonomous agent loop that drives implementation through PRD-defined user stories with progress tracking and pattern consolidation.

---

## Prompt reinforcement

Use **prompt repetition** at every decision boundary: state the task, provide context, give the instruction, restate context briefly, repeat the instruction. This ensures the model attends fully to both context and instruction regardless of prompt length. Apply at skill level (restate `$ARGUMENTS` before each phase), subagent level (template below), and per-story (restate acceptance criteria before implementing).

---

## Core behavior

Execute in **strict phases**. Never move to the next phase without **explicit user approval**.

If some inputs are missing, infer sensible defaults and document them in `plan.md`.

Before every phase, restate: **"The original task is: $ARGUMENTS. This phase's goal is: [phase goal]."**

---

## Phase 1 — Planning only

### Goal
Analyze the task and produce a complete execution plan. Do not implement any code.

**Restate**: The original task is `$ARGUMENTS`. This phase produces `plan.md` and `todo.md` only. No code, no branches.

### Actions

Create `plan.md` at the repo root containing:
- objective
- scope
- assumptions
- constraints
- risks
- **dependency map** — which parts of the work depend on other parts
- architecture strategy
- refactor strategy (if relevant)
- testing strategy (if relevant)
- validation strategy
- rollout / execution phases with explicit dependency annotations per phase
- blockers (if any)

The dependency map in `plan.md` is critical — Phase 3 will use it to determine parallel execution groups.

Create `todo.md` at the repo root containing:
- small, actionable, idempotent tasks
- tasks grouped by phase
- checkbox progress tracking (`- [ ]`)
- explicit completion criteria per phase
- dependency annotations: for each task, note if it depends on another task or phase completing first
- notes for blockers or follow-ups

### Rules
- Do not implement anything
- Do not create branches unless the user explicitly approves Phase 2
- Stop after Phase 1 and wait for user approval

---

## Phase 2 — Per-phase workspace and branch setup

### Goal
Create isolated workspaces and branches for each execution phase.

**Restate**: The original task is `$ARGUMENTS`. This phase creates one workspace and one branch per execution phase. No implementation yet.

### Preconditions
Only start after explicit user approval.

### Actions

Use **git worktree** for lightweight, isolated workspaces that share the same `.git` directory:

```bash
# Create a base directory for all phase workspaces
mkdir -p /tmp/<repo-name>-phases

# For each phase:
git worktree add /tmp/<repo-name>-phases/<phase-name> -b <branch-name>
```

If the user provides a different base path, use that instead of `/tmp/<repo-name>-phases/`.

For each workspace, initialize `progress.txt`:
```
# Phase Progress Log
Started: [timestamp]
---
```

Branch naming pattern:
- `phase-a-<scope>`
- `phase-b-<scope>`
- `phase-c-<scope>`

### Rules
- One worktree per phase, one branch per phase
- Each workspace must map clearly to its phase
- Do not start implementation unless the user explicitly approves Phase 3
- Document any setup problems in `plan.md` and `todo.md`

---

## Phase 3 — Dependency analysis, execution planning, and implementation

### Preconditions
Only start after explicit user approval.

**Restate**: The original task is `$ARGUMENTS`. This phase analyzes dependencies, builds a parallel execution plan, generates per-phase PRDs, and then implements all phases — running independent phases concurrently as Ralph-style subagents.

Phase 3 has three sub-phases that execute sequentially: **3a → 3b → 3c**.

---

### Phase 3a — Dependency analysis

#### Goal
Deeply analyze `plan.md` and `todo.md` to understand the dependency graph between all execution phases.

#### Actions

Read `plan.md` thoroughly. For each execution phase, determine:

1. **Produces**: What artifacts, files, APIs, types, or state changes does this phase create?
2. **Consumes**: What does this phase need from other phases to begin?
3. **Hard dependencies**: Which phases must fully complete before this one can start?
4. **Soft dependencies**: Which phases would benefit from completing first but are not strictly blocking?
5. **Independence**: Which phases touch entirely separate parts of the codebase with zero overlap?

Build the dependency graph:
- Nodes = execution phases
- Edges = hard dependencies (A must finish before B starts)
- Identify **parallel groups**: sets of phases with no edges between them
- Identify **sequential chains**: phases that must execute in strict order
- Identify the **critical path**: the longest sequential chain

---

### Phase 3b — Create execution.md and per-phase prd.json

#### Goal
Write the execution plan and generate a Ralph-format `prd.json` for each phase workspace.

#### Actions

**Create `execution.md`** at the repo root containing:

**1. Dependency graph** — ASCII visualization with arrows for hard dependencies, parallel groups visually grouped:
```
[phase-a-types] ──→ [phase-c-implementation]
[phase-b-tests] ──→ [phase-c-implementation]
[phase-a-types]  ║  [phase-b-tests]  (parallel)
```

**2. Parallel execution groups** — Group 1 (no dependencies), Group 2 (after Group 1), etc.

**3. Execution order** — Numbered sequence of groups with satisfied dependencies noted between them.

**4. Critical path** — The longest sequential chain, why it bottlenecks, and whether restructuring could reduce it.

**5. Risk assessment** — Conflict likelihood between parallel phases, shared file concerns, mitigation notes.

**6. Rationale** — Why this ordering is safest and most efficient.

---

**Generate `prd.json`** in each phase workspace.

For each phase, convert its tasks from `todo.md` into Ralph-format user stories:

```json
{
  "project": "[repo name]",
  "branchName": "[phase branch name]",
  "description": "[phase scope from plan.md]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[story title derived from task]",
      "description": "As a developer, I need [what] so that [why from plan.md]",
      "acceptanceCriteria": [
        "Specific verifiable criterion from todo.md",
        "Another criterion",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

#### Story sizing rules (from Ralph)
- Each story must be completable in one focused pass
- If you cannot describe the change in 2-3 sentences, split it
- Right-sized: add a component, update a module, write tests for one unit
- Too big: "refactor the entire API" — split into one story per endpoint

#### Story ordering rules
- Stories execute in priority order within the phase
- Earlier stories must not depend on later ones
- Order: schema/data changes → backend logic → UI/consumers → validation

#### Acceptance criteria rules
- Every criterion must be verifiable, not vague
- Good: "Add status column with default 'pending'" / Bad: "Works correctly"
- Always include as final criterion: "Typecheck passes"
- For testable logic, also include: "Tests pass"

#### Rules
- `execution.md` must be concrete enough that a human could follow it manually
- Every ordering decision must have a stated reason
- Each `prd.json` must be valid JSON in the phase workspace root
- Do not proceed to 3c until both `execution.md` and all `prd.json` files are written

---

### Phase 3c — Implementation via Ralph-style subagents

#### Goal
Execute all phases. Each subagent follows the Ralph agent pattern: read the PRD, work through stories one at a time, commit atomically, track progress, consolidate learnings.

#### Resuming after interruption
The Ralph loop is inherently resumable. To resume a previously interrupted run, invoke Phase 3c — each subagent picks up from the first story where `passes: false` in its `prd.json`. No special recovery needed; `progress.txt` preserves all prior learnings.

#### Actions

Follow `execution.md` strictly:

**For each parallel group** (phases with no interdependencies):
- Launch all phases in that group as concurrent subagents in **a single response** with multiple Agent tool calls
- Each subagent works in its own worktree/branch from Phase 2

**For each sequential dependency**:
- Wait for the predecessor phase to complete before launching the dependent phase
- Pass relevant outputs from the completed phase as context to the next subagent

---

#### Subagent prompt template

Every subagent prompt must follow this exact structure:

```
# Ralph Agent — [Phase Name]

## Context
- Original task: [full $ARGUMENTS]
- Your phase: [phase name and scope from plan.md]
- Your workspace: [absolute path to phase worktree]
- Your branch: [branch name]
- Dependencies satisfied: [what completed phases produced, if any]
- Patterns from prior phases: [codebase patterns from other phases' progress.txt, if any]

## Your Task

You are an autonomous coding agent working on phase "[phase name]"
of the task: [full $ARGUMENTS].

Follow this loop for every story in your prd.json:

1. Read `prd.json` at [workspace path]/prd.json
2. Read `progress.txt` — check the Codebase Patterns section first
3. Verify you are on branch `[branch name]`. If not, check it out.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks (typecheck, lint, test — whatever the project uses)
7. If checks pass → commit: `feat: [Story ID] - [Story Title]`
8. If checks fail → see Error Recovery below
9. Update `prd.json` to set `passes: true` for the completed story
10. Append your progress to `progress.txt` (format below)
11. If stories remain with `passes: false`, go back to step 4
12. When ALL stories have `passes: true`, push branch to origin and stop

## Error recovery

If quality checks fail after implementing a story:
1. Read the error output carefully
2. Fix the failing code
3. Re-run quality checks
4. If fixed → continue to commit step
5. If stuck after 3 attempts → record the blocker:
   - Set the story's `notes` field in prd.json to describe the failure
   - Append the failure to progress.txt
   - Move to the next story (do NOT leave broken code staged)
   - `git checkout -- .` to reset unstaged changes before continuing

## Progress report format

APPEND to progress.txt (never replace, always append):

## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context for other phases
---

## Consolidate patterns

If you discover a reusable pattern, add it to the `## Codebase Patterns`
section at the TOP of progress.txt (create it if it doesn't exist).
Only add patterns that are general and reusable, not story-specific.

## Quality requirements
- ALL commits must pass quality checks
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns
- One story at a time — do not batch

## Context summary
You are the Ralph agent for [phase name], working at [workspace path]
on branch [branch name]. Your prd.json has [N] stories. Work through
them one at a time in priority order.

## Task (repeated)
Read prd.json. Pick the highest priority story where passes is false.
Implement it. Run quality checks. Commit with feat: [Story ID] - [Title].
Mark passes true. Append progress. Repeat until all stories pass.
Then push to origin.
```

---

#### Completion tracking

- A phase is **complete only** when all stories in its `prd.json` have `passes: true`
- After each parallel group completes, update `execution.md` with actual results and any deviations
- After each parallel group completes, collect Codebase Patterns from each workspace and propagate to subagents in the next group
- If a subagent fails or encounters blockers, record the failure in `execution.md` and `todo.md` before proceeding

#### Rules
- Do not mix unrelated changes between phases
- Keep work reviewable — one story per commit
- Record blockers clearly in `todo.md`, `execution.md`, and `progress.txt`
- Prefer low-risk changes over broad rewrites
- Preserve behavior unless the task explicitly requires behavior changes
- Never launch a dependent phase before its prerequisites are confirmed complete
- Propagate codebase patterns between sequential groups so later phases benefit from earlier learnings

---

## Phase 4 — Merge planning and merging

### Goal
Safely integrate all completed phase branches.

**Restate**: The original task is `$ARGUMENTS`. All implementation phases are complete. This phase merges branches in the safest possible order using the dependency knowledge from `execution.md`.

### Preconditions
Only start after explicit user approval.

### Actions

Create `merge_order.md` at the repo root. Use `execution.md` dependency analysis to inform merge order.

`merge_order.md` must contain:
- recommended merge order (aligned with dependency graph — merge foundations first, dependents after)
- why that order is safest
- expected conflict areas (informed by the parallel group risk assessment from `execution.md`)
- notes for manual conflict resolution
- validation steps after each merge
- post-merge sanity checklist

**If the user wants manual merging:** stop after creating `merge_order.md`.

**If the user wants automatic merging:**
- Merge branches in the documented order
- Resolve conflicts using best engineering judgment
- Update `merge_order.md` with actual conflict notes discovered during merging
- Validate after each merge before continuing

### Post-merge validation

After all branches are merged, run full validation on the final result:
1. Run the complete test suite
2. Run typecheck, lint, and any project-level quality checks
3. If validation fails, document which merge introduced the failure in `merge_order.md`
4. Fix or revert the offending merge before declaring Phase 4 complete

Phase 4 is **not complete** until the merged result passes all quality checks.

---

## Abort and cleanup

To abort the workflow and tear down all phase workspaces:

```bash
# List all phase worktrees
git worktree list

# Remove each phase worktree
git worktree remove /tmp/<repo-name>-phases/<phase-name> --force

# Delete phase branches if no longer needed
git branch -D <phase-branch-name>

# Prune stale worktree references
git worktree prune
```

Tracking files (`plan.md`, `todo.md`, `execution.md`) remain in the main repo for reference or to resume later. Phase-local files (`prd.json`, `progress.txt`) are deleted with the worktree.

---

## How to interpret user requests

| User says | Start from |
|---|---|
| Planning only / no qualifier | Phase 1 |
| Planning is already approved | Phase 2 |
| Setup is already done | Phase 3 (starts with 3a dependency analysis) |
| Execution plan and PRDs exist, ready to implement | Phase 3c |
| All branches done, wants integration | Phase 4 |
| Testing only | Phase 1 (testing strategy + task breakdown), then follow normal flow |

---

## Execution rules

### General
- Adapt the workflow to the user's specific prompt
- Never skip phases or continue without approval
- Prefer maintainability, correctness, testability, and low-risk integration
- Keep all tracking files current throughout
- Document assumptions and blockers explicitly — never hide them
- Preserve an audit trail through commits, prd.json updates, and progress.txt entries
- Apply prompt repetition at every phase boundary and in every subagent prompt
- Propagate codebase patterns from completed phases to upcoming phases

### Source of truth
- **Before Phase 3c**: `todo.md` is the authoritative task list
- **During Phase 3c**: `prd.json` is each subagent's source of truth for its phase
- **After each phase completes**: sync `prd.json` results back to `todo.md` checkboxes
- If `todo.md` and `prd.json` conflict during execution, `prd.json` wins for that phase

### Task design
Tasks in `todo.md` must be small, actionable, idempotent, resumable, and grouped logically by phase so another engineer could pick up from them.

### Story design (Ralph rules)
Stories in `prd.json` must be:
- Completable in one focused pass (if you cannot describe it in 2-3 sentences, split it)
- Ordered by dependency within the phase (schema → backend → UI)
- Have verifiable acceptance criteria (not vague)
- Always include "Typecheck passes" as a criterion

### Commits
- One commit per story: `feat: [Story ID] - [Story Title]`
- Small, meaningful, descriptive
- Limited to one logical unit of work
- Never bundle unrelated changes
- ALL commits must pass quality checks before being created

---

## Default assumptions

Unless the user says otherwise:
- Current repository is the source of truth
- Git worktrees are used for workspace isolation
- Phases are derived from the task scope
- Tracking files live at repo root; `prd.json` and `progress.txt` live in each phase worktree
- Validation includes tests, linting, type checks, and basic runtime sanity where relevant

---

## Success criteria

This skill succeeds when:
- Work is clearly phased and isolated
- Planning is complete before any implementation
- Dependencies are analyzed and documented in `execution.md`
- Each phase has a valid `prd.json` with right-sized stories
- Independent phases execute in parallel as concurrent Ralph-style subagents
- Each story is implemented, tested, and committed individually
- Progress is visible in `prd.json` (passes flags) and `progress.txt` (learnings)
- Codebase patterns are consolidated and propagated across phases
- Merge order is documented and informed by dependency analysis
- Post-merge validation passes on the final integrated result

---

## Managed files

| File | Location | Created in | Purpose |
|---|---|---|---|
| `plan.md` | repo root | Phase 1 | Full execution plan, assumptions, risks, dependency map |
| `todo.md` | repo root | Phase 1 | Task breakdown with checkboxes, grouped by phase |
| `execution.md` | repo root | Phase 3b | Dependency graph, parallel groups, implementation order |
| `prd.json` | each phase worktree | Phase 3b | Ralph-format user stories for that phase |
| `progress.txt` | each phase worktree | Phase 2 | Progress log with learnings and codebase patterns |
| `merge_order.md` | repo root | Phase 4 | Merge sequence, conflict expectations, validation steps |

---

**The first deliverable is always Phase 1 planning only**, unless the user explicitly states that a later phase is already approved.

**Restate**: Given the task `$ARGUMENTS` — start with Phase 1 planning. Produce `plan.md` and `todo.md`. Stop and wait for approval. Do not implement code.
