---
name: phase
description: Phased software engineering execution for large refactors, migrations, feature work, testing efforts, and modularization. Executes through strict planning → workspace setup → dependency analysis → parallel implementation → merge phases, with user approval required between each phase. Use when a task needs isolated workspaces per phase, atomic commits, parallel branches, and controlled merge sequencing.
argument-hint: "<engineering task description>"
allowed-tools: Agent, TaskCreate, TaskUpdate, TaskList, TaskGet, Bash, Read, Write, Edit, Glob, Grep
---

# Phased Software Engineering Execution

## Task
$ARGUMENTS

---

## Prompt reinforcement

This skill uses **prompt repetition** to improve execution quality. The technique: when presenting context and instructions together, repeat the core instruction so every token attends to every other token.

Apply this pattern at every decision boundary:

1. **Skill level**: The task (`$ARGUMENTS`) is stated above and restated before each execution phase begins.
2. **Subagent level**: Every subagent prompt follows the structure `<CONTEXT> <INSTRUCTION> <CONTEXT-SUMMARY> <INSTRUCTION>` — context first, then the task, then a brief restatement of context, then the task again.
3. **Phase transitions**: Before starting any phase, restate the original task and the specific goal of that phase.

This is not decoration. It is a structural technique that ensures the model attends fully to both the surrounding context and the core instruction, regardless of prompt length.

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

**Restate**: The original task is `$ARGUMENTS`. This phase creates one workspace and one branch per execution phase, with the original repo as remote. No implementation yet.

### Preconditions
Only start after explicit user approval.

### Actions

Using the user-provided temporary base path (or a sensible default like `/tmp/<repo-name>-phases/`):

For each phase defined in `plan.md` / `todo.md`:
1. Copy the current repository into a dedicated folder named after the phase
2. Create or checkout the corresponding branch for that phase
3. Set the original repository as the remote for that copied workspace

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
- Each copied repo must map clearly to its phase
- Do not start implementation unless the user explicitly approves Phase 3
- Document any setup problems in `plan.md` and `todo.md`

---

## Phase 3 — Dependency analysis, execution planning, and implementation

### Preconditions
Only start after explicit user approval.

**Restate**: The original task is `$ARGUMENTS`. This phase analyzes dependencies, builds a parallel execution plan, and then implements all phases — running independent phases concurrently as subagents.

Phase 3 has three sub-phases that execute sequentially within it: **3a → 3b → 3c**.

---

### Phase 3a — Dependency analysis

#### Goal
Deeply analyze `plan.md` and `todo.md` to understand the dependency graph between all execution phases.

#### Actions

Read `plan.md` thoroughly. For each execution phase, determine:

1. **Produces**: What artifacts, files, APIs, types, or state changes does this phase create?
2. **Consumes**: What does this phase need from other phases to begin?
3. **Hard dependencies**: Which phases must fully complete before this one can start? (e.g., Phase B modifies files that Phase A creates)
4. **Soft dependencies**: Which phases would benefit from completing first but are not strictly blocking? (e.g., shared utilities that could be stubbed)
5. **Independence**: Which phases touch entirely separate parts of the codebase with zero overlap?

Build a mental dependency graph:
- Nodes = execution phases
- Edges = hard dependencies (A must finish before B starts)
- Identify **parallel groups**: sets of phases with no edges between them
- Identify **sequential chains**: phases that must execute in strict order
- Identify the **critical path**: the longest sequential chain that determines minimum total execution time

---

### Phase 3b — Create execution.md

#### Goal
Write the execution plan as a concrete, actionable document.

#### Actions

Create `execution.md` at the repo root containing:

**1. Dependency graph**
- ASCII visualization of the dependency graph
- Each node labeled with its phase name
- Arrows showing hard dependencies
- Parallel groups visually grouped

Example format:
```
[phase-a-types] ──→ [phase-c-implementation]
[phase-b-tests] ──→ [phase-c-implementation]
[phase-a-types]  ║  [phase-b-tests]  (parallel)
```

**2. Parallel execution groups**
- Group 1: phases that can all start immediately (no dependencies)
- Group 2: phases that start after Group 1 completes
- Group N: etc.

**3. Execution order**
- Numbered sequence of groups
- Within each group, list all phases that run concurrently
- Between groups, note which dependency was satisfied

**4. Critical path**
- The longest sequential chain
- Why it is the bottleneck
- Whether any tasks could be restructured to reduce it

**5. Risk assessment per group**
- Conflict likelihood between parallel phases
- Shared file concerns
- Mitigation notes

**6. Rationale**
- Why this ordering is safest and most efficient
- What alternatives were considered and rejected

#### Rules
- `execution.md` must be concrete enough that a human could follow it manually
- Every ordering decision must have a stated reason
- Do not proceed to 3c until `execution.md` is written

---

### Phase 3c — Implementation via parallel subagents

