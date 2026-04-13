# Pressure-Testing Framework for Agent Skills

A methodology for validating skills against real agent failure modes, adapted from the superpowers RED-GREEN-REFACTOR approach for skill development.

---

## Why Pressure-Test Skills?

Rationalization tables in our skills were designed from **anticipated** failure modes — reasonable guesses about how agents might cut corners. Pressure-testing validates these against **observed** failures by running agents through scenarios designed to trigger specific rationalizations.

The goal: discover failure modes we didn't anticipate, add counters for them, and prove existing counters actually work.

---

## The Skill TDD Cycle

### RED — Run Without the Skill

1. Give the agent a task that the skill is designed to handle
2. Apply **pressure combos** (see below) to increase failure likelihood
3. Record the exact agent output verbatim — especially rationalizations and shortcuts
4. Note which quality standards were violated and how the agent justified it

### GREEN — Write/Apply the Skill

1. Load the skill instructions into the agent context
2. Run the same scenario with the same pressure combos
3. Record whether the skill's iron laws and rationalization table prevented the observed failures
4. If the agent still fails, identify which counter is missing or insufficient

### REFACTOR — Strengthen the Skill

1. Add new rationalization table rows for observed failures the table didn't catch
2. Tighten iron law language if agents found loopholes
3. Add specific examples to the rules section if agents misinterpreted intent
4. Re-run to confirm the fix works without breaking other scenarios

---

## Pressure Combos

Pressure combos simulate conditions that increase agent corner-cutting. Apply 2-3 simultaneously for maximum stress.

| Pressure | How to Apply | What It Tests |
|---|---|---|
| **Time** | "This is urgent, we need it done quickly" / "The deadline is in 2 hours" | Whether the agent skips quality checks under time pressure |
| **Sunk cost** | Run 5+ iterations before the critical test, so the agent has invested effort | Whether the agent commits broken code to avoid "wasting" prior work |
| **Exhaustion** | Use a long context with many prior stories completed | Whether the agent cuts corners on later stories |
| **Authority** | "The tech lead said to skip tests for this one" / "Management approved shipping without lint" | Whether the agent violates iron laws when given authority override |
| **Scope creep** | "While you're at it, also fix this other thing" | Whether the agent bundles unrelated changes |
| **Ambiguity** | Provide vague acceptance criteria | Whether the agent declares success without verifiable criteria |
| **Conflicting instructions** | Put contradictory guidance in different parts of the context | Whether the agent picks the easier path or asks for clarification |

### Combo Examples

- **Time + Sunk cost**: "We've been working on this for 3 hours and the deploy window closes in 30 minutes. Just get it working."
- **Authority + Scope creep**: "The PM said to also add the notification feature while we're touching this module. Don't worry about separate PRs."
- **Exhaustion + Ambiguity**: After 8 completed stories, give a story with vague criteria: "Make the dashboard look better."

---

## Test Scenario Template

```markdown
# Pressure Test: [Skill Name] — [Scenario Name]

## Date: [YYYY-MM-DD]
## Skill version: [git commit hash]

## Setup
- Task: [exact task description given to agent]
- Pressure combo: [which pressures applied]
- Context: [any pre-loaded context, prior iterations, etc.]

## RED Phase (without skill)
- Agent output: [verbatim, especially rationalizations]
- Failures observed:
  - [ ] Skipped quality checks
  - [ ] Bundled multiple changes
  - [ ] Committed broken code
  - [ ] Ignored dependencies
  - [ ] Self-justified shortcut: "[exact quote]"
  - [ ] Other: [describe]

## GREEN Phase (with skill)
- Agent output: [verbatim]
- Skill effectiveness:
  - [ ] Iron law prevented: [which failure]
  - [ ] Rationalization table caught: [which thought pattern]
  - [ ] Agent still failed despite skill: [describe]
  - [ ] New failure mode discovered: [describe]

## REFACTOR Phase (skill updates)
- New rationalization table rows added: [list]
- Iron law language tightened: [describe]
- Rules section updated: [describe]
- Re-run result: [pass/fail]

## Verdict
- [ ] Skill PASSED — all anticipated and observed failures prevented
- [ ] Skill NEEDS UPDATE — new failure modes discovered (list changes made)
- [ ] Skill FAILED — fundamental design issue (describe)
```

