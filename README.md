# Phased Software Engineering Execution

An orchestration skill that drives large engineering tasks through a strict multi-phase workflow with PRD-driven implementation, parallel execution, and progress tracking.

Built for **Claude Code** and **GitHub Copilot**.

Based on the [Ralph](https://github.com/snarktank/ralph) autonomous agent pattern.

---

## What it does

Takes a complex engineering task and executes it through four strict phases:

```
Phase 1: Planning        → plan.md + todo.md
Phase 2: Workspace Setup → isolated branches per phase
Phase 3: Implementation  → dependency analysis → prd.json per phase → Ralph agent loop
Phase 4: Merge           → merge_order.md → safe integration
```

Each phase requires explicit user approval before proceeding. Each implementation phase follows the Ralph pattern: one story at a time, atomic commits, quality checks, progress tracking, and pattern consolidation.

---

## Quick start

### Claude Code

```bash
# Clone into your project or add as a plugin
git clone https://github.com/<your-org>/orchestation-skills .claude/plugins/orchestation-skills

# Or copy the skill directly
cp -r orchestation-skills/.claude/skills/orchestrate .claude/skills/orchestrate

# Invoke
/phase refactor the auth module into separate concerns with full test coverage
```

### GitHub Copilot (VS Code / JetBrains)

```bash
# Copy the prompt file into your project
mkdir -p .github/prompts
cp orchestation-skills/.github/prompts/phase.prompt.md .github/prompts/

# Optionally copy the base instructions
cp orchestation-skills/.github/copilot-instructions.md .github/

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
  phase-a-types/         → branch: phase-a-types
  phase-b-api/           → branch: phase-b-api
  phase-c-ui/            → branch: phase-c-ui
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

## Managed files

| File | Location | Created in | Purpose |
|---|---|---|---|
| `plan.md` | repo root | Phase 1 | Execution plan, dependency map, risks |
| `todo.md` | repo root | Phase 1 | Task breakdown with checkboxes |
| `execution.md` | repo root | Phase 3b | Dependency graph, parallel groups, execution order |
| `prd.json` | each phase workspace | Phase 3b | Ralph-format user stories per phase |
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

## Key principles

**Plan before code** — Phase 1 always runs first unless explicitly skipped.

**Isolated workspaces** — each phase gets its own directory and branch. No cross-contamination.

**One story at a time** — the Ralph pattern ensures small, atomic, testable increments.

**Quality gates** — every commit must pass quality checks (typecheck, lint, tests).

**Progress tracking** — `prd.json` flags, `todo.md` checkboxes, and `progress.txt` learnings provide full visibility.

**Pattern propagation** — codebase patterns discovered in earlier phases are passed as context to later phases.

**Prompt repetition** — the task is restated before each phase and each story to ensure the model maintains full attention across long contexts.

---

## Error recovery

If quality checks fail after implementing a story, the Ralph loop:
1. Reads the error output
2. Attempts to fix the code (up to 3 tries)
3. If fixed, continues to commit
4. If stuck, records the blocker in `prd.json` notes and `progress.txt`, resets unstaged changes, and moves to the next story

No story is left in a broken state. Blocked stories are visible in `prd.json` and surfaced by the CLI (`orchestrate status`).

## Resuming after interruption

The workflow is fully resumable. If a session is interrupted mid-Phase 3:

1. Invoke `/phase` with the same task
2. Tell it to start from Phase 3c
3. Each phase's Ralph loop picks up from the first story where `passes: false`
4. `progress.txt` preserves all prior learnings

No special recovery steps needed.

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
.claude/
  skills/
    orchestrate/SKILL.md     ← /phase — main orchestration skill
    prd/SKILL.md              ← /prd — PRD generator
    ralph/SKILL.md            ← /ralph — PRD to prd.json converter
.claude-plugin/
  plugin.json                 ← installable as Claude Code plugin
.github/
  copilot-instructions.md    ← Copilot base instructions
  prompts/
    phase.prompt.md           ← /phase for Copilot
    prd.prompt.md             ← /prd for Copilot
    ralph.prompt.md           ← /ralph for Copilot
src/
  index.ts                    ← CLI (validate prd.json, report status)
  types.ts                    ← TypeScript types (Ralph prd.json format)
```

### How subagents work

Each phase workspace is a complete Ralph environment:

```
/tmp/myapp-phases/phase-a-types/
  ralph-loop.sh    ← Iteration loop (spawns fresh agents per story)
  CLAUDE.md        ← Agent instructions (one story per invocation)
  prd.json         ← User stories (state machine: passes true/false)
  progress.txt     ← Progress log + codebase patterns
  (repo files via git worktree)
```

The iteration model is identical to Ralph's `ralph.sh`:

```
ralph-loop.sh (bash loop)
  ├── Iteration 1: claude < CLAUDE.md → implements US-001 → exits
  ├── Iteration 2: claude < CLAUDE.md → implements US-002 → exits
  ├── Iteration 3: claude < CLAUDE.md → outputs PHASE_COMPLETE
  └── Loop exits successfully
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
claude plugin add /path/to/orchestation-skills

# Or clone and reference
git clone <repo-url> ~/.claude/plugins/orchestation-skills
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
──────────────────────────────────────────────────────────────
  Total: 7/13 stories passing
```

---

## Platform differences

| Capability | Claude Code | GitHub Copilot |
|---|---|---|
| Invoke | `/phase <task>` | `/phase <task>` |
| Parallel subagents | Native (Agent tool) | Manual (multiple sessions) |
| Task tracking | TaskCreate + file-based | File-based only |
| Workspaces | Full repo copy | git worktree preferred |
| Auto-trigger | Yes (description match) | No (manual invoke only) |

The workflow, Ralph pattern, managed files, and execution discipline are identical across both platforms.

---

## License

MIT
