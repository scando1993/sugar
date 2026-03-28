---
name: 'phase'
description: 'Phased software engineering execution — planning, workspace setup, dependency analysis, PRD-driven implementation (Ralph pattern), and merge. For large refactors, migrations, feature work, testing efforts, and modularization.'
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

## Reference implementation

This skill's implementation model is based on **Ralph** (https://github.com/snarktank/ralph) — an autonomous agent loop that drives implementation through PRD-defined user stories with progress tracking and pattern consolidation.

---

## Prompt reinforcement

This skill uses **prompt repetition** to improve execution quality. When presenting context and instructions together, repeat the core instruction so every token attends to every other token.

Apply this at every decision boundary:

1. **Skill level**: The task is stated above and restated before each phase begins.
2. **Phase transitions**: Before starting any phase, restate the original task and the specific goal of that phase.
3. **Per-story execution**: Before implementing each story, restate the story scope and acceptance criteria.

---

## Core behavior

Execute in **strict phases**. Never move to the next phase without **explicit user approval**.

If some inputs are missing, infer sensible defaults and document them in `plan.md`.

Before every phase, restate: **"The original task is: ${input}. This phase's goal is: [phase goal]."**

---

## Phase 1 — Planning only

### Goal
Analyze the task and produce a complete execution plan. Do not implement any code.

**Restate**: The original task is `${input}`. This phase produces `plan.md` and `todo.md` only. No code, no branches.

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

**Restate**: The original task is `${input}`. This phase creates one workspace and one branch per execution phase, with the original repo as remote. No implementation yet.

### Preconditions
Only start after explicit user approval.

### Actions

Use the terminal to set up workspaces. For each phase defined in `plan.md` / `todo.md`:

```bash
# Option A: git worktree (preferred — lightweight, shared .git)
git worktree add /tmp/<repo-name>-phases/<phase-name> -b <branch-name>

# Option B: full copy (if worktrees are not suitable)
cp -r . /tmp/<repo-name>-phases/<phase-name>
cd /tmp/<repo-name>-phases/<phase-name>
git checkout -b <branch-name>
git remote set-url origin <original-repo-path>
```

Initialize a `progress.txt` in each workspace root:
```
# Phase Progress Log
Started: [timestamp]
---
```

Branch naming pattern:
- `phase-1-planning`
- `phase-2-setup`
- `phase-3-<feature-or-scope>`
- `phase-4-merge`

Or when splitting implementation across multiple branches:
- `phase-a-<scope>`
- `phase-b-<scope>`

### Rules
- One workspace per phase, one branch per phase
- Each workspace must map clearly to its phase
- Do not start implementation unless the user explicitly approves Phase 3
- Document any setup problems in `plan.md` and `todo.md`

---

## Phase 3 — Dependency analysis, execution planning, and implementation

### Preconditions
Only start after explicit user approval.

**Restate**: The original task is `${input}`. This phase analyzes dependencies, builds an execution plan, generates per-phase PRDs, and then implements all phases following the Ralph agent pattern.

Phase 3 has three sub-phases: **3a → 3b → 3c**.

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

**1. Dependency graph**
```
[phase-a-types] ──→ [phase-c-implementation]
[phase-b-tests] ──→ [phase-c-implementation]
[phase-a-types]  ║  [phase-b-tests]  (parallel)
```

**2. Parallel execution groups**
- Group 1: phases that can all start immediately (no dependencies)
- Group 2: phases that start after Group 1 completes
- Group N: etc.

**3. Execution order** — numbered sequence of groups

**4. Critical path** — the longest sequential chain and why it is the bottleneck

**5. Risk assessment per group** — conflict likelihood, shared file concerns

