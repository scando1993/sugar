# Phased Software Engineering Execution

An orchestration skill that drives large engineering tasks through a strict multi-phase workflow with PRD-driven implementation, parallel execution, and progress tracking.

Built for **Claude Code** and **GitHub Copilot**.

Based on the [Ralph](https://github.com/snarktank/ralph) autonomous agent pattern.

---

## Interactive Workflow Flowchart

Open [`docs/flowchart.html`](docs/flowchart.html) in a browser to explore the full workflow interactively — animated step-by-step phases, decision points, the Ralph iteration loop, parallel execution diagrams, and all critical concepts.

---

## What it does

Takes a complex engineering task and executes it through four strict phases:

```
Phase 1: Planning        --> plan.md + todo.md
Phase 2: Workspace Setup --> isolated branches per phase
Phase 3: Implementation  --> dependency analysis --> prd.json per phase --> Ralph agent loop
Phase 4: Merge           --> merge_order.md --> safe integration
```

Each phase requires explicit user approval before proceeding. Each implementation phase follows the Ralph pattern: one story at a time, atomic commits, quality checks, progress tracking, and pattern consolidation.

---

## How it works — complete description

### The problem

Large engineering tasks — refactors, migrations, multi-service features — are too big for a single agent pass. Context windows exhaust, changes conflict, and quality degrades. Manual orchestration is slow and error-prone.

### The solution

This skill decomposes large tasks into isolated, dependency-ordered phases. Each phase is executed by an autonomous agent loop (the Ralph pattern) that handles one small story at a time with fresh context per iteration. Independent phases run in parallel. Quality gates enforce every commit. The entire workflow is resumable from any interruption.

### Phase 1 — Planning

The skill analyzes your task and produces two files without writing any code:

- **`plan.md`** — contains the objective, scope, assumptions, constraints, risks, a dependency map between phases, the architecture or refactoring strategy, and the execution phases with explicit dependency annotations. This document is the single source of truth for what will be built and why.

- **`todo.md`** — breaks the plan into small, actionable, idempotent tasks grouped by phase. Each task has a checkbox for progress tracking and dependency annotations. Completion criteria are defined per phase.

The skill stops and waits for your explicit approval. You can revise the plan as many times as needed. No code is written, no branches created.

### Phase 2 — Workspace setup

Creates an isolated workspace and git branch for each execution phase:

```
/tmp/<repo>-phases/
  phase-a-types/         --> branch: phase-a-types
  phase-b-api/           --> branch: phase-b-api
  phase-c-ui/            --> branch: phase-c-ui
```

Each workspace is a git worktree — a full copy of the repository on its own branch. Changes in one phase never affect another until the explicit merge in Phase 4. A `progress.txt` is initialized in each workspace to accumulate learnings.

### Phase 3 — Dependency analysis + implementation

Phase 3 runs three sequential sub-phases:

**3a — Dependency analysis**: reads `plan.md` and maps what each phase produces (files, APIs, types, schema), what it consumes from other phases, and the nature of each dependency (hard/blocking vs. soft/advisory). Identifies parallel groups (phases that can run simultaneously), sequential chains (phases that must run in order), and the critical path (the longest chain that determines minimum total time). Circular dependencies cause a halt requiring manual resolution.

**3b — Execution plan + PRD generation**: creates the execution documentation and Ralph workspace files:

- **`execution.md`** at repo root — the full dependency graph (ASCII visualization), parallel execution groups numbered by order, critical path analysis, risk assessment including conflict likelihood and shared file areas, and the rationale for the chosen execution order.

- **`prd.json`** in each phase workspace — user stories in Ralph format. Each story has an ID (`US-001`), title, description (`As a [user], I need [what] so that [why]`), acceptance criteria (must be objectively verifiable, always includes "Typecheck passes"), a priority (determines execution order), a `passes` flag (starts `false`, set to `true` on completion), and a `notes` field (empty by default, records blockers if the story gets stuck). Stories are right-sized: completable in one agent pass, describable in 2-3 sentences, ordered by internal dependency.

- **`CLAUDE.md`** in each phase workspace — the autonomous agent's instructions. Contains the full Ralph protocol: read prd.json, check progress.txt codebase patterns, pick the highest priority incomplete story, implement it, run quality checks, commit with a structured message (`feat: US-001 - Story Title`), mark the story as passing, append learnings to progress.txt, and stop. The task is restated at both the top and bottom of the file (prompt repetition) to ensure the agent maintains full attention.

- **`ralph-loop.sh`** in each phase workspace — the iteration engine. A bash loop that spawns fresh agent instances, one per story. Each iteration runs `claude < CLAUDE.md`, captures the output, and checks for the `PHASE_COMPLETE` signal. When all stories pass, the agent outputs `PHASE_COMPLETE` and the loop exits. Made executable with `chmod +x`.

**3c — Parallel execution**: launches the Ralph loops according to the dependency graph:

1. **Group 1** — all phases with zero dependencies start their `ralph-loop.sh` scripts simultaneously as background processes.
2. **Wait** — the orchestrator waits for all Group 1 processes to complete.
3. **Pattern propagation** — codebase patterns discovered in Group 1 (from their `progress.txt` files) are collected and injected into the next group's `CLAUDE.md` context, ensuring consistency.
4. **Group 2** — phases that depend on Group 1 launch in parallel.
5. Repeat until all groups complete.

Each iteration within a phase is a fresh agent instance with clean context. Memory persists across iterations via three channels: `prd.json` (which stories are done), `progress.txt` (learnings and patterns), and git (committed code). This prevents context exhaustion even on phases with many stories.

### Phase 4 — Merge

Creates `merge_order.md` with the recommended merge sequence informed by the dependency analysis. The document includes the merge order (foundations first), rationale, expected conflict areas, resolution strategies, and validation steps after each merge.

The merge proceeds one phase at a time: merge the branch, run full quality checks (typecheck, lint, tests), fix any issues, then proceed to the next branch. Phase 4 is not complete until the final merged result passes all checks.

### Error recovery

If quality checks fail after implementing a story, the Ralph loop:
1. Reads the error output
2. Attempts to fix the code (up to 3 tries)
3. If fixed, continues to commit
4. If stuck, records the blocker in `prd.json` notes and `progress.txt`, resets unstaged changes with `git checkout -- .`, and moves to the next story

No story is left in a broken state. Blocked stories are visible in `prd.json` and surfaced by the CLI (`node dist/index.js status`).

### Resumability

The workflow is fully resumable. If a session is interrupted mid-Phase 3:

1. Invoke `/phase` with the same task
2. Tell it to start from Phase 3c
3. Each phase's Ralph loop picks up from the first story where `passes: false`
4. `progress.txt` preserves all prior learnings

No special recovery steps needed.

---

## Quick start

### Claude Code

```bash
# Clone into your project or add as a plugin
git clone https://github.com/<your-org>/orchestration-skills .claude/plugins/orchestration-skills

# Or copy the skill directly
cp -r orchestration-skills/.claude/skills/orchestrate .claude/skills/orchestrate

# Invoke
/phase refactor the auth module into separate concerns with full test coverage
```

### GitHub Copilot — Custom Agents (recommended)

```bash
# Copy agent profiles into your project
mkdir -p .github/agents
cp orchestration-skills/.github/agents/phase.md .github/agents/
cp orchestration-skills/.github/agents/prd.md .github/agents/
cp orchestration-skills/.github/agents/ralph.md .github/agents/

# Optionally copy the base instructions
cp orchestration-skills/AGENTS.md ./AGENTS.md
cp orchestration-skills/.github/copilot-instructions.md .github/

# Invoke via Copilot Chat
@phase refactor the auth module into separate concerns with full test coverage
@prd plan a new notification system
@ralph convert tasks/prd-notifications.md
```

### GitHub Copilot — Prompt Files (alternative)

```bash
# Copy prompt files into your project
mkdir -p .github/prompts
cp orchestration-skills/.github/prompts/phase.prompt.md .github/prompts/
cp orchestration-skills/.github/prompts/prd.prompt.md .github/prompts/
cp orchestration-skills/.github/prompts/ralph.prompt.md .github/prompts/

# Invoke via Copilot Chat
/phase refactor the auth module into separate concerns with full test coverage
```

---

## Workflow

### Phase 1 — Planning

The skill analyzes your task and produces two files without writing any code:

- **`plan.md`** — objective, scope, assumptions, constraints, risks, dependency map, architecture strategy, execution phases
- **`todo.md`** — small actionable tasks grouped by phase, with checkboxes and dependency annotations

Stops and waits for your approval.

### Phase 2 — Workspace setup

Creates an isolated workspace and git branch for each execution phase:

```
/tmp/<repo>-phases/
  phase-a-types/         --> branch: phase-a-types
  phase-b-api/           --> branch: phase-b-api
  phase-c-ui/            --> branch: phase-c-ui
```

Each workspace has the original repo set as its remote. A `progress.txt` is initialized in each.

### Phase 3 — Dependency analysis + implementation

Three sub-phases:

**3a — Dependency analysis**: reads `plan.md` and maps what each phase produces, consumes, and depends on. Identifies parallel groups, sequential chains, and the critical path.

**3b — Execution plan + PRDs**: creates `execution.md` (dependency graph, parallel groups, execution order, risk assessment) and generates a `prd.json` in each phase workspace with Ralph-format user stories.

**3c — Implementation**: each phase runs the Ralph agent loop:

```
1. Read prd.json
2. Read progress.txt (check Codebase Patterns first)
3. Pick highest priority story where passes: false
4. Implement that single story
5. Run quality checks
6. Commit: feat: US-001 - Story Title
7. Set passes: true in prd.json
8. Append learnings to progress.txt
9. Repeat until all stories pass
10. Push branch to origin
```

In Claude Code, independent phases launch as parallel subagents. In Copilot, phases run sequentially (or the user opens multiple sessions for parallel work).

### Phase 4 — Merge

Creates `merge_order.md` with the recommended merge sequence informed by the dependency analysis. Optionally performs automatic merging with conflict resolution and post-merge validation.

---

## Critical concepts

### Plan before code
Phase 1 always runs first unless explicitly skipped. The entire execution plan is approved before any code is written.

### Isolated workspaces
Each phase gets its own git worktree and branch. No cross-contamination between phases during implementation.

### One story at a time (the Ralph pattern)
Each agent handles exactly ONE user story, then stops. A bash loop spawns fresh agent instances — one per story. This prevents context exhaustion and ensures atomic, testable increments. Memory persists via `prd.json` (state), `progress.txt` (learnings), and git (code).

### Quality gates
Every commit must pass quality checks (typecheck, lint, tests). Failed checks trigger retry (up to 3 attempts). Blocked stories are recorded and surfaced, never left broken.

### Parallel execution
Independent phases run simultaneously. Dependency analysis identifies which phases can safely overlap. Between parallel groups, codebase patterns from completed phases propagate to dependent phases.

### Prompt repetition
The task is restated before each phase and each story to ensure the model maintains full attention across long contexts and many iterations.

### Progress tracking
Three layers provide full visibility: `prd.json` flags (state machine), `todo.md` checkboxes (human view), and `progress.txt` learnings (agent memory).

### Pattern propagation
Codebase patterns discovered in earlier phases are extracted and injected into later phases' agent context, ensuring consistency across parallel implementations.

### Story right-sizing
Each story must be completable in one agent pass (one context window). If it can't be described in 2-3 sentences, it needs to be split. Acceptance criteria must be objectively verifiable.

### Dependency mapping
Each phase declares what it produces and consumes. Hard dependencies are blocking, soft dependencies are advisory. The critical path determines minimum execution time.

### Error recovery
3-attempt retry with diagnosis. If stuck: record blocker, reset changes, move to next story. The workflow is fully resumable from any interruption point.

---

## Managed files

| File | Location | Created in | Purpose |
|---|---|---|---|
| `plan.md` | repo root | Phase 1 | Execution plan, dependency map, risks |
| `todo.md` | repo root | Phase 1 | Task breakdown with checkboxes |
| `execution.md` | repo root | Phase 3b | Dependency graph, parallel groups, execution order |
| `prd.json` | each phase workspace | Phase 3b | Ralph-format user stories (state machine: passes true/false) |
| `progress.txt` | each phase workspace | Phase 2 | Progress log with learnings and codebase patterns |
| `CLAUDE.md` | each phase workspace | Phase 3b | Ralph agent instructions (one story per invocation) |
| `ralph-loop.sh` | each phase workspace | Phase 3b | Iteration loop — spawns fresh agents per story |
| `merge_order.md` | repo root | Phase 4 | Merge sequence and conflict expectations |

---

## Examples

### Large refactor

```
/phase Refactor the payments module into separate services: billing, invoicing,
and subscriptions. Each service should have its own data access layer and tests.
```

The skill will plan three implementation phases (one per service), analyze their dependencies, and execute them — potentially in parallel since they touch separate concerns.

### Testing strategy

```
/phase Create a comprehensive unit and integration testing strategy for the
user authentication flow, then implement all tests.
```

Phase 1 produces a testing plan. Phase 3 generates a `prd.json` with one story per test suite (unit tests for auth service, integration tests for login flow, etc.).

### Migration

```
/phase Migrate the database from MySQL to PostgreSQL. Include schema conversion,
query adapter updates, data migration scripts, and rollback procedures.
```

The skill identifies the sequential dependency chain (schema first, then adapters, then migration scripts) and executes them in order.

### Resume from a specific phase

```
/phase Setup is done, workspaces and branches are ready. Execute the implementation.
```

Skips to Phase 3, starting with dependency analysis.

```
/phase All phase branches are complete. Create merge instructions and merge automatically.
```

Skips to Phase 4.

---

## Aborting

To tear down all phase workspaces and branches:

```bash
git worktree list                                                    # see what exists
git worktree remove /tmp/<repo>-phases/<phase> --force               # remove each worktree
git branch -D <branch-name>                                          # delete branches
git worktree prune                                                   # clean up references
```

Tracking files in the main repo (`plan.md`, `todo.md`, `execution.md`) are preserved for reference.

---

## Project structure

```
AGENTS.md                     <-- Copilot coding agent instructions (repo-level)
docs/
  flowchart.html              <-- Interactive workflow flowchart (open in browser)
.claude/
  skills/
    orchestrate/SKILL.md     <-- /phase — main orchestration skill
    prd/SKILL.md              <-- /prd — PRD generator
    ralph/SKILL.md            <-- /ralph — PRD to prd.json converter
.claude-plugin/
  plugin.json                 <-- installable as Claude Code plugin
.github/
  agents/
    phase.md                  <-- @phase — orchestration custom agent
    prd.md                    <-- @prd — PRD generator custom agent
    ralph.md                  <-- @ralph — PRD converter custom agent
  copilot-instructions.md    <-- Copilot base instructions
  prompts/
    phase.prompt.md           <-- /phase for Copilot (prompt file)
    prd.prompt.md             <-- /prd for Copilot (prompt file)
    ralph.prompt.md           <-- /ralph for Copilot (prompt file)
src/
  index.ts                    <-- CLI (validate prd.json, report status)
  types.ts                    <-- TypeScript types (Ralph prd.json format)
```

### How subagents work

Each phase workspace is a complete Ralph environment:

```
/tmp/myapp-phases/phase-a-types/
  ralph-loop.sh    <-- Iteration loop (spawns fresh agents per story)
  CLAUDE.md        <-- Agent instructions (one story per invocation)
  prd.json         <-- User stories (state machine: passes true/false)
  progress.txt     <-- Progress log + codebase patterns
  (repo files via git worktree)
```

The iteration model is identical to Ralph's `ralph.sh`:

```
ralph-loop.sh (bash loop)
  |-- Iteration 1: claude < CLAUDE.md --> implements US-001 --> exits
  |-- Iteration 2: claude < CLAUDE.md --> implements US-002 --> exits
  |-- Iteration 3: claude < CLAUDE.md --> outputs PHASE_COMPLETE
  \-- Loop exits successfully
```

Each iteration is a **fresh agent instance with clean context**. The agent handles ONE story, then stops. Memory persists via `prd.json` (state), `progress.txt` (learnings), and git (code). This prevents context exhaustion on large phases.

**Both Claude Code and Copilot** launch parallel `ralph-loop.sh` scripts:

```bash
# Launch all independent phases in parallel
/tmp/myapp-phases/phase-a-types/ralph-loop.sh 20 &
/tmp/myapp-phases/phase-b-api/ralph-loop.sh 20 &
/tmp/myapp-phases/phase-c-ui/ralph-loop.sh 20 &
wait
```

### Installing as a plugin

```bash
# Install in any Claude Code project
claude plugin add /path/to/orchestration-skills

# Or clone and reference
git clone <repo-url> ~/.claude/plugins/orchestration-skills
```

### CLI utility

The TypeScript CLI validates `prd.json` files and reports phase completion status:

```bash
npm install
npm run build

# Validate a prd.json file (checks required fields, story ordering, acceptance criteria)
node dist/index.js validate /tmp/myapp-phases/phase-a-types/prd.json

# Show story completion status for a single phase
node dist/index.js status /tmp/myapp-phases/phase-a-types/prd.json

# Scan all phase workspaces and show aggregate progress
node dist/index.js status-all /tmp/myapp-phases
```

Example `status-all` output:
```
Phase Workspace Status: /tmp/myapp-phases
============================================================
  phase-a-types                ████████████████████ DONE
  phase-b-api                  ████████████░░░░░░░░ 3/5
  phase-c-ui                   ░░░░░░░░░░░░░░░░░░░░ 0/4
--------------------------------------------------------------
  Total: 7/13 stories passing
```

---

## Platform differences

| Capability | Claude Code | GitHub Copilot |
|---|---|---|
| Invoke | `/phase <task>` | `@phase <task>` (agent) or `/phase <task>` (prompt) |
| Parallel subagents | Native (Agent tool) | Manual (multiple sessions) |
| Task tracking | TaskCreate + file-based | File-based only |
| Workspaces | Full repo copy | git worktree preferred |
| Auto-trigger | Yes (description match) | No (manual invoke only) |
| Agent profiles | `.claude/skills/` | `.github/agents/` |

The workflow, Ralph pattern, managed files, and execution discipline are identical across both platforms.

---

## License

MIT
