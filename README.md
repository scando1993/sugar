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
                              + model tiering + consensus verification + pattern propagation
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

- **`prd.json`** in each phase workspace — user stories in Ralph format. Each story has an ID (`US-001`), title, description (`As a [user], I need [what] so that [why]`), acceptance criteria (must be objectively verifiable, always includes "Typecheck passes"), a priority (determines execution order), a `status` field (lifecycle: `"pending"` -> `"implementing"` -> `"verifying"` -> `"passed"` or `"rejected"`), `term`, `votes`, and a `notes` field (empty by default, records blockers if the story gets stuck). Stories are right-sized: completable in one agent pass, describable in 2-3 sentences, ordered by internal dependency.

- **`CLAUDE.md`** in each phase workspace — the autonomous agent's instructions. Contains the full Ralph protocol with **iron laws** (ONE STORY per iteration, NEVER COMMIT BROKEN code, READ PROGRESS.TXT FIRST), a 6-step **quality protocol** (implement, self-review, run checks, verify criteria, commit, fix-if-fail), and a **rationalization table** that catches agent self-deception. The agent picks stories with `status: "pending"` or `"rejected"`, checks `failure_log.json` for prior failures, and outputs `STORY_IMPLEMENTED:US-XXX` for verifier agents.

- **`ralph-loop.sh`** in each phase workspace — the iteration engine. A bash loop that spawns fresh agent instances, one per story. Each iteration runs `claude < CLAUDE.md`, captures the output, and checks for the `PHASE_COMPLETE` signal. When all stories pass, the agent outputs `PHASE_COMPLETE` and the loop exits. Made executable with `chmod +x`.

- **`VERIFY.md`** in each phase workspace — the verifier agent's instructions. Contains iron laws, a rationalization table, and the VOTE:PASS/VOTE:FAIL output format. A quorum of verifier agents independently review each story implementation before it can be committed.

- **`patterns.json`** at repo root (generated between groups) — structured codebase patterns extracted from completed phases. Each pattern has a name, description, `applies_to` scope, and example. Injected into the next group's CLAUDE.md context for consistency.

- **`failure_log.json`** in each phase workspace — structured failure reports (storyId, attempt, filesModified, failureType, lastError). Created after 3 failed attempts on a story. Future agents read this to try a different approach.

The `ralph-loop.sh` script supports **model tiering**: it starts with a default model (e.g., Sonnet), automatically escalates to a more capable model (e.g., Opus) after 2 consecutive failures, and de-escalates back after a success. Before each attempt, a snapshot tag (`attempt-US-001-v1`) is created for clean rollback.

**3c — Parallel execution**: launches the Ralph loops according to the dependency graph:

1. **Group 1** — all phases with zero dependencies start their `ralph-loop.sh` scripts simultaneously as background processes.
2. **Wait** — the orchestrator waits for all Group 1 processes to complete.
3. **Pattern propagation** — codebase patterns discovered in Group 1 are extracted into `patterns.json` (structured format with name, description, scope, and example), then injected into the next group's `CLAUDE.md` under a `## Known Patterns` section, ensuring consistency across parallel implementations.
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
3. Each phase's Ralph loop picks up from the first story where `status` is `"pending"` or `"rejected"`
4. `progress.txt` preserves all prior learnings

No special recovery steps needed.

---

## Quick start

### Claude Code

```bash
# Clone into your project or add as a plugin
git clone https://github.com/<your-org>/sugar .claude/plugins/sugar

# Or copy the skill directly
cp -r sugar/.claude/skills/orchestrate .claude/skills/orchestrate

# Invoke
/phase refactor the auth module into separate concerns with full test coverage

# Other available skills
/debug investigate why login fails after password reset
/review check the auth refactor PR
/tdd implement the rate limiter with tests first
/brainstorm ideas for a real-time collaboration feature
/worktree create a worktree for the auth refactor
/finish prepare the auth branch for PR
/respond-review address the review comments on PR #42
```

### GitHub Copilot — Custom Agents (recommended)

```bash
# Copy agent profiles into your project
mkdir -p .github/agents
cp sugar/.github/agents/phase.md .github/agents/
cp sugar/.github/agents/prd.md .github/agents/
cp sugar/.github/agents/ralph.md .github/agents/
cp sugar/.github/agents/debug.md .github/agents/
cp sugar/.github/agents/review.md .github/agents/
cp sugar/.github/agents/tdd.md .github/agents/
cp sugar/.github/agents/brainstorm.md .github/agents/
cp sugar/.github/agents/worktree.md .github/agents/
cp sugar/.github/agents/finish.md .github/agents/
cp sugar/.github/agents/respond-review.md .github/agents/

# Optionally copy the base instructions
cp sugar/AGENTS.md ./AGENTS.md
cp sugar/.github/copilot-instructions.md .github/

# Invoke via Copilot Chat
@phase refactor the auth module into separate concerns with full test coverage
@prd plan a new notification system
@ralph convert tasks/prd-notifications.md
@debug investigate why login fails after password reset
@review check the auth refactor PR
@tdd implement the rate limiter with tests first
@brainstorm ideas for a real-time collaboration feature
@worktree create a worktree for the auth refactor
@finish prepare the auth branch for PR
@respond-review address the review comments on PR #42
```

