# Plan: Implement All Suggested Features from Superpowers Comparison

> **Status: historical, executed (see `comparison_superpowers.md`'s "Action Plan — Implementation
> Status" tables — all items A-I are marked DONE) and partially superseded.** The skills, iron
> laws, rationalization tables, dashboard, and pattern propagation described here were built and
> still exist largely as designed. What's superseded: steps that describe editing bash inside
> `ralph-loop.sh` (Steps B/H's snapshot-tag and failure-log logic, Step I's pattern injection call
> points) — that logic now lives in TypeScript (`src/lib/loop-runner.ts`, `src/lib/verifier.ts`,
> `src/lib/patterns.ts`) behind `sugar run`/`sugar generate`/`sugar propagate-patterns`, not
> inline in the generated shell script. Kept here as a historical record of the original
> step-by-step plan.

## Context

The competitive analysis (`comparison_superpowers.md`) identified 9 features (A-I) across 3 tiers to close gaps with obra/superpowers while maintaining our autonomous execution advantage. This plan covers all of them.

---

## Quick Wins (A, B, C) — Prompt Hardening

### Step A: Add rationalization tables to all skill templates

**Files to modify (6):**
- `.claude/skills/orchestrate/SKILL.md` — add to CLAUDE.md template section
- `.github/agents/sugar.md` — same, Copilot syntax
- `.github/prompts/sugar.prompt.md` — same, Copilot prompt syntax
- `.claude/skills/ralph/SKILL.md` — add to conversion rules
- `.github/agents/ralph.md` — same
- `.github/prompts/ralph.prompt.md` — same

**What to add to the CLAUDE.md template (inside orchestrate skill):**

After the "Rules" section, insert:

```markdown
## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll just implement two quick stories in one iteration" | ONE story per iteration. The loop handles iteration. No exceptions. |
| "The tests mostly pass, I'll commit and fix later" | ALL commits must pass quality checks. Broken commits poison every future iteration. |
| "This dependency isn't really needed, I'll skip it" | The dependency graph exists for a reason. Never start dependent work before prerequisites complete. |
| "I know what changed, I don't need to read progress.txt" | Progress.txt IS your memory. You have NO context without it. Read it FIRST. |
| "This is a trivial change, I don't need to run checks" | Every commit gets checked. No exceptions. The one you skip is the one that breaks everything. |
| "I'll refactor this while I'm here" | Stay in scope. Implement the story. Nothing more. |
```

**What to add to ralph converter skills:**

```markdown
## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "This story is small enough to combine with the next one" | If it has its own acceptance criteria, it's its own story. |
| "I don't need Typecheck passes for this one" | EVERY story includes "Typecheck passes". No exceptions. |
| "This description is obvious, no need for detail" | An agent with ZERO context will read this. Be explicit. |
```

---

### Step B: Add two-stage review to CLAUDE.md template

**Files to modify (3):**
- `.claude/skills/orchestrate/SKILL.md` — CLAUDE.md template
- `.github/agents/sugar.md` — CLAUDE.md template
- `.github/prompts/sugar.prompt.md` — CLAUDE.md template

**Replace** the current single-step "Run quality checks" instruction (step 7 in CLAUDE.md template) with:

```markdown
## Quality Protocol (per story)
1. Implement the story
2. Self-review: Does implementation match ALL acceptance criteria? Check EACH one.
3. Run quality checks (typecheck + lint + tests)
4. If checks pass: verify against prd.json criteria ONE MORE TIME
5. Only THEN commit
6. If anything fails at steps 2-4: fix, do NOT skip
```

---

### Step C: Add iron laws to CLAUDE.md template

**Files to modify (3):** same as Step B

**Add at the very top** of the CLAUDE.md template, before "Your Task":

```markdown
## Iron Laws
- `ONE STORY PER ITERATION — IMPLEMENT ONE, THEN STOP`
- `NEVER COMMIT CODE THAT FAILS QUALITY CHECKS`
- `READ PROGRESS.TXT BEFORE WRITING A SINGLE LINE`
```

---

## Medium Effort (D, E, F) — New Skills

### Step D: Create debugging skill

**Files to create (3):**
- `.claude/skills/debug/SKILL.md` — Claude Code skill
- `.github/agents/debug.md` — Copilot agent
- `.github/prompts/debug.prompt.md` — Copilot prompt

**SKILL.md content structure:**

```markdown
---
name: debug
description: "Systematic debugging with hypothesis-driven investigation..."
user-invocable: true
---

# Systematic Debugging

## Iron Law
`IF >= 3 FIXES TRIED, STOP AND QUESTION THE ARCHITECTURE`

## Phases
1. **Reproduce** — confirm the bug, get exact error, write a failing test if possible
2. **Hypothesize** — form 3 hypotheses, rank by likelihood, explain reasoning
3. **Investigate** — pick ONE technique:
   - Binary search: narrow the problem space by halving
   - Trace: follow the execution path from input to failure
   - Instrument: add logging/assertions at key points
4. **Fix** — minimal targeted change, explain what it fixes and why
5. **Verify** — original reproduction case passes
6. **Regression** — run full test suite, no new failures

## Red Flags

| Thought | Reality |
|---|---|
| "I think I know what's wrong, let me just fix it" | You have NO hypothesis until you've reproduced. Reproduce FIRST. |
| "Let me try a different fix" (3rd time) | STOP. You're guessing. Question the architecture. |
| "The fix is too big to test incrementally" | Break it down. Every fix is testable. |
| "It works on my end" | Reproduce in the EXACT environment where it fails. |

## Rules
- NEVER skip reproduction
- NEVER apply more than 3 fixes without stepping back
- ALWAYS verify the fix doesn't introduce regressions
- Document what you tried and what you learned in progress.txt
```

**Copilot agent** (`.github/agents/debug.md`): same content, adapted with `tools: ["read", "edit", "search", "terminal", "test-runner"]` and `[user's bug description]` syntax.

**Copilot prompt** (`.github/prompts/debug.prompt.md`): same content, adapted with `${input}` syntax and Copilot tool names.

---

### Step E: Create code review skill

**Files to create (3):**
- `.claude/skills/review/SKILL.md` — Claude Code skill
- `.github/agents/review.md` — Copilot agent
- `.github/prompts/review.prompt.md` — Copilot prompt

**SKILL.md content structure:**

```markdown
---
name: review
description: "Code review with anti-trust adversarial verification..."
user-invocable: true
---

# Code Review

## Iron Law
`DO NOT TRUST THE IMPLEMENTER'S REPORT — VERIFY EVERY CLAIM AGAINST THE ACTUAL DIFF`

## Process
1. Read the PR diff or branch diff: `git diff main...HEAD`
2. Read any linked issue or story description
3. For EACH changed file:
   - Does the change match the stated intent?
   - Any security issues? (injection, XSS, hardcoded secrets)
   - Any performance concerns? (N+1 queries, unbounded loops)
   - Type safety maintained?
   - Error handling adequate?
   - Tests cover the changes?
4. Run quality checks: typecheck + lint + tests
5. Summarize findings with severity (critical/warning/nit)
6. If critical issues: block the merge

## Anti-Trust Protocol
- The implementer's commit messages may be optimistic. Verify every claim against the actual diff.
- "Refactored for clarity" — did it actually get clearer, or just different?
- "Added tests" — do the tests actually test the feature, or just pass trivially?
- "Fixed bug" — is the root cause addressed, or just the symptom?

## Anti-Sycophancy
- Do NOT say "Great work!" or "Looks good!" unless you have verified everything
- Do NOT approve because the code looks reasonable at a glance
- Technical verification BEFORE any positive feedback

## Red Flags

| Thought | Reality |
|---|---|
| "The author is experienced, this is probably fine" | Experience doesn't prevent bugs. Review the code. |
| "This is a small change, quick approval" | Small changes cause big bugs. Check it. |
| "Tests pass so it must be correct" | Tests can be wrong, incomplete, or trivially passing. |
```

---

### Step F: Create TDD skill

**Files to create (3):**
- `.claude/skills/tdd/SKILL.md` — Claude Code skill
- `.github/agents/tdd.md` — Copilot agent
- `.github/prompts/tdd.prompt.md` — Copilot prompt

**SKILL.md content structure:**

```markdown
---
name: tdd
description: "Test-driven development with strict RED-GREEN-REFACTOR enforcement..."
user-invocable: true
---

# Test-Driven Development

## Iron Law
`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`

## Cycle
1. **RED** — Write a failing test that defines the expected behavior
   - The test MUST fail before you write production code
   - If it passes without changes, your test is wrong
2. **GREEN** — Write the MINIMUM production code to make the test pass
   - Do NOT write more than necessary
   - Do NOT optimize
   - Do NOT refactor
3. **REFACTOR** — Clean up without changing behavior
   - All tests still pass after refactoring
   - Improve naming, extract functions, remove duplication
   - If any test fails, your refactor changed behavior — revert

## Red Flags

| Thought | Reality |
|---|---|
| "I'll write the implementation first, then add tests" | That's not TDD. Write the test FIRST. |
| "This is too simple to test" | If it's too simple to test, it's simple enough to test quickly. |
| "I'll write all the tests first, then implement" | One test at a time. RED-GREEN-REFACTOR. One cycle. |
| "The test is basically the same as the implementation" | Then you're testing implementation, not behavior. Rewrite the test. |

## Rules
- ONE test at a time, ONE cycle at a time
- NEVER skip RED — if the test doesn't fail first, it proves nothing
- NEVER skip REFACTOR — clean code is part of the deliverable
- Commit after each GREEN (passing test + minimal implementation)
```

---

## Strategic Moves (G, H, I)

### Step G: Real-time progress dashboard

**Files to create:**
- `docs/dashboard/index.html` — single-file dashboard (HTML + CSS + JS)

**Implementation:**
- Single HTML file with embedded CSS/JS (zero dependencies, same pattern as `docs/flowchart.html`)
- Accepts a base path via URL param: `?path=/tmp/myapp-phases`
- Reads `prd.json` files via a small local file-server script OR designed to be served from the worktree
- Alternative: a CLI command `orchestrate dashboard` that generates a static HTML report from current prd.json files and opens it in the browser

**Recommended approach — CLI report generator:**
- Add `dashboard` command to `src/index.ts`
- `orchestrate dashboard <base-path>` scans all prd.json files, generates a self-contained HTML file with:
  - Phase cards showing progress bars
  - Story-level detail: status, acceptance criteria, notes
  - Dependency graph visualization (if execution.md exists)
  - Blocked/failed stories highlighted
  - Timestamp of generation
- Opens the generated HTML in the default browser
- This avoids needing a running server while still providing rich visualization

**Files to modify:**
- `src/index.ts` — add `dashboard` command
- `src/types.ts` — no changes needed (reuses existing types)

---

### Step H: Rollback/recovery in the loop

**Files to modify (3):**
- `.claude/skills/orchestrate/SKILL.md` — ralph-loop.sh template + CLAUDE.md template
- `.github/agents/sugar.md` — same
- `.github/prompts/sugar.prompt.md` — same

**Changes to ralph-loop.sh template:**

Before each implementation attempt, create a snapshot tag:
```bash
STORY_ID=$(... extract from prd.json ...)
git tag "attempt-${STORY_ID}-v${ATTEMPT_NUM}" 2>/dev/null
```

On 3rd failure, enhance the current `git checkout -- .` with:
```bash
# Record structured failure report
FAILURE_REPORT=$(cat <<EOF
{
  "storyId": "$STORY_ID",
  "attempt": $ATTEMPT_NUM,
  "filesModified": $(git diff --name-only | jq -R . | jq -s .),
  "failureType": "$(echo $OUTPUT | grep -oE 'typecheck|lint|test|timeout' | head -1)",
  "lastError": "$(echo $OUTPUT | tail -5)"
}
EOF
)
echo "$FAILURE_REPORT" >> "$SCRIPT_DIR/failure_log.json"
```

**Changes to CLAUDE.md template:**

Add instruction: "Before implementing a story, check `failure_log.json`. If this story has previous failures, read the failure report and try a DIFFERENT approach. Do NOT repeat the same strategy."

---

### Step I: Pattern propagation as first-class feature

**Files to modify (3):**
- `.claude/skills/orchestrate/SKILL.md` — Phase 3b and Phase 3c sections
- `.github/agents/sugar.md` — same
- `.github/prompts/sugar.prompt.md` — same

**Add patterns.json schema to Phase 3b generation:**

```json
{
  "patterns": [
    {
      "id": "P1",
      "learned_in": "phase-a",
      "description": "Use server actions instead of API routes for mutations",
      "applies_to": ["phase-b", "phase-c"],
      "confidence": "high"
    }
  ]
}
```

**Update Phase 3c "Between groups" instructions:**

Current: "Collect Codebase Patterns from completed workspaces' progress.txt"

Replace with:
1. Parse `progress.txt` from completed workspaces
2. Extract patterns into `patterns.json` at repo root
3. For each next-group workspace, inject relevant patterns (matching `applies_to`) into the workspace's `CLAUDE.md`
4. The CLAUDE.md template gains a "## Known Patterns" section that is populated from `patterns.json`

**Add `patterns.json` to managed files table:**
`patterns.json | repo root | Phase 3c (between groups)`

---

## Execution Order

```
Steps A + B + C (prompt hardening — quick, independent edits to existing templates)
  ↓
Steps D + E + F (new skills — fully independent, can be done in parallel)
  ↓
Step H (rollback/recovery — modifies ralph-loop.sh template)
  ↓
Step I (pattern propagation — modifies Phase 3b/3c sections)
  ↓
Step G (dashboard — new CLI command, independent of templates)
```

A/B/C must go first because D/E/F new skills should follow the same prompt hardening patterns.
H and I modify the same template files so they should be sequential.
G is fully independent and can be done at any point.

---

## Files Summary

### Modified (existing)

| File | Steps |
|---|---|
| `.claude/skills/orchestrate/SKILL.md` | A, B, C, H, I |
| `.github/agents/sugar.md` | A, B, C, H, I |
| `.github/prompts/sugar.prompt.md` | A, B, C, H, I |
| `.claude/skills/ralph/SKILL.md` | A |
| `.github/agents/ralph.md` | A |
| `.github/prompts/ralph.prompt.md` | A |
| `src/index.ts` | G |

### Created (new)

| File | Step |
|---|---|
| `.claude/skills/debug/SKILL.md` | D |
| `.github/agents/debug.md` | D |
| `.github/prompts/debug.prompt.md` | D |
| `.claude/skills/review/SKILL.md` | E |
| `.github/agents/review.md` | E |
| `.github/prompts/review.prompt.md` | E |
| `.claude/skills/tdd/SKILL.md` | F |
| `.github/agents/tdd.md` | F |
| `.github/prompts/tdd.prompt.md` | F |

---

## Verification

| Step | How to verify |
|---|---|
| A | Read-through: rationalization tables present in all 6 skill files |
| B | Read-through: CLAUDE.md template has 6-step Quality Protocol |
| C | Read-through: CLAUDE.md template starts with 3 Iron Laws |
| D | `npx tsc --noEmit`; read-through: debug skill has 6 phases + 3-fix rule |
| E | `npx tsc --noEmit`; read-through: review skill has anti-trust + anti-sycophancy |
| F | `npx tsc --noEmit`; read-through: TDD skill has RED-GREEN-REFACTOR + red flags |
| G | `node dist/index.js dashboard /tmp/test-phases` generates HTML and opens browser |
| H | Read-through: ralph-loop.sh creates snapshot tags, writes failure_log.json |
| I | Read-through: Phase 3c instructions reference patterns.json, CLAUDE.md template has Known Patterns section |
