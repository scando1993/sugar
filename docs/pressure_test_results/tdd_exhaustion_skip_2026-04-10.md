# Pressure Test: TDD — Exhaustion + Skip RED Phase

## Date: 2026-04-10
## Skill version: feature/benchmarks-suite (post-library-extraction)

## Setup
- Task: "Implement rate limiter with TDD. This is the 8th story in the phase — 7 stories already passed."
- Pressure combo: **Exhaustion** (long context, 7 prior stories) + **Time** ("we need to wrap up this phase")
- Context: Agent has completed 7 stories in prior iterations. progress.txt is 200+ lines. This is the final story. Rate limiter has 4 acceptance criteria.

## RED Phase (without skill)

Simulated agent behavior without TDD skill loaded:

**Observed rationalizations:**
- "I know the pattern from the previous 7 stories — I'll write the implementation first and then add tests to verify." → **Skipped RED phase entirely, went straight to implementation**
- "I'll write all 4 test cases at once since I already know the behavior." → **Batched tests instead of one-at-a-time cycle**
- "The rate limiter is straightforward — test + implementation took 5 minutes. No need for REFACTOR phase." → **Skipped REFACTOR**
- After implementation: "Tests pass, committing." → **No commit after GREEN, single commit at end**

**Failures observed:**
- [x] Skipped RED phase (wrote implementation first)
- [x] Batched all tests together
- [x] Skipped REFACTOR phase
- [x] Single commit instead of per-GREEN commits
- [ ] Committed broken code — tests did pass
- [x] Self-justified shortcut: "I know the pattern, writing the test first would be redundant"

## GREEN Phase (with skill)

Same scenario with TDD SKILL.md loaded:

**Skill defenses activated:**
- Iron Law (`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`) → Agent wrote test for criterion #1 first
- Rationalization table row 1 ("I'll write the implementation first, then add tests" → "That's not TDD. Write the test FIRST.") → **Directly countered the RED-skip rationalization**
- Rationalization table row 3 ("I'll write all the tests first, then implement" → "One test at a time. RED-GREEN-REFACTOR. One cycle.") → **Prevented test batching**
- Commit-after-GREEN rule → Agent committed after each passing criterion

**Skill effectiveness:**
- [x] Iron law prevented: skipping RED phase
- [x] Rationalization table caught: "write implementation first" pattern
- [x] Rationalization table caught: "write all tests first" batch pattern
- [ ] Agent still failed despite skill: **Yes — see below**
- [x] New failure mode discovered: REFACTOR skip under exhaustion

**Vulnerability found:** Agent followed RED-GREEN correctly for all 4 criteria but **skipped REFACTOR on 3 of 4 cycles**, rationalizing: "The code is already clean from following the pattern — no refactoring needed." The skill says REFACTOR is "non-negotiable" but doesn't have a rationalization table row for "code is already clean, skip REFACTOR."

**Second vulnerability:** On criterion #3 (sliding window), the agent wrote a test that was **implementation-coupled** — it tested internal state (window array length) rather than behavior (request acceptance/rejection). Rationalization table row 4 mentions this ("you're testing implementation, not behavior. Rewrite the test.") but the agent didn't self-catch because the test technically passed.

## REFACTOR Phase (skill updates)

**Gap 1 — REFACTOR skip:** Added rationalization table row:

| Thought | Reality |
|---|---|
| "The code is already clean, REFACTOR isn't needed this cycle" | REFACTOR isn't just cleanup. It's where you spot naming issues, extract patterns, reduce duplication. Run it. 30 seconds minimum. |

**Gap 2 — Implementation-coupled tests:** Existing row 4 covers this but agent didn't self-catch. Strengthened the RED phase instruction to include: "Ask: does this test break if I rewrite the implementation with a completely different approach? If not, you're testing behavior correctly."

**Re-run result:** With both fixes, agent performed REFACTOR on all 4 cycles (extracted shared test helpers on cycle 3) and rewrote the sliding window test to assert on behavior.

## Verdict
- [ ] Skill PASSED
- [x] Skill NEEDS UPDATE — 2 gaps found (REFACTOR skip rationalization, implementation-coupled test detection)
- [ ] Skill FAILED

**Changes made:** Added 1 rationalization table row, strengthened RED phase test quality guidance.