**6. Rationale** — why this ordering is safest and most efficient

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
      "title": "[story title]",
      "description": "As a developer, I need [what] so that [why]",
      "acceptanceCriteria": [
        "Specific verifiable criterion",
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

#### Story rules (from Ralph)
- Each story must be completable in one focused pass
- If you cannot describe the change in 2-3 sentences, split it
- Stories ordered by dependency within the phase (schema → backend → UI)
- Every criterion must be verifiable, not vague
- Always include "Typecheck passes" as final criterion

#### Rules
- `execution.md` must be concrete enough that a human could follow it manually
- Every ordering decision must have a stated reason
- Each `prd.json` must be valid JSON in the phase workspace root
- Do not proceed to 3c until both `execution.md` and all `prd.json` files are written

---

### Phase 3c — Implementation via Ralph agent pattern

#### Goal
Execute all phases by working through each phase's `prd.json` stories one at a time.

#### Execution strategy

Follow `execution.md` strictly.

**Copilot works through phases sequentially.** For each phase in execution order:

1. Change into the phase workspace directory
2. Verify you are on the correct branch
3. Follow the Ralph loop below until all stories pass
4. Push the branch to origin
5. Move to the next phase

**If phases are independent** (marked parallel in `execution.md`), tell the user they can open multiple Copilot sessions — one per phase workspace — to run them concurrently. Each session follows the same Ralph loop independently.

---

#### The Ralph loop (execute for every phase)

```
For the current phase workspace:

1. Read prd.json
2. Read progress.txt — check the Codebase Patterns section first
3. Verify you are on the correct branch. If not, check it out.
4. Pick the HIGHEST PRIORITY user story where passes is false
5. Restate: "I am implementing [Story ID]: [Title]. Acceptance criteria: [list them]."
6. Implement that single user story
7. Run quality checks (typecheck, lint, test — whatever the project uses)
8. If checks pass, commit ALL changes:
   git commit -m "feat: [Story ID] - [Story Title]"
9. Update prd.json — set passes to true for the completed story
10. Append progress to progress.txt (format below)
11. If stories remain with passes: false → go back to step 4
12. When ALL stories have passes: true → push branch to origin
```

#### Progress report format

APPEND to progress.txt (never replace):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context for other phases
---
```

#### Consolidate patterns

If you discover a reusable pattern, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create the section if it doesn't exist):

```
## Codebase Patterns
- Example: Always use IF NOT EXISTS for migrations
- Example: Export types from actions.ts for UI components
```

Only add patterns that are general and reusable, not story-specific.

#### Before moving to the next phase group
- Collect Codebase Patterns from all completed phase workspaces
- Carry those patterns forward as context when starting the next group
- Update `execution.md` with actual results and any deviations

#### Quality requirements
- ALL commits must pass quality checks — do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns
- One story at a time — do not batch

#### Rules
- Do not mix unrelated changes between phases
- Keep work reviewable — one story per commit
- Record blockers in `todo.md`, `execution.md`, and `progress.txt`
- Prefer low-risk changes over broad rewrites
- Preserve behavior unless the task explicitly requires behavior changes
- Never start a dependent phase before its prerequisites are confirmed complete

---

## Phase 4 — Merge planning and merging

### Goal
Safely integrate all completed phase branches.

**Restate**: The original task is `${input}`. All implementation phases are complete. This phase merges branches in the safest possible order using the dependency knowledge from `execution.md`.

### Preconditions
Only start after explicit user approval.

### Actions

Create `merge_order.md` at the repo root. Use `execution.md` dependency analysis to inform merge order.

`merge_order.md` must contain:
- recommended merge order (merge foundations first, dependents after)
- why that order is safest
- expected conflict areas
- notes for manual conflict resolution
- validation steps after each merge
- post-merge sanity checklist

**If the user wants manual merging:** stop after creating `merge_order.md`.

**If the user wants automatic merging:**
```bash
# For each branch in merge order:
git checkout main
git merge <branch-name> --no-ff
# Run validation
# If conflicts: resolve, document in merge_order.md, then continue
```
- Merge branches in the documented order
- Resolve conflicts using best engineering judgment
- Update `merge_order.md` with actual conflict notes
- Validate after each merge before continuing

---

## How to interpret user requests

| User says | Start from |
|---|---|
| Planning only / no qualifier | Phase 1 |
| Planning is already approved | Phase 2 |
| Setup is already done | Phase 3 (starts with 3a) |
| Execution plan and PRDs exist | Phase 3c |
| All branches done, wants integration | Phase 4 |
| Testing only | Phase 1 (testing strategy), then normal flow |

---

## Execution rules

### General
- Adapt the workflow to the user's specific prompt
- Never skip phases or continue without approval
- Prefer maintainability, correctness, testability, and low-risk integration
- Keep all tracking files current throughout
- Document assumptions and blockers explicitly
- Preserve an audit trail through commits, prd.json updates, and progress.txt
- Apply prompt repetition at every phase boundary
- Propagate codebase patterns from completed phases to upcoming phases

### Story design (Ralph rules)
- Completable in one focused pass
- Ordered by dependency (schema → backend → UI)
- Verifiable acceptance criteria
- Always include "Typecheck passes"

### Commits
- One commit per story: `feat: [Story ID] - [Story Title]`
- Small, meaningful, descriptive
- ALL commits must pass quality checks

---

## Default assumptions

Unless the user says otherwise:
- Current repository is the source of truth
- Git worktrees preferred for workspace isolation
- Phases are derived from the task scope
- Tracking files live at repo root; `prd.json` and `progress.txt` live in each phase workspace
- Validation includes tests, linting, type checks where relevant

---

## Managed files

| File | Location | Created in | Purpose |
|---|---|---|---|
| `plan.md` | repo root | Phase 1 | Execution plan, assumptions, risks, dependency map |
| `todo.md` | repo root | Phase 1 | Task breakdown with checkboxes, grouped by phase |
| `execution.md` | repo root | Phase 3b | Dependency graph, parallel groups, implementation order |
| `prd.json` | each phase workspace | Phase 3b | Ralph-format user stories for that phase |
| `progress.txt` | each phase workspace | Phase 2 | Progress log with learnings and codebase patterns |
| `merge_order.md` | repo root | Phase 4 | Merge sequence, conflict expectations, validation steps |

---

**The first deliverable is always Phase 1 planning only**, unless the user explicitly states that a later phase is already approved.

**Restate**: Given the task `${input}` — start with Phase 1 planning. Produce `plan.md` and `todo.md`. Stop and wait for approval. Do not implement code.