#### Goal
Execute all phases, launching independent phases as concurrent subagents and sequencing dependent phases.

#### Actions

Follow `execution.md` strictly:

**For each parallel group** (phases with no interdependencies):
- Launch all phases in that group as concurrent subagents in **a single response** with multiple Agent tool calls
- Each subagent works in its own workspace/branch from Phase 2

**For each sequential dependency**:
- Wait for the predecessor phase to complete before launching the dependent phase
- Pass relevant outputs from the completed phase as context to the next subagent

**Subagent prompt structure** (prompt repetition applied):

Every subagent prompt must follow this exact structure:

```
CONTEXT:
- Original task: [full $ARGUMENTS]
- Your phase: [phase name and scope from plan.md]
- Your tasks: [exact tasks from todo.md for this phase]
- Your workspace: [path to phase workspace]
- Your branch: [branch name]
- Dependencies satisfied: [what completed phases produced, if any]

INSTRUCTION:
Implement the tasks listed above for [phase name]. Work incrementally.
Make small, atomic, descriptive commits. Update todo.md as you complete
each task. Push to the original repo when done.

CONTEXT SUMMARY:
You are working on [phase name] as part of: [one-line $ARGUMENTS summary].
Your [N] tasks are in [workspace path] on branch [branch name].

INSTRUCTION (REPEATED):
Implement all tasks for [phase name]. Commit incrementally. Update
todo.md. Push when complete. Do not touch files outside your phase scope.
```

**Per-subagent rules:**
1. Implement only that phase's assigned tasks
2. Work incrementally with small, meaningful, atomic commits
3. Update `plan.md` if the plan evolves
4. Update `todo.md` continuously — check off completed tasks
5. Push the branch to the original repository when the phase is complete

**Completion tracking:**
- A phase is **complete only** when all tasks assigned to it in `todo.md` are checked off
- After each parallel group completes, update `execution.md` with actual results and any deviations
- If a subagent fails or encounters blockers, record the failure in `execution.md` and `todo.md` before proceeding

### Rules
- Do not mix unrelated changes between phases
- Keep work reviewable
- Record blockers clearly in `todo.md` and `execution.md`
- Prefer low-risk changes over broad rewrites
- Preserve behavior unless the task explicitly requires behavior changes
- Never launch a dependent phase before its prerequisites are confirmed complete

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

---

## How to interpret user requests

| User says | Start from |
|---|---|
| Planning only / no qualifier | Phase 1 |
| Planning is already approved | Phase 2 |
| Setup is already done | Phase 3 (starts with 3a dependency analysis) |
| Execution plan exists, ready to implement | Phase 3c |
| All branches done, wants integration | Phase 4 |
| Testing only | Phase 1 (testing strategy + task breakdown), then follow normal flow |

---

## Execution rules

### General
- Adapt the workflow to the user's specific prompt
- Never skip phases or continue without approval
- Prefer maintainability, correctness, testability, and low-risk integration
- Keep all markdown files current throughout (`plan.md`, `todo.md`, `execution.md`, `merge_order.md`)
- Document assumptions and blockers explicitly — never hide them
- Preserve an audit trail through commits and markdown updates
- Apply prompt repetition at every phase boundary and in every subagent prompt

### Task design
Tasks in `todo.md` must be small, actionable, idempotent, resumable, and grouped logically by phase so another engineer could pick up from them.

### Commits
- Small, meaningful, descriptive
- Limited to one logical unit of work
- Never bundle unrelated changes

---

## Default assumptions

Unless the user says otherwise:
- Current repository is the source of truth
- The original repository is the remote for copied workspaces
- Phases are derived from the task scope
- Markdown tracking files live at repo root
- Validation includes tests, linting, type checks, and basic runtime sanity where relevant

---

## Success criteria

This skill succeeds when:
- Work is clearly phased and isolated
- Planning is complete before any implementation
- Dependencies are analyzed and documented in `execution.md`
- Independent phases execute in parallel as concurrent subagents
- Progress is visible and current in `todo.md`
- Implementation is incremental and auditable via commits
- Merge order is documented and informed by dependency analysis
- Merges are safer and easier to review

---

## Managed files

| File | Created in | Purpose |
|---|---|---|
| `plan.md` | Phase 1 | Full execution plan, assumptions, risks, dependency map |
| `todo.md` | Phase 1 | Task breakdown with checkboxes, grouped by phase |
| `execution.md` | Phase 3b | Dependency graph, parallel groups, implementation order |
| `merge_order.md` | Phase 4 | Merge sequence, conflict expectations, validation steps |

---

**The first deliverable is always Phase 1 planning only**, unless the user explicitly states that a later phase is already approved.

**Restate**: Given the task `$ARGUMENTS` — start with Phase 1 planning. Produce `plan.md` and `todo.md`. Stop and wait for approval. Do not implement code.