### GitHub Copilot — Prompt Files (alternative)

```bash
# Copy prompt files into your project
mkdir -p .github/prompts
cp sugar/.github/prompts/phase.prompt.md .github/prompts/
cp sugar/.github/prompts/prd.prompt.md .github/prompts/
cp sugar/.github/prompts/ralph.prompt.md .github/prompts/
cp sugar/.github/prompts/debug.prompt.md .github/prompts/
cp sugar/.github/prompts/review.prompt.md .github/prompts/
cp sugar/.github/prompts/tdd.prompt.md .github/prompts/
cp sugar/.github/prompts/brainstorm.prompt.md .github/prompts/
cp sugar/.github/prompts/worktree.prompt.md .github/prompts/
cp sugar/.github/prompts/finish.prompt.md .github/prompts/
cp sugar/.github/prompts/respond-review.prompt.md .github/prompts/

# Invoke via Copilot Chat
/phase refactor the auth module into separate concerns with full test coverage
```

### Cursor

```bash
# Copy rules into your project
mkdir -p .cursor/rules
cp sugar/.cursor/rules/*.mdc .cursor/rules/

# Rules are auto-matched by description — just start coding
# The agent will apply relevant rules based on your task
```

### Codex

```bash
# Copy skills into your project
cp -r sugar/.agents/skills .agents/skills

# Skills are auto-matched by description
```

### OpenCode

```bash
# Option A: Copy OpenCode agents
mkdir -p .opencode/agents
cp sugar/.opencode/agents/*.md .opencode/agents/

# Option B: Copy Claude Code skills (OpenCode reads these natively)
cp -r sugar/.claude/skills .claude/skills
```

### Gemini CLI

