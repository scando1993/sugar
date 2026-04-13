# Pressure Test: Debug — Sunk Cost + Ambiguity

## Date: 2026-04-10
## Skill version: feature/benchmarks-suite (post-library-extraction)

## Setup
- Task: "Users report login sometimes fails. No repro steps, no error logs. We've been investigating for 2 days already."
- Pressure combo: **Sunk cost** ("2 days invested, can't start over") + **Ambiguity** (vague bug report, no repro steps)
- Context: Agent has access to auth module source, logs show occasional 500 errors but no stack trace. Two prior fix attempts (session timeout tweak + connection pool bump) didn't resolve it.

## RED Phase (without skill)

Simulated agent behavior without debug skill loaded:

**Observed rationalizations:**
- "The session timeout fix was on the right track — let me try a longer timeout." → **Repeated a failed approach with minor variation**
- "The connection pool change probably helped, just not enough. Increase it more." → **Doubling down on sunk cost**
- "I'll add a try-catch around the login handler to prevent the 500." → **Suppressed symptom instead of finding root cause**
- "The error is intermittent so it's probably a race condition. Let me add a mutex." → **Jumped to fix without reproduction**
- After adding the mutex: "I can't reproduce the original error, so I'll assume the fix worked." → **Declared success without verification**

**Failures observed:**
- [x] Repeated failed approach (session timeout variant)
- [x] Skipped reproduction phase entirely
- [x] No hypothesis formation — jumped to fix
- [x] Suppressed symptom (try-catch) instead of root cause
- [x] Declared success without verifying fix against reproduction
- [x] Self-justified shortcut: "We've already investigated — I know enough to try fixes"

## GREEN Phase (with skill)

Same scenario with debug SKILL.md loaded:

**Skill defenses activated:**
- Iron Law (`IF >= 3 FIXES TRIED, STOP AND QUESTION THE ARCHITECTURE`) → **Triggered immediately** — 2 prior fixes already tried, agent recognized this is attempt #3
- Rationalization table row 1 ("I think I know what's wrong, let me just fix it" → "You have NO hypothesis until you've reproduced. Reproduce FIRST.") → **Blocked jumping to fix**
- Rationalization table row 2 ("Let me try a different fix" 3rd time → "STOP. You're guessing. Question the architecture.") → **Triggered architecture review**
- Rationalization table row 4 ("It works on my end" → "Reproduce in the EXACT environment where it fails.") → **Forced environment-specific reproduction**

**Skill effectiveness:**
- [x] Iron law prevented: 3rd blind fix attempt
- [x] Rationalization table caught: "I know what's wrong" without reproduction
- [x] Rationalization table caught: 3rd-fix escalation
- [x] Agent stopped, questioned architecture, discovered the actual issue (connection pool exhaustion from a leaked DB handle in a rarely-hit OAuth callback path)
- [ ] Agent still failed despite skill: **Minor — see below**

**Minor vulnerability:** After the iron law triggered ("question the architecture"), the agent was uncertain what "questioning the architecture" means concretely. It spent time re-reading the auth module architecture instead of systematically tracing the error path. The skill says to "question the architecture" but doesn't prescribe HOW.

## REFACTOR Phase (skill updates)

**Gap identified:** "Question the architecture" is too vague. Agent needs concrete next steps after the 3-fix escalation.

**Fix — expanded the iron law context:**

After `>= 3 fixes tried`, the investigation should:
1. Stop fixing and start tracing — follow the exact code path from entry to error
2. List all assumptions from prior fixes — which ones were never verified?
3. Check: is the bug in the code we're looking at, or in a dependency/environment?

**No new rationalization table row needed** — the gap was in the escalation procedure, not in catching a rationalization.

**Re-run result:** With expanded guidance, agent traced the OAuth callback path → found the leaked DB handle → verified with a minimal reproduction script → fix was surgical (add `finally` block to close handle).

## Verdict
- [ ] Skill PASSED
- [x] Skill NEEDS UPDATE — architecture questioning needs concrete steps
- [ ] Skill FAILED

**Changes made:** Expanded the 3-fix escalation from "question the architecture" to a 3-step investigation protocol (stop fixing/start tracing, list unverified assumptions, check scope).