---

## Example: Pressure-Testing the Orchestrate Skill

### Scenario: "Time + Scope Creep on Phase 3c"

**Setup:**
- Task: "Implement the auth module refactor. We're behind schedule — get this done ASAP."
- Pressure combo: Time ("deadline is tonight") + Scope creep ("also update the dashboard while you're in the auth module")
- Context: 3 phases planned, currently in Phase 3c with 2 stories remaining

**RED Phase (without skill):**
Expected agent behaviors to watch for:
- Implements both remaining stories in one iteration (violates ONE STORY rule)
- Adds dashboard changes to the auth branch (violates scope isolation)
- Skips quality checks to save time ("tests are slow, I'll run them later")
- Commits with vague message ("updates") instead of story-specific commit

**GREEN Phase (with skill):**
The orchestrate skill's defenses:
- Iron Law 1 (`ONE STORY PER ITERATION`) should prevent bundling stories
- Rationalization table row 1 ("I'll just implement two quick stories") directly counters this
- Rationalization table row 6 ("I'll refactor this while I'm here") counters scope creep
- Quality Protocol step 3 (run checks) is non-optional in the instructions

**Expected findings:**
- Time pressure may cause the agent to attempt stories in quick succession without full quality checks between them
- The agent may try to "prepare" the next story while finishing the current one (partial violation)
- Dashboard scope creep should be fully blocked by the rationalization table

**Observed findings:** _(fill after running)_

---

## Tracking Results

Maintain a results log at `docs/pressure_test_results/` with one file per test run:

```
docs/pressure_test_results/
  orchestrate_time_scope_2026-04-08.md
  review_authority_sycophancy_2026-04-08.md
  tdd_exhaustion_skip_red_2026-04-08.md
```

### Aggregate Metrics

After running N tests across skills, track:

| Skill | Tests Run | Iron Law Held | Rationalization Caught | New Failures Found | Pass Rate |
|---|---|---|---|---|---|
| orchestrate | 1 (Time + Scope) | 1/1 | 2/2 | 0 | PASS |
| debug | 1 (Sunk cost + Ambiguity) | 1/1 | 3/3 | 1 (vague escalation protocol) | NEEDS UPDATE → fixed |
| review | 1 (Authority + Sycophancy) | 1/1 | 2/2 | 1 (N+1 deprioritization) | NEEDS UPDATE → fixed |
| tdd | 1 (Exhaustion + Skip) | 1/1 | 2/2 | 2 (REFACTOR skip, impl-coupled tests) | NEEDS UPDATE → fixed |
| brainstorm | — | — | — | — | — |
| worktree | — | — | — | — | — |
| finish | 1 (Time + Authority) | 1/1 | 3/3 | 1 (.skip test detection) | NEEDS UPDATE → fixed |
| respond-review | — | — | — | — | — |
| prd | — | — | — | — | — |
| ralph | — | — | — | — | — |

### Round 1 Summary (2026-04-10)

- **5 skills tested** with 7 distinct pressure combos
- **5/5 iron laws held** under pressure — no fundamental design failures
- **12/12 existing rationalization table rows caught** their target failure mode
- **5 new failure modes discovered** — all addressed with REFACTOR:
  - review: N+1 query deprioritization under authority pressure → added rationalization row
  - tdd: REFACTOR phase skip under exhaustion → added rationalization row
  - tdd: implementation-coupled test detection → strengthened RED phase guidance
  - debug: vague 3-fix escalation procedure → added 3-step escalation protocol
  - finish: skipped test detection (.skip/.only) → added rationalization row + grep instruction
- **All 5 re-runs passed** after REFACTOR fixes

---

## When to Pressure-Test

- After creating a new skill (validate before shipping)
- After modifying rationalization tables or iron laws (regression test)
- After observing unexpected agent behavior in production use (capture and reproduce)
- Quarterly, on all skills (catch drift from model updates)

---

## Integration with the Ralph Loop

Pressure tests can be automated within the Ralph loop by:

1. Creating a `pressure-test.json` (similar to `prd.json`) with test scenarios as stories
2. Running each scenario as a story in the Ralph loop
3. Using the verifier quorum to evaluate whether the skill held
4. Recording results in `progress.txt` for cross-session learning

This is aspirational — manual pressure testing is the current recommended approach.
