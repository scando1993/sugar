---
name: phase
description: Phased software engineering execution for large refactors, migrations, feature work, testing efforts, and modularization. Executes through strict planning → workspace setup → dependency analysis → PRD-driven parallel implementation → merge phases. Each subagent runs in an isolated Ralph workspace (CLAUDE.md + prd.json + progress.txt) and executes the Ralph agent loop autonomously. Use when a task needs isolated workspaces, atomic commits, parallel branches, and controlled merge sequencing.
argument-hint: "<engineering task description>"
allowed-tools: Agent, TaskCreate, TaskUpdate, TaskList, TaskGet, Bash, Read, Write, Edit, Glob, Grep
---

# Phased Software Engineering Execution

## Task
$ARGUMENTS

---

## Reference

Subagent execution follows the **[Ralph](https://github.com/snarktank/ralph)** pattern. Each phase workspace is a self-contained Ralph environment: `CLAUDE.md` (agent instructions), `prd.json` (story state machine), `progress.txt` (learning persistence). Subagents are autonomous — they read their workspace instructions and execute independently.

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

```bash
mkdir -p /tmp/<repo-name>-phases
# For each phase:
git worktree add /tmp/<repo-name>-phases/<phase-name> -b <branch-name>
```

In each workspace, initialize:

**`progress.txt`:**
```
# Phase Progress Log
Started: [timestamp]
---
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

#### Create `execution.md` at repo root

1. **Dependency graph** — ASCII visualization
2. **Parallel execution groups** — Group 1 (no deps), Group 2 (after Group 1), etc.
3. **Execution order** — numbered groups with satisfied dependencies noted
4. **Critical path** — bottleneck analysis
5. **Risk assessment** — conflict likelihood, shared files
6. **Rationale** — why this order is safest

#### Generate `prd.json` in each workspace

Use the `/ralph` skill approach: convert each phase's tasks from `todo.md` into right-sized user stories.

```json
{
  "project": "[repo name]",
  "branchName": "[phase branch]",
  "description": "[phase scope]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[title]",
      "description": "As a developer, I need [what] so that [why]",
      "acceptanceCriteria": ["Criterion", "Typecheck passes"],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

**Story rules:** completable in one pass, ordered by dependency (schema → backend → UI), verifiable criteria, always include "Typecheck passes".

#### Generate `CLAUDE.md` in each workspace

Write a `CLAUDE.md` file in each phase workspace root. This is the Ralph agent instructions that the subagent will follow autonomously.

**Template for each workspace CLAUDE.md:**

Each iteration handles **ONE story** — just like Ralph. The `ralph-loop.sh` script (below) handles spawning fresh instances.

```markdown
## Iron Laws
- `ONE STORY PER ITERATION — IMPLEMENT ONE, THEN STOP`
- `NEVER COMMIT CODE THAT FAILS QUALITY CHECKS`
- `READ PROGRESS.TXT BEFORE WRITING A SINGLE LINE`

# Ralph Agent — [Phase Name]

You are an autonomous coding agent. You handle ONE user story per invocation.

## Your Task

1. Read `prd.json` in this directory
2. Read `progress.txt` — check the Codebase Patterns section first
3. Verify you are on branch `[branch-name]`. If not: `git checkout [branch-name]`
4. **Legacy mode:** Pick the **highest priority** user story where `passes: false`
   **Consensus mode:** Pick the **highest priority** user story where `status` is `"pending"` or `"rejected"`
   - If picking a `"rejected"` story: read `rejection_log.txt` first to understand what failed
   - After picking, set the story's `status` to `"implementing"` in prd.json
5. If no stories remain unfinished (legacy: `passes: false`; consensus: no `pending` or `rejected`) → reply with: PHASE_COMPLETE
6. Implement that single user story
7. **Quality Protocol (per story):**
   1. Implement the story
   2. Self-review: Does implementation match ALL acceptance criteria? Check EACH one.
   3. Run quality checks (typecheck + lint + tests)
   4. If checks pass: verify against prd.json criteria ONE MORE TIME
   5. Only THEN commit
   6. If anything fails at steps 2-4: fix, do NOT skip
8. **Legacy:** If checks pass → commit ALL changes: `feat: [Story ID] - [Story Title]`
   **Consensus:** Output: `STORY_IMPLEMENTED:[Story ID]` — the loop handles the verifier quorum and commit
9. If checks fail → fix and retry (up to 3 attempts). If stuck:
   - Set the story's `notes` field in prd.json to describe the blocker
   - Append failure to progress.txt
   - `git checkout -- .` to reset unstaged changes
## Model Escalation
If you cannot complete a story after 3 attempts, output: STORY_FAILED
This signals the loop to escalate to a more capable model on the next iteration.
Do NOT output STORY_FAILED if you haven't genuinely attempted 3 times.
10. **Legacy:** Update `prd.json` to set `passes: true` for the completed story
    **Consensus:** The loop updates `status` to `"passed"` or `"rejected"` after the quorum vote
11. Append progress to `progress.txt` (format below)
12. When ALL stories have `passes: true` → push: `git push origin [branch-name]`

## Stop Condition

After completing a story, check if ALL stories have `passes: true`.
If yes, push and reply with exactly: PHASE_COMPLETE
If no, end your response normally — the loop script will spawn a fresh iteration.

## Progress Report Format

APPEND to progress.txt (never replace):

## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context for other phases
---

## Codebase Patterns

If you discover a reusable pattern, add it to the `## Codebase Patterns`
section at the TOP of progress.txt. Only general, reusable patterns.

## Rules
- ONE story per iteration — implement one, then stop
- ALL commits must pass quality checks
- Do NOT commit broken code
- Follow existing code patterns
- Keep changes focused to this phase's scope

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll just implement two quick stories in one iteration" | ONE story per iteration. The loop handles iteration. No exceptions. |
| "The tests mostly pass, I'll commit and fix later" | ALL commits must pass quality checks. Broken commits poison every future iteration. |
| "This dependency isn't really needed, I'll skip it" | The dependency graph exists for a reason. Never start dependent work before prerequisites complete. |
| "I know what changed, I don't need to read progress.txt" | Progress.txt IS your memory. You have NO context without it. Read it FIRST. |
| "This is a trivial change, I don't need to run checks" | Every commit gets checked. No exceptions. The one you skip is the one that breaks everything. |
| "I'll refactor this while I'm here" | Stay in scope. Implement the story. Nothing more. |

## Context
- Original task: [full $ARGUMENTS]
- Phase scope: [scope from plan.md]
- Workspace: [absolute path]
- Branch: [branch-name]
- Dependencies satisfied: [list what prior phases produced, or "none — first parallel group"]
- Patterns from prior phases: [codebase patterns from completed phases, or "none yet"]

## Task (repeated)
Read prd.json. Pick highest priority story where passes is false. Implement ONE story.
Quality checks. Commit. Mark passes true. Append progress. Stop. The loop handles iteration.
```

#### Generate `ralph-loop.sh` in each workspace

This is the iteration engine — equivalent to Ralph's `ralph.sh`. It spawns fresh agent instances in a loop, one story per iteration, until all stories pass or max iterations is reached.

```bash
#!/bin/bash
# Ralph loop for phase: [phase-name]
# Usage: ./ralph-loop.sh [max_iterations] [default_model]
set -e

MAX_ITERATIONS=${1:-20}
DEFAULT_MODEL="${2:-sonnet}"
ESCALATION_MODEL="opus"
CURRENT_MODEL="$DEFAULT_MODEL"
CONSECUTIVE_FAILURES=0
ESCALATION_THRESHOLD=2
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"

echo "Starting Ralph loop — Phase: [phase-name]"
echo "Max iterations: $MAX_ITERATIONS"
echo "Default model: $DEFAULT_MODEL | Escalation model: $ESCALATION_MODEL"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "========================================"
  echo "  Iteration $i of $MAX_ITERATIONS"
  echo "========================================"

  # Detect consensus mode
  if grep -q '"consensus"' "$PRD_FILE"; then
    CONSENSUS_MODE=1
  else
    CONSENSUS_MODE=0
  fi

  if [ "$CONSENSUS_MODE" -eq 0 ]; then
    # Legacy path: model-tiered loop
    OUTPUT=$(claude --model "$CURRENT_MODEL" --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true
  else
    # Consensus path: IMPLEMENT → VERIFY (quorum) → TALLY → commit or reject
    OUTPUT=$(claude --model "$CURRENT_MODEL" --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true

    if echo "$OUTPUT" | grep -q "STORY_IMPLEMENTED"; then
      STORY_ID=$(echo "$OUTPUT" | grep -oE 'STORY_IMPLEMENTED:[A-Z]+-[0-9]+' | cut -d: -f2 | head -1)
      echo "Story $STORY_ID implemented — running verifier quorum..."

      VOTE_DIR=$(mktemp -d)
      QUORUM_SIZE=$(python3 -c "import json; d=json.load(open('$PRD_FILE')); print(d['consensus']['quorumSize'])" 2>/dev/null || echo "3")
      for v in $(seq 1 "$QUORUM_SIZE"); do
        VOTE=$(claude --model "$CURRENT_MODEL" --dangerously-skip-permissions --print < "$SCRIPT_DIR/VERIFY.md" 2>&1) || true
        echo "$VOTE" > "$VOTE_DIR/vote_$v.txt"
      done

      PASS_COUNT=$(grep -l "VOTE:PASS" "$VOTE_DIR"/*.txt 2>/dev/null | wc -l | tr -d ' ')
      FAIL_COUNT=$(grep -l "VOTE:FAIL" "$VOTE_DIR"/*.txt 2>/dev/null | wc -l | tr -d ' ')
      echo "Tally: $PASS_COUNT PASS, $FAIL_COUNT FAIL"

      if [ "$PASS_COUNT" -gt "$FAIL_COUNT" ]; then
        echo "Consensus: PASS — committing story $STORY_ID"
        git add -A && git commit -m "feat: $STORY_ID - verified by consensus ($PASS_COUNT/$QUORUM_SIZE)"
        python3 -c "
import json
with open('$PRD_FILE') as f: d = json.load(f)
for s in d['userStories']:
    if s.get('id') == '$STORY_ID':
        s['status'] = 'passed'
        break
with open('$PRD_FILE', 'w') as f: json.dump(d, f, indent=2)
"
      else
        FAIL_REASON=\$(grep -h "VOTE:FAIL" "$VOTE_DIR"/*.txt | head -1)
        echo "Consensus: FAIL — rejecting story $STORY_ID: \$FAIL_REASON"
        echo "[\$(date)] REJECTED $STORY_ID: \$FAIL_REASON" >> "\$SCRIPT_DIR/rejection_log.txt"
        git checkout -- .
        python3 -c "
import json
with open('$PRD_FILE') as f: d = json.load(f)
for s in d['userStories']:
    if s.get('id') == '$STORY_ID':
        s['status'] = 'rejected'
        break
with open('$PRD_FILE', 'w') as f: json.dump(d, f, indent=2)
"
      fi
      rm -rf "\$VOTE_DIR"
    fi
  fi

  if echo "$OUTPUT" | grep -q "PHASE_COMPLETE"; then
    echo ""
    echo "Phase [phase-name] complete at iteration $i!"
    exit 0
  fi

  # Check if story failed — escalate model if needed
  if echo "$OUTPUT" | grep -qiE "STORY_FAILED|stuck|blocked|retry.?exhausted"; then
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    echo "Failure detected ($CONSECUTIVE_FAILURES consecutive)"
    if [ "$CONSECUTIVE_FAILURES" -ge "$ESCALATION_THRESHOLD" ] && [ "$CURRENT_MODEL" != "$ESCALATION_MODEL" ]; then
      echo ">>> Escalating from $CURRENT_MODEL to $ESCALATION_MODEL"
      CURRENT_MODEL="$ESCALATION_MODEL"
    fi
  else
    if [ "$CURRENT_MODEL" != "$DEFAULT_MODEL" ]; then
      echo ">>> De-escalating back to $DEFAULT_MODEL"
    fi
    CURRENT_MODEL="$DEFAULT_MODEL"
    CONSECUTIVE_FAILURES=0
  fi

  echo "[$(date)] Iteration $i — model: $CURRENT_MODEL — result: $(echo "$OUTPUT" | grep -oE '(STORY_IMPLEMENTED|STORY_FAILED|PHASE_COMPLETE)' | head -1)" >> "$SCRIPT_DIR/progress.txt"
  echo "Iteration $i done. Continuing..."
  sleep 2
done

echo ""
echo "Reached max iterations ($MAX_ITERATIONS) without completing all stories."
echo "Check prd.json and progress.txt for status."
exit 1
```

Make it executable: `chmod +x ralph-loop.sh`

#### Rules
- Every workspace must have four files: `prd.json`, `progress.txt`, `CLAUDE.md`, `ralph-loop.sh`
- Do not proceed to 3c until all workspaces are fully set up
- Validate each `prd.json` is valid JSON with right-sized stories

#### Generate `VERIFY.md` in each workspace (consensus mode only)

Only generate this file when `prd.json` contains a `consensus` config.

**Template for each workspace VERIFY.md:**

```markdown
# Verifier Agent — [Phase Name]

## Iron Law
`DO NOT TRUST THE IMPLEMENTER — VERIFY EVERY CLAIM AGAINST THE ACTUAL CODE`

## Your Task

1. Read `prd.json` — find the story with `status: "verifying"` or the story ID passed to you
2. Read the story's acceptance criteria
3. Read the actual code diff: `git diff HEAD~1 HEAD`
4. For EACH acceptance criterion, verify it against the actual diff
5. Output your vote

## Vote Format

If ALL criteria are met:
```
VOTE:PASS
```

If ANY criterion is NOT met:
```
VOTE:FAIL:{criterion}:{reason}
```

Example: `VOTE:FAIL:Typecheck passes:TypeScript error in src/types.ts line 42`

## Red Flags

| Thought | Reality |
|---|---|
| "The implementation looks reasonable, VOTE:PASS" | You must verify EACH criterion against the actual diff, not the description. |
| "The commit message says it's done, good enough" | Commit messages lie. Read the diff. |
| "One criterion is marginal but close enough" | Close is not passing. Either it meets the criterion or it doesn't. |

## Rules
- Verify EACH acceptance criterion independently
- VOTE:FAIL if even one criterion is not met
- Include the specific criterion and reason in every VOTE:FAIL
- Do NOT be lenient — the implementer will get to try again
```

---

### Phase 3c — Parallel execution via ralph-loop.sh

#### Goal
Launch the Ralph iteration loop for each phase in parallel. Each `ralph-loop.sh` spawns fresh agent instances — one story per iteration, fresh context each time — just like Ralph's `ralph.sh`.

#### How iteration works

```
ralph-loop.sh (the loop — runs in bash)
  ├── Iteration 1: claude < CLAUDE.md → implements US-001 → exits
  ├── Iteration 2: claude < CLAUDE.md → implements US-002 → exits
  ├── Iteration 3: claude < CLAUDE.md → implements US-003 → outputs PHASE_COMPLETE
  └── Loop exits successfully
```

Each iteration is a **fresh agent instance with clean context**. Memory persists between iterations via:
- `prd.json` — which stories are done (`passes: true/false`)
- `progress.txt` — learnings and codebase patterns
- git history — all committed code

This is identical to how Ralph works. The agent never runs out of context because it handles only ONE story per invocation.

#### Resuming after interruption
Inherently resumable — re-run `ralph-loop.sh`. It spawns fresh iterations that pick up from the first `passes: false` story.

#### Execution

Follow `execution.md` group ordering.

**For each parallel group** (independent phases), launch all `ralph-loop.sh` scripts simultaneously:

```bash
# Launch all independent phases in parallel
/tmp/<repo>-phases/phase-a/ralph-loop.sh 20 &
PID_A=$!
/tmp/<repo>-phases/phase-b/ralph-loop.sh 20 &
PID_B=$!
/tmp/<repo>-phases/phase-c/ralph-loop.sh 20 &
PID_C=$!

# Wait for all to complete
wait $PID_A $PID_B $PID_C

# Check results
echo "Phase A exit: $?"
echo "Phase B exit: $?"
echo "Phase C exit: $?"
```

Use the Bash tool to execute this. Each `ralph-loop.sh` runs independently, spawning fresh `claude` instances per story.

**For sequential groups** (depend on prior group):
Wait for the prior group to complete. Before launching the next group:
1. Collect Codebase Patterns from all completed workspaces' `progress.txt`
2. Update the next group's `CLAUDE.md` files with those patterns
3. Update `execution.md` with actual results
4. Launch the next group's `ralph-loop.sh` scripts in parallel

#### Completion tracking
- Phase complete when `ralph-loop.sh` exits 0 (all stories `passes: true`)
- After each group, sync results back to `todo.md` checkboxes
- Record any deviations in `execution.md`
- If a loop exits non-zero (max iterations), check `prd.json` for blocked stories

#### Rules
- Never launch a dependent phase before prerequisites are confirmed complete
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

Create `merge_order.md` at repo root:
- merge order aligned with dependency graph (foundations first)
- rationale for ordering
- expected conflict areas
- conflict resolution notes
- validation steps after each merge
- post-merge sanity checklist

**Manual merge:** stop after creating `merge_order.md`.

**Automatic merge:**
- Merge in documented order
- Resolve conflicts using best engineering judgment
- Update `merge_order.md` with actual conflict notes
- Validate after each merge

### Post-merge validation

After all merges, run full validation:
1. Complete test suite
2. Typecheck, lint, quality checks
3. If any fail, document which merge caused it in `merge_order.md`
4. Fix before declaring Phase 4 complete

Phase 4 is **not complete** until the final merged result passes all checks.

---

## Abort and cleanup

```bash
git worktree list
git worktree remove /tmp/<repo>-phases/<phase> --force
git branch -D <branch>
git worktree prune
```

Repo-root tracking files preserved. Phase-local files deleted with worktree.

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
| `VERIFY.md` | each worktree | Phase 3b (consensus only) |
| `merge_order.md` | repo root | Phase 4 |

---

**The first deliverable is always Phase 1 planning only**, unless the user explicitly states that a later phase is already approved.

**Restate**: Given the task `$ARGUMENTS` — start with Phase 1. Produce `plan.md` and `todo.md`. Stop and wait for approval.