```bash
# Copy Gemini skills and main instruction file
cp -r sugar/.gemini .gemini
cp sugar/GEMINI.md ./GEMINI.md
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
1. Read prd.json + failure_log.json
2. Read progress.txt (check Codebase Patterns first)
3. Pick highest priority incomplete story
4. Create snapshot tag (attempt-US-XXX-v1)
5. Implement that single story
6. Run 6-step quality protocol
7. Legacy: commit if passing / Consensus: STORY_IMPLEMENTED → verifier quorum → tally votes
8. Update prd.json (status: "passed")
9. Log model + result to progress.txt
10. Model escalation check (2+ failures → upgrade model)
11. Repeat until all stories pass
12. Push branch to origin
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

### Model tiering
The ralph-loop.sh starts with a cost-effective model (e.g., Sonnet) and auto-escalates to a more capable model after 2 consecutive failures. De-escalates back after a success. Each phase can specify its own default model: `ralph-loop.sh 20 sonnet`. Balances cost and capability.

### Consensus verification
Raft-inspired verification built into every phase. After implementation, a quorum of independent verifier agents review the code and cast VOTE:PASS or VOTE:FAIL. A required majority must pass before the story is committed. Rejected stories return to "rejected" status with feedback in rejection_log.txt.

### Iron laws
Three inviolable rules enforced in every CLAUDE.md: (1) ONE STORY per iteration — no "while I'm here" additions, (2) NEVER COMMIT BROKEN code — every commit must pass all quality checks, (3) READ PROGRESS.TXT FIRST — check codebase patterns before writing. A rationalization table helps agents catch self-deceptive shortcuts like "these two stories are small, I'll do both."

### Rollback & snapshot tags
Before each implementation attempt, a snapshot tag (`attempt-US-001-v1`) is created. On 3rd failure, a structured report is written to `failure_log.json`. Future agents read this to try a different approach rather than repeating the same mistake.

---

## Managed files

| File | Location | Created in | Purpose |
| --- | --- | --- | --- |
| `plan.md` | repo root | Phase 1 | Execution plan, dependency map, risks |
| `todo.md` | repo root | Phase 1 | Task breakdown with checkboxes |
| `execution.md` | repo root | Phase 3b | Dependency graph, parallel groups, execution order |
| `prd.json` | each phase workspace | Phase 3b | Ralph-format user stories (consensus state machine: status lifecycle) |
| `progress.txt` | each phase workspace | Phase 2 | Progress log with learnings and codebase patterns |
| `CLAUDE.md` | each phase workspace | Phase 3b | Ralph agent instructions (one story per invocation) |
| `ralph-loop.sh` | each phase workspace | Phase 3b | Iteration loop — spawns fresh agents per story |
| `VERIFY.md` | each phase workspace | Phase 3b | Verifier agent instructions + vote format |
| `patterns.json` | repo root | Phase 3c (between groups) | Structured codebase patterns for propagation |
| `failure_log.json` | each phase workspace | Phase 3b | Structured failure reports for retry strategy |
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
GEMINI.md                     <-- Gemini CLI instructions (imports from .gemini/skills/)
docs/
  flowchart.html              <-- Interactive workflow flowchart (open in browser)
  pressure_testing.md         <-- Pressure-testing framework for skills
.claude/
  skills/
    orchestrate/SKILL.md     <-- /phase — main orchestration skill
    prd/SKILL.md              <-- /prd — PRD generator
    ralph/SKILL.md            <-- /ralph — PRD to prd.json converter
    debug/SKILL.md            <-- /debug — systematic debugging skill
    review/SKILL.md           <-- /review — adversarial code review skill
    tdd/SKILL.md              <-- /tdd — test-driven development skill
    brainstorm/SKILL.md       <-- /brainstorm — feature brainstorming skill
    worktree/SKILL.md         <-- /worktree — git worktree management skill
    finish/SKILL.md           <-- /finish — branch finishing / PR prep skill
    respond-review/SKILL.md   <-- /respond-review — receiving code review skill
.claude-plugin/
  plugin.json                 <-- installable as Claude Code plugin
.github/
  agents/                     <-- Copilot custom agents (10 agents)
    phase.md, prd.md, ralph.md, debug.md, review.md, tdd.md,
    brainstorm.md, worktree.md, finish.md, respond-review.md
  copilot-instructions.md    <-- Copilot base instructions
  prompts/                    <-- Copilot prompt files (10 prompts)
    phase.prompt.md, prd.prompt.md, ralph.prompt.md, debug.prompt.md,
    review.prompt.md, tdd.prompt.md, brainstorm.prompt.md,
    worktree.prompt.md, finish.prompt.md, respond-review.prompt.md
.cursor/
  rules/                      <-- Cursor rules (10 .mdc files)
    orchestrate.mdc, prd.mdc, ralph.mdc, debug.mdc, review.mdc,
    tdd.mdc, brainstorm.mdc, worktree.mdc, finish.mdc, respond-review.mdc
.agents/
  skills/                     <-- Codex skills (10 skills)
    orchestrate/, prd/, ralph/, debug/, review/, tdd/,
    brainstorm/, worktree/, finish/, respond-review/
.opencode/
  agents/                     <-- OpenCode agents (10 agents)
    orchestrate.md, prd.md, ralph.md, debug.md, review.md, tdd.md,
    brainstorm.md, worktree.md, finish.md, respond-review.md
  config.json                 <-- OpenCode project config
.gemini/
  skills/                     <-- Gemini CLI skills (10 .md files)
    orchestrate.md, prd.md, ralph.md, debug.md, review.md, tdd.md,
    brainstorm.md, worktree.md, finish.md, respond-review.md
src/
  index.ts                    <-- CLI (validate, status, dashboard, brainstorm)
  types.ts                    <-- TypeScript types (Ralph prd.json format)
```

### How subagents work

Each phase workspace is a complete Ralph environment:

```
/tmp/myapp-phases/phase-a-types/
  ralph-loop.sh    <-- Iteration loop (spawns fresh agents per story)
  CLAUDE.md        <-- Agent instructions (one story per invocation)
  prd.json         <-- User stories (consensus state machine: status lifecycle)
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
claude plugin add /path/to/sugar

# Or clone and reference
git clone <repo-url> ~/.claude/plugins/sugar
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

# Generate interactive HTML dashboard and open in browser
node dist/index.js dashboard /tmp/myapp-phases

# Generate interactive brainstorm HTML for a feature
node dist/index.js brainstorm "Add real-time collaboration to the editor"
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

## Platform support

All 10 skills are available on 6 platforms:

| Platform | Skill location | Invoke syntax | Notes |
| --- | --- | --- | --- |
| **Claude Code** | `.claude/skills/<name>/SKILL.md` | `/phase <task>` | Native plugin. Parallel subagents via Agent tool. |
| **GitHub Copilot** | `.github/agents/<name>.md` + `.github/prompts/<name>.prompt.md` | `@phase <task>` or `/phase <task>` | Custom agents (recommended) or prompt files. |
| **Cursor** | `.cursor/rules/<name>.mdc` | Agent-requested (description match) | Rules with intelligent matching. `alwaysApply: false`. |
| **Codex** | `.agents/skills/<name>/SKILL.md` | Implicit (description match) | Native skill format. Hierarchical with `AGENTS.md`. |
| **OpenCode** | `.opencode/agents/<name>.md` | Agent-requested | Also reads `.claude/skills/` natively (zero-config). |
| **Gemini CLI** | `.gemini/skills/<name>.md` via `GEMINI.md` | Context-loaded | Skills imported via `@` syntax in `GEMINI.md`. |

The workflow, Ralph pattern, managed files, and execution discipline are identical across all platforms.

---

## License

MIT
