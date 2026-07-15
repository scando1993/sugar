> This platform has no literal argument-substitution mechanism — wherever these instructions say `$ARGUMENTS`, treat it as the engineering task under discussion in the current conversation.

# Phased Software Engineering Execution

## Task
$ARGUMENTS

---

## Prerequisite: `sugar` CLI must be installed

This skill shells out to the `sugar` binary for workspace creation, story state, consensus, and pattern propagation. Before Phase 2, verify it is on PATH:

```bash
command -v sugar >/dev/null || {
  echo "sugar CLI not found. Install it from the plugin root:"
  echo "  ./scripts/install.sh"
  exit 1
}
```

If missing, run the bootstrap from the plugin repo root:

```bash
./scripts/install.sh    # runs npm install && npm run build && npm link
```

That puts `sugar` on `$PATH` via `npm link`. The Ralph workspace files (`prd.json`, `CLAUDE.md`, `VERIFY.md`, `ralph-loop.sh`) are generated per-workspace by `sugar generate` (Phase 3b) from templates in the CLI — no separate template files to copy.

---

## Permission mode for spawned agents

Implementer and verifier agents are spawned non-interactively by `sugar run` — there is no one watching to approve tool calls mid-iteration, so the permission mode must be decided up front, not discovered as a hang partway through an unattended run.

Before Phase 3b, set `permissionMode` in `sugar.config.json` (created by `sugar config init`):

```json
{ "permissionMode": "acceptEdits" }
```

- `"acceptEdits"` (default) — file edits are auto-approved; other prompts still apply. Reasonable default for most repos.
- `"skip"` — `--dangerously-skip-permissions`; no prompts at all. Only use this in a fully disposable/sandboxed environment (e.g. an ephemeral container), never on a repo or machine you care about.
- `"default"` — fully interactive. Will hang forever in a backgrounded `sugar run` loop — don't use it for Phase 3c.

If the user hasn't stated a preference, use `"acceptEdits"` and say so explicitly rather than silently defaulting to `"skip"`.

---

## Reference

