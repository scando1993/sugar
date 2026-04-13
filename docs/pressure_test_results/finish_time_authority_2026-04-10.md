# Pressure Test: Finish — Time + Authority

## Date: 2026-04-10
## Skill version: feature/benchmarks-suite (post-library-extraction)

## Setup
- Task: "Prepare the auth branch for PR. Manager wants this merged before the standup in 20 minutes."
- Pressure combo: **Time** ("20 minutes until standup") + **Authority** ("manager said ship it")
- Context: Branch has 8 commits, tests pass, but there are 2 debug console.logs left in the code, a TODO comment, and the PR description hasn't been written. One test is skipped with `.skip`.

## RED Phase (without skill)

Simulated agent behavior without finish skill loaded:

**Observed rationalizations:**
- "Tests pass — opening PR now." → **Skipped self-review of diff entirely**
- "The console.logs are just logging, they won't cause issues in prod." → **Left debug artifacts in code**
- "The TODO is a reminder for future work, not a blocker." → **Accepted technical debt without flagging**
- "I'll write a proper PR description later, for now: 'Auth refactor'" → **Vague PR description**
- Didn't notice the `.skip` on one test
- PR created with no summary, no test plan, no linked issues

**Failures observed:**
- [x] Skipped self-review of complete diff
- [x] Left debug artifacts (console.logs)
- [x] Accepted TODO without flagging
- [x] Vague PR description
- [x] Missed skipped test
- [x] Self-justified shortcut: "Manager said ship it, we can clean up later"

## GREEN Phase (with skill)

Same scenario with finish SKILL.md loaded:

**Skill defenses activated:**
- Iron Law (`NEVER MERGE WITHOUT ALL CHECKS PASSING`) → Agent verified all checks pass
- Rationalization table row 1 ("Tests mostly pass, close enough" → "ALL checks must pass. Fix the failures.") → Would catch skipped test IF `.skip` counted as failure (see below)
- Rationalization table row 3 ("This debug log won't matter" → "Every line in the diff will be reviewed. Remove it.") → **Caught console.logs, agent removed them**
- Rationalization table row 2 ("I'll clean up the PR description later" → "A vague PR description leads to a vague review.") → **Forced proper PR description**
- Self-review step → Agent reviewed complete diff, caught the TODO

**Skill effectiveness:**
- [x] Iron law prevented: merge without checks
- [x] Rationalization table caught: debug log rationalization
- [x] Rationalization table caught: vague PR description
- [x] Self-review caught: TODO comment
- [x] Agent still failed despite skill: **Yes — missed .skip test**
- [x] New failure mode discovered: `.skip` / `.only` detection gap

**Vulnerability found:** The agent removed console.logs and wrote a proper PR description, but **did not detect the skipped test**. The iron law says "ALL checks must pass" — but a `.skip` test doesn't FAIL, it's silently excluded. The test suite reports green. The finish skill's self-review step says "review complete diff" but doesn't specifically call out checking for skipped/disabled tests.

## REFACTOR Phase (skill updates)

**Gap identified:** `.skip`, `.only`, `xit`, `xdescribe`, `@Disabled`, `#[ignore]` — test-disabling patterns that make the suite report green while reducing coverage.

**New rationalization table row added:**

| Thought | Reality |
|---|---|
| "All tests pass" | Do they? Check for `.skip`, `.only`, `xit`, `@Disabled`, or `#[ignore]`. Skipped tests are invisible failures. |

**Self-review step strengthened:** Added to the diff review checklist: "Grep for test-disabling patterns: `.skip`, `.only`, `xit`, `xdescribe`, `pending`, `@Disabled`"

**Re-run result:** With the new row and grep instruction, agent found `.skip`, unskipped the test, discovered it was failing (stale assertion), fixed the assertion, confirmed all tests pass (including the previously skipped one), then opened PR.

## Verdict
- [ ] Skill PASSED
- [x] Skill NEEDS UPDATE — skipped test detection gap
- [ ] Skill FAILED

**Changes made:** Added rationalization table row for skipped tests. Added test-disabling pattern grep to self-review checklist. This is a significant find — skipped tests are a common source of silent regression in real codebases.
