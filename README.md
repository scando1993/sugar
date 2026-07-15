# Sugar

Phased software engineering execution — drives large engineering tasks through a strict multi-phase workflow with PRD-driven implementation, parallel execution, and progress tracking.

Built for **Claude Code**, **GitHub Copilot**, **Cursor**, **Windsurf**, **Cline**, **Codex**, **OpenCode**, and **Gemini CLI**.

Based on the [Ralph](https://github.com/snarktank/ralph) autonomous agent pattern.

> **Plugin name:** `sugar` · **Version:** 1.0.0 · **Author:** scando1993

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

`sugar run` (which `ralph-loop.sh` now just execs into) supports **model tiering**: it starts with a default model (e.g., Sonnet), automatically escalates to a more capable model (e.g., Opus) after 2 consecutive failures, and de-escalates back after a success — this state persists in `.sugar-state.json` so a resumed run doesn't reset it. Before each attempt, a snapshot tag namespaced by phase and story (`sugar/phase-a-types/US-001/attempt-1`) is created for clean rollback, so parallel phases never collide on the same tag.

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

No story is left in a broken state. Blocked stories are visible in `prd.json` and surfaced by the CLI (`sugar status`).

### Resumability

The workflow is fully resumable. If a session is interrupted mid-Phase 3:

1. Invoke `/sugar` with the same task
2. Tell it to start from Phase 3c
3. Each phase's Ralph loop picks up from the first story where `status` is `"pending"` or `"rejected"`
4. `progress.txt` preserves all prior learnings

No special recovery steps needed.

---

## Install

### One command (recommended)

[`npx skills`](https://github.com/JuliusBrussee/skills) supports 40+ agents — Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, and more:

```bash
npx skills add scando1993/sugar
```

To install for a specific agent:

```bash
npx skills add scando1993/sugar -a claude-code
npx skills add scando1993/sugar -a github-copilot
npx skills add scando1993/sugar -a cursor
npx skills add scando1993/sugar -a windsurf
npx skills add scando1993/sugar -a cline
npx skills add scando1993/sugar -a codex
npx skills add scando1993/sugar -a opencode
npx skills add scando1993/sugar -a gemini
```

### Manual install

<details>
<summary>Claude Code</summary>

```bash
# Install as a plugin
claude plugin add /path/to/sugar

# Or clone and copy skills
git clone https://github.com/scando1993/sugar .claude/plugins/sugar
```

</details>

<details>
<summary>GitHub Copilot — Custom Agents (recommended)</summary>

```bash
mkdir -p .github/agents
cp sugar/.github/agents/*.md .github/agents/

# Optionally copy base instructions
cp sugar/AGENTS.md ./AGENTS.md
cp sugar/.github/copilot-instructions.md .github/
```

</details>

<details>
<summary>GitHub Copilot — Prompt Files (alternative)</summary>

```bash
mkdir -p .github/prompts
cp sugar/.github/prompts/*.prompt.md .github/prompts/
```

</details>

<details>
<summary>Cursor</summary>

```bash
mkdir -p .cursor/rules
cp sugar/.cursor/rules/*.mdc .cursor/rules/
```

</details>

<details>
<summary>Windsurf</summary>

```bash
mkdir -p .windsurf/rules
cp sugar/.windsurf/rules/*.md .windsurf/rules/
```

</details>

<details>
<summary>Cline</summary>

```bash
mkdir -p .cline/rules
cp sugar/.cline/rules/*.md .cline/rules/
```

</details>

<details>
<summary>Codex</summary>

```bash
cp -r sugar/.agents/skills .agents/skills
```

</details>

<details>
<summary>OpenCode</summary>

```bash
# Option A: Copy OpenCode agents
mkdir -p .opencode/agents
cp sugar/.opencode/agents/*.md .opencode/agents/

# Option B: Claude Code skills (OpenCode reads these natively)
cp -r sugar/.claude/skills .claude/skills
```

</details>

<details>
<summary>Gemini CLI</summary>

```bash
cp -r sugar/.gemini .gemini
cp sugar/GEMINI.md ./GEMINI.md
```

</details>

---

## Quick start

```bash
# Claude Code
/sugar refactor the auth module into separate concerns with full test coverage
/debug investigate why login fails after password reset
/review check the auth refactor PR
/tdd implement the rate limiter with tests first
/brainstorm ideas for a real-time collaboration feature
/worktree create a worktree for the auth refactor
/finish prepare the auth branch for PR
/respond-review address the review comments on PR #42

# GitHub Copilot
@sugar refactor the auth module into separate concerns
@debug investigate why login fails after password reset

# Cursor / Windsurf / Cline — auto-matched by description
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

**3b — Execution plan + PRDs**: `sugar generate --phases phases.json` creates `execution.md` (dependency graph, parallel groups, execution order, risk assessment) and generates a `prd.json`, `CLAUDE.md`, `VERIFY.md`, and `ralph-loop.sh` in each phase workspace with Ralph-format user stories.

**3c — Implementation**: each phase runs `sugar run <workspace>`, which owns the entire loop:

```
1. Pick the highest-priority pending/rejected story, claim it (status: "implementing")
2. Create a namespaced snapshot tag (sugar/<phase>/<story-id>/attempt-<n>)
3. Spawn a fresh implementer agent (reads prd.json + progress.txt + failure_log.json first)
4. Read its result: implemented / failed / no signal — all three resolve the story, none leave it stuck
5. If implemented: spawn the verifier quorum against VERIFY.md, tally votes
6. On consensus PASS: commit, mark "passed", de-escalate model on success
7. On consensus FAIL: reset the working tree, mark "rejected" (or "blocked" past maxTerms), escalate model after repeated failures
8. Log result to progress.txt and persist model-tier/attempt state to .sugar-state.json
9. Repeat until no pending/rejected stories remain → exit complete (all passed) or stuck (some blocked)
```

In Claude Code, independent phases launch as parallel subagents, each backgrounding its own `sugar run` call (a foreground `&`/`wait` would exceed the Bash tool's execution cap). In Copilot, phases run sequentially (or the user opens multiple sessions for parallel work).

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
`sugar run` starts with a cost-effective model (e.g., Sonnet) and auto-escalates to a more capable model after 2 consecutive failures. De-escalates back after a success. Each phase can specify its own default model: `sugar run <workspace> --model sonnet`. State persists in `.sugar-state.json` so a resumed run continues from the same tier instead of resetting. Balances cost and capability.

### Consensus verification
Raft-inspired verification built into every phase. After implementation, a quorum of independent verifier agents review the code and cast VOTE:PASS or VOTE:FAIL. A required majority must pass before the story is committed. Rejected stories return to "rejected" status with feedback in rejection_log.txt.

### Iron laws
Three inviolable rules enforced in every CLAUDE.md: (1) ONE STORY per iteration — no "while I'm here" additions, (2) NEVER COMMIT BROKEN code — every commit must pass all quality checks, (3) READ PROGRESS.TXT FIRST — check codebase patterns before writing. A rationalization table helps agents catch self-deceptive shortcuts like "these two stories are small, I'll do both."

### Rollback & snapshot tags
Before each implementation attempt, a snapshot tag namespaced by phase and story (`sugar/<phase>/<story-id>/attempt-<n>`) is created, so parallel phase worktrees never collide on the same tag. On 3rd failure, a structured report is written to `failure_log.json`. Future agents read this to try a different approach rather than repeating the same mistake.

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
| `ralph-loop.sh` | each phase workspace | Phase 3b | Thin wrapper that execs `sugar run` for this workspace |
| `VERIFY.md` | each phase workspace | Phase 3b | Verifier agent instructions + vote format |
| `.sugar-state.json` | each phase workspace | Phase 3c | Model-tier state + per-story attempt counters, written/updated by `sugar run` every iteration |
| `patterns.json` | repo root | Phase 3c (between groups) | Structured codebase patterns for propagation |
| `failure_log.json` | each phase workspace | Phase 3b | Structured failure reports for retry strategy |
| `merge_order.md` | repo root | Phase 4 | Merge sequence and conflict expectations |

---

## Examples

### Large refactor

```
/sugar Refactor the payments module into separate services: billing, invoicing,
and subscriptions. Each service should have its own data access layer and tests.
```

The skill will plan three implementation phases (one per service), analyze their dependencies, and execute them — potentially in parallel since they touch separate concerns.

### Testing strategy

```
/sugar Create a comprehensive unit and integration testing strategy for the
user authentication flow, then implement all tests.
```

Phase 1 produces a testing plan. Phase 3 generates a `prd.json` with one story per test suite (unit tests for auth service, integration tests for login flow, etc.).

### Migration

```
/sugar Migrate the database from MySQL to PostgreSQL. Include schema conversion,
query adapter updates, data migration scripts, and rollback procedures.
```

The skill identifies the sequential dependency chain (schema first, then adapters, then migration scripts) and executes them in order.

### Resume from a specific phase

```
/sugar Setup is done, workspaces and branches are ready. Execute the implementation.
```

Skips to Phase 3, starting with dependency analysis.

```
/sugar All phase branches are complete. Create merge instructions and merge automatically.
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
    orchestrate/SKILL.md     <-- /sugar — main orchestration skill
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
    sugar.md, prd.md, ralph.md, debug.md, review.md, tdd.md,
    brainstorm.md, worktree.md, finish.md, respond-review.md
  copilot-instructions.md    <-- Copilot base instructions
  prompts/                    <-- Copilot prompt files (10 prompts)
    sugar.prompt.md, prd.prompt.md, ralph.prompt.md, debug.prompt.md,
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
  index.ts                    <-- CLI entry: validate, status(-all), dashboard, brainstorm,
                                   config, workspace, generate, run, verify, pick-story,
                                   story-update, snapshot, propagate-patterns
  types.ts                    <-- TypeScript types (Ralph prd.json format, PhaseDefinition, SugarConfig)
  lib/
    orchestrator.ts            <-- workspace-file generation, dependency graph, merge order
    loop-runner.ts             <-- `sugar run` — owns the entire Ralph iteration loop
    verifier.ts                <-- `sugar verify` — verifier quorum + consensus tally
    consensus.ts, ralph-loop.ts, model-tier.ts, dependency.ts, patterns.ts, workspace.ts
    config.ts                  <-- config loading/merging, repo-root resolution
    agent-runner.ts             <-- spawns implementer/verifier agents
    templates/                 <-- CLAUDE.md / VERIFY.md / ralph-loop.sh generators
```

### How subagents work

Each phase workspace is a complete Ralph environment:

```
/tmp/myapp-phases/phase-a-types/
  ralph-loop.sh      <-- Thin wrapper: exec sugar run "$SCRIPT_DIR" ...
  CLAUDE.md          <-- Agent instructions (one story per invocation)
  prd.json           <-- User stories (consensus state machine: status lifecycle)
  progress.txt       <-- Progress log + codebase patterns
  .sugar-state.json  <-- Model-tier + per-story attempt counters (written by `sugar run`)
  (repo files via git worktree)
```

The iteration model is conceptually identical to Ralph's `ralph.sh`, but the loop itself — story picking, claiming, snapshotting, spawning the implementer, spawning the verifier quorum, committing, escalating — is owned by the `sugar` CLI (`sugar run`), not bash:

```
sugar run <workspace>
  |-- Iteration 1: claims US-001 --> implementer agent --> verifier quorum --> commit on PASS
  |-- Iteration 2: claims US-002 --> ...
  |-- Iteration 3: claims US-003 --> ...
  \-- No pending/rejected stories left --> exits: complete (all passed) or stuck (some blocked)
```

Each implementer/verifier invocation is a **fresh agent instance with clean context**. Memory persists via `prd.json` (state), `progress.txt` (learnings), `.sugar-state.json` (model tier/attempts), and git (code, plus namespaced snapshot tags). This prevents context exhaustion on large phases.

**In Claude Code**, launch each phase's loop as its own backgrounded tool call rather than `&`-joining several inside one foreground command — `sugar run` can run for many minutes and a foreground `wait` across phases exceeds the Bash tool's execution cap:

```bash
sugar run /tmp/myapp-phases/phase-a-types --max-iterations 20   # background
sugar run /tmp/myapp-phases/phase-b-api --max-iterations 20     # background
sugar run /tmp/myapp-phases/phase-c-ui --max-iterations 20      # background
```

**In Copilot** (and other platforms without a background-execution primitive), run these sequentially, or open multiple sessions for parallel work.

### Installing as a plugin

```bash
# Install in any Claude Code project
claude plugin add /path/to/sugar

# Or clone and reference
git clone <repo-url> ~/.claude/plugins/sugar
```

### CLI

```bash
./scripts/install.sh   # npm install && npm run build && npm link

# Create sugar.config.json (models, quorum size, workspaceBasePath, permissionMode, ...)
sugar config init

# Create workspaces (Phase 2), then generate their prd.json/CLAUDE.md/VERIFY.md/ralph-loop.sh (Phase 3b)
sugar workspace create phase-a-types
sugar generate --phases phases.json --task "Refactor the payments module"

# Run the Ralph loop for a workspace until complete/stuck/max-iterations (Phase 3c)
sugar run /tmp/myapp-phases/phase-a-types --max-iterations 20 --model sonnet

# Run just the verifier quorum for one story (also called internally by `sugar run`)
sugar verify --story US-001 --workspace /tmp/myapp-phases/phase-a-types

# Validate a prd.json file
sugar validate /tmp/myapp-phases/phase-a-types/prd.json

# Show story completion status for a single phase
sugar status /tmp/myapp-phases/phase-a-types/prd.json

# Scan all phase workspaces and show aggregate progress
sugar status-all /tmp/myapp-phases

# Generate interactive HTML dashboard and open in browser
sugar dashboard /tmp/myapp-phases

# Generate interactive brainstorm HTML for a feature
sugar brainstorm "Add real-time collaboration to the editor"
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

All 10 skills are available on 8 platforms:

| Platform | Skill location | Invoke syntax | Notes |
| --- | --- | --- | --- |
| **Claude Code** | `.claude/skills/<name>/SKILL.md` | `/sugar <task>` | Native plugin. Parallel subagents via Agent tool. |
| **GitHub Copilot** | `.github/agents/<name>.md` + `.github/prompts/<name>.prompt.md` | `@sugar <task>` or `/sugar <task>` | Custom agents (recommended) or prompt files. |
| **Cursor** | `.cursor/rules/<name>.mdc` | Agent-requested (description match) | Rules with intelligent matching. `alwaysApply: false`. |
| **Windsurf** | `.windsurf/rules/<name>.md` | Agent-requested (description match) | Rules with intelligent matching. |
| **Cline** | `.cline/rules/<name>.md` | Agent-requested (description match) | Rules with intelligent matching. |
| **Codex** | `.agents/skills/<name>/SKILL.md` | Implicit (description match) | Native skill format. Hierarchical with `AGENTS.md`. |
| **OpenCode** | `.opencode/agents/<name>.md` | Agent-requested | Also reads `.claude/skills/` natively (zero-config). |
| **Gemini CLI** | `.gemini/skills/<name>.md` via `GEMINI.md` | Context-loaded | Skills imported via `@` syntax in `GEMINI.md`. |

All platforms also installable via `npx skills add scando1993/sugar -a <platform>`.

The planning, PRD generation, dependency analysis, and managed-files layer (Phases 1–3b) are identical across all platforms — they're plain CLI commands and markdown. **Phase 3c's autonomous loop is not**: `sugar run` spawns the implementer/verifier agents via the `runnerBin` configured in `sugar.config.json` (default: `claude`), using that CLI's own flags (`--model`, `--print`, `--permission-mode`). It works out of the box with Claude Code. Using it with another agent CLI requires that CLI to accept an equivalent flag set, or adapting `src/lib/agent-runner.ts`. Platforms without a compatible CLI can still use Sugar through Phase 3b (generate the workspaces and PRDs), then implement each story manually or with that platform's own agent.

---

## License

MIT