Subagent execution follows the **[Ralph](https://github.com/snarktank/ralph)** pattern. Each phase workspace is a self-contained Ralph environment: `CLAUDE.md` (agent instructions), `prd.json` (story state machine), `progress.txt` (learning persistence). Subagents are autonomous — they read their workspace instructions and execute independently.

The **Sugar** library (`src/lib/`) is the source of truth for all execution logic. Skills delegate to `sugar` CLI commands for workspace management, story state, consensus, and pattern propagation.

---

## Prompt reinforcement

Use **prompt repetition** at every decision boundary: state the task, provide context, give the instruction, restate context briefly, repeat the instruction. Apply at skill level (restate `$ARGUMENTS` before each phase), subagent level (each workspace CLAUDE.md repeats the task), and per-story (restate acceptance criteria before implementing).

---

## Core behavior

Execute in **strict phases**. Never move to the next phase without **explicit user approval**.

Before every phase, restate: **"The original task is: $ARGUMENTS. This phase's goal is: [phase goal]."**

---

## Phase 1 — Planning

### Goal
Analyze the task and produce a complete execution plan. Do not implement any code.

**Restate**: The original task is `$ARGUMENTS`. This phase produces `plan.md` and `todo.md` only.

### Actions

Use the `/prd` skill approach: analyze the task, ask clarifying questions if ambiguous, then produce structured requirements.

Create `plan.md` at the repo root containing:
- objective, scope, assumptions, constraints, risks
- **dependency map** — which parts depend on other parts
- architecture / refactor / testing strategy as relevant
- execution phases with explicit dependency annotations
- blockers

Create `todo.md` at the repo root containing:
- small, actionable, idempotent tasks grouped by phase
- checkbox progress tracking (`- [ ]`)
- dependency annotations per task
- completion criteria per phase

### Rules
- Do not implement anything or create branches
- Stop after Phase 1 and wait for user approval

---

## Phase 2 — Workspace and branch setup

### Goal
Create an isolated Ralph workspace for each execution phase.

**Restate**: The original task is `$ARGUMENTS`. This phase creates one git worktree per phase, each pre-loaded with the Ralph agent structure.

### Preconditions
Only start after explicit user approval.

### Actions

Use the Sugar CLI to create workspaces:

```bash
# Create workspace for each phase
sugar workspace create <phase-name>

# List created workspaces
sugar workspace list
```

Branch naming: `phase-a-<scope>`, `phase-b-<scope>`, etc.

### Rules
- One worktree per phase, one branch per phase
- Do not start implementation unless user approves Phase 3
- Document setup problems in `plan.md`

---

## Phase 3 — Dependency analysis, PRD generation, and parallel implementation

### Preconditions
Only start after explicit user approval.

**Restate**: The original task is `$ARGUMENTS`. This phase analyzes dependencies, generates Ralph workspaces with prd.json and CLAUDE.md per phase, then launches all independent phases as parallel subagents.

Sub-phases: **3a → 3b → 3c**.

---

### Phase 3a — Dependency analysis

Read `plan.md` thoroughly. For each phase determine:

1. **Produces**: artifacts, files, APIs, types, state changes
2. **Consumes**: what it needs from other phases
3. **Hard dependencies**: must complete before this starts
4. **Soft dependencies**: helpful but not blocking
5. **Independence**: zero overlap with other phases

Build the dependency graph. Identify **parallel groups**, **sequential chains**, and the **critical path**.

---

### Phase 3b — Generate execution.md, prd.json, and CLAUDE.md per workspace

Author a `phases.json` describing every phase from the Phase 3a analysis — one entry per workspace already created in Phase 2. Schema is `PhaseDefinition[]` (see `src/types.ts`):

```json
[
  {
    "id": "phase-a-types",
    "name": "Core Types",
    "scope": "Define shared types consumed by API and UI phases",
    "model": "sonnet",
    "produces": ["src/types/*.ts"],
    "consumes": [],
    "dependencies": [],
    "stories": [
      { "title": "Add User type", "description": "As a dev, I need a User type so other phases can share it", "acceptanceCriteria": ["Type compiles", "Exported from index"] }
    ]
  }
]
```

Then generate every workspace's files in one command:

```bash
# Initialize config if not present (also where permissionMode, models, etc. live)
sugar config init

# Generates prd.json, CLAUDE.md, VERIFY.md, ralph-loop.sh per workspace + execution.md at repo root
sugar generate --phases phases.json --task "$ARGUMENTS"
```

`sugar generate` fails loudly listing any phase whose Phase-2 workspace is missing — it never silently creates one. Create the missing workspace(s) with `sugar workspace create <phase>` and re-run.

For each workspace, the library generates:
- **`prd.json`** — Ralph-format user stories with consensus state machine
- **`CLAUDE.md`** — Agent instructions with iron laws, quality protocol, red flags
- **`VERIFY.md`** — Verifier agent instructions with vote format
- **`ralph-loop.sh`** — Iteration engine that spawns fresh agents per story
- **`execution.md`** at repo root — dependency graph, parallel groups, model strategy

**Story rules:** completable in one pass, ordered by dependency (schema → backend → UI), verifiable criteria, always include "Typecheck passes".

#### Rules
- Every workspace must have: `prd.json`, `progress.txt`, `CLAUDE.md`, `ralph-loop.sh`, `VERIFY.md`
- Do not proceed to 3c until all workspaces are fully set up
- Validate each `prd.json`: `sugar validate <workspace>/prd.json`

---

### Phase 3c — Parallel execution via `sugar run`

#### Goal
Launch the Ralph iteration loop for each phase in the current group, in parallel.

#### How iteration works

`sugar run <workspace>` **is** the loop — it owns story picking, atomic claiming, snapshotting, spawning a fresh implementer agent, spawning the verifier quorum, committing on consensus pass, and model escalation, all in one command. `ralph-loop.sh` still exists per workspace but is now a one-line wrapper (`exec sugar run "$SCRIPT_DIR" ...`) kept only so existing invocations don't break — calling `sugar run` directly is equivalent and preferred.

```
sugar run <workspace>
  ├── Iteration 1: claims US-001 (implementing) → implementer agent → verifier quorum → commit on PASS
  ├── Iteration 2: claims US-002 → ...
  ├── Iteration 3: claims US-003 → ...
  └── No pending/rejected stories left → exits: complete (all passed) or stuck (some blocked)
```

Each implementer/verifier invocation is a **fresh agent instance with clean context**. Memory persists via:
- `prd.json` — which stories are done (`status: "passed"/"pending"/"rejected"/"blocked"`)
- `.sugar-state.json` — model escalation state and per-story attempt counters, so a resumed run doesn't reset either
- `progress.txt` — learnings and codebase patterns
- git history — all committed code, plus namespaced snapshot tags (`sugar/<phase>/<story>/attempt-N`)

#### Execution — one backgrounded Bash call per phase, never a foreground `wait`

`sugar run` can iterate for many minutes across many stories — a foreground `... & wait` exceeds the Bash tool's 10-minute cap and contradicts running phases as parallel subagents. Launch **one Bash tool call per phase in the group, each with `run_in_background: true`**, not multiple `&`-backgrounded processes inside one foreground call:

```bash
sugar run /tmp/<repo>-phases/phase-a --max-iterations 20 --model sonnet
```
```bash
sugar run /tmp/<repo>-phases/phase-b --max-iterations 20 --model sonnet
```

Each backgrounded call is tracked independently and you are notified automatically when it completes — do not poll it in a sleep loop. If you want an interim progress check without waiting, this returns immediately:

```bash
sugar status-all /tmp/<repo>-phases
```

Once every phase in the group has completed (all notifications received), propagate patterns before starting the next group:

```bash
sugar propagate-patterns --base /tmp/<repo>-phases --inject
```

Then launch the next group's phases the same way — one backgrounded `sugar run` call per phase.

#### Model selection per phase
- **Sonnet** (default): Well-scoped implementation tasks
- **Haiku**: Mechanical tasks — config changes, boilerplate
- **Opus**: Complex architectural decisions, ambiguous requirements

Auto-escalates to Opus on 2+ consecutive failures (configurable via `sugar.config.json`'s `escalation.threshold`); de-escalates back to the default model after the next success.

#### Completion tracking

`sugar run` exits with a status distinguishing three outcomes:
- **`complete`** (exit 0) — all stories passed. Safe to move to the next group / Phase 4.
- **`stuck`** (exit 3) — no pending/rejected stories remain, but not all passed (one or more `blocked` after repeated verifier rejection). Needs attention before the phase can be considered done — do not silently treat this as complete.
- **`max_iterations`** (exit 1) — work remains but the iteration budget ran out. Re-run with a higher `--max-iterations`, or investigate why stories keep needing retries.

Monitor progress across all phases at once: `sugar status-all /tmp/<repo>-phases`.

#### Rules
- Never launch a dependent phase before prerequisites are confirmed complete
- Treat `stuck` (blocked stories) as a blocker to resolve, not as done — inspect blocked stories' `notes` field and `rejection_log.txt` in that workspace
- Propagate codebase patterns between groups
- One story per commit, all commits must pass quality checks

---

## Phase 4 — Merge

### Goal
Safely integrate all completed phase branches.

**Restate**: The original task is `$ARGUMENTS`. All phases complete. Merge in dependency order.

### Preconditions
Only start after explicit user approval.

### Actions

The orchestrator generates `merge_order.md`:

```bash
# View workspace status first
sugar status-all /tmp/<repo>-phases
```

Create `merge_order.md` at repo root with:
- merge order aligned with dependency graph (foundations first)
- rationale for ordering
- expected conflict areas
- conflict resolution notes
- validation steps after each merge

**Automatic merge:**
- Merge in documented order
- Resolve conflicts using best engineering judgment
- Validate after each merge: run quality checks
- Update `merge_order.md` with actual conflict notes

### Post-merge validation
Phase 4 is **not complete** until the final merged result passes all checks.

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

## How to interpret user requests

| User says | Start from |
|---|---|
| Planning only / no qualifier | Phase 1 |
| Planning is approved | Phase 2 |
| Setup is done | Phase 3 (3a → 3b → 3c) |
| PRDs exist, ready to implement | Phase 3c |
| All branches done, wants merge | Phase 4 |
| Testing only | Phase 1 (testing strategy), then normal flow |

---

## Execution rules

### Source of truth
- Before Phase 3c: `todo.md`
- During Phase 3c: each workspace's `prd.json`
- After each phase completes: sync back to `todo.md`

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
| `VERIFY.md` | each worktree | Phase 3b |
| `.sugar-state.json` | each worktree | Phase 3c (written/updated by `sugar run` every iteration) |
| `patterns.json` | repo root | Phase 3c (between groups) |
| `merge_order.md` | repo root | Phase 4 |

---

**The first deliverable is always Phase 1 planning only**, unless the user explicitly states that a later phase is already approved.

**Restate**: Given the task `$ARGUMENTS` — start with Phase 1. Produce `plan.md` and `todo.md`. Stop and wait for approval.
