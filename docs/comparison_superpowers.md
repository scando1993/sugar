# Deep Competitive Analysis: orchestration-skills vs obra/superpowers

---

## Architecture Comparison

| Dimension | **orchestration-skills** | **obra/superpowers** |
|---|---|---|
| **Core pattern** | Ralph loop — autonomous bash-driven iteration, one story per fresh agent spawn | Subagent dispatch — orchestrator manually dispatches per-task agents with review loops |
| **State machine** | `prd.json` (structured JSON) + `progress.txt` (learning persistence) + git | Plan markdown files + TodoWrite checkboxes + git. No structured state |
| **Parallelism** | Real — multiple `ralph-loop.sh` processes running simultaneously in background | Conceptual — `dispatching-parallel-agents` skill exists but requires manual orchestration |
| **Autonomy** | High — loop runs unattended until PHASE_COMPLETE or max iterations | Low — human must initiate each task dispatch, review each result |
| **Platforms** | 2 (Claude Code, GitHub Copilot) | 6+ (Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Copilot CLI) |
| **Skill count** | 3 focused skills (orchestrate, prd, ralph) | 14 skills covering the full dev lifecycle |
| **Session bootstrap** | Skill-on-demand | SessionStart hook injects bootstrap into every session |
| **Dependencies** | TypeScript CLI for validation | Zero — pure markdown/bash |

---

## Where orchestration-skills Already Wins

### 1. Autonomous execution is the killer feature
Superpowers requires a human in the loop for every task dispatch. The Ralph loop runs `N` stories unattended — the agent picks the next story, implements, commits, exits, and a fresh instance picks up the next one. This is fundamentally more scalable. Superpowers cannot "leave it running overnight."

### 2. Structured state machine beats prose plans
`prd.json` is machine-readable: `{ "stories": [{ "id": "US-001", "passes": false, "notes": "" }] }`. Superpowers tracks progress via markdown checkboxes in plan documents — fragile, hard to query, impossible to aggregate programmatically. The `src/index.ts` CLI can validate structure and report status across all phases with progress bars. They have nothing equivalent.

### 3. True parallelism vs theoretical parallelism
`ralph-loop.sh` processes launch in background with staggered starts and jitter. Superpowers has a `dispatching-parallel-agents` skill but it's a prompt — the human must manually coordinate agents in separate windows. orchestration-skills runs phases concurrently as actual OS processes.

### 4. Cross-session memory
`progress.txt` carries "Codebase Patterns" and "Lessons Learned" across iterations. When Group B starts after Group A finishes, Group A's patterns are injected into Group B's `CLAUDE.md`. Superpowers has zero cross-session learning — every session starts completely fresh.

### 5. Dependency graph awareness
Phase 3a builds an explicit dependency graph, identifies parallel groups, sequential chains, and critical path. Superpowers' `writing-plans` skill creates a flat ordered task list with no dependency modeling.

---

## Where Superpowers Beats Us (Gaps to Close)

### 1. Persuasion engineering — they weaponized psychology
Superpowers invested heavily in research-backed techniques (Cialdini 2021, Meincke et al. 2025 study of 28,000 LLM conversations). Their finding: persuasion techniques doubled compliance from 33% to 72%. They use:
- **Iron Laws** in monospace: `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`
- **Rationalization tables** that pre-counter every excuse the agent might generate
- **Anti-sycophancy** rules that ban "Great point!" and "You're absolutely right!"
- **Red Flags** tables mapping thought patterns to reality

Our skills use clear instructions but lack this adversarial prompt hardening. Agents will find loopholes in our prompts that superpowers has already anticipated and blocked.

### 2. Adversarial review — "Do Not Trust the Report"
Their spec reviewer is explicitly told: *"The implementer finished suspiciously quickly. Their report may be incomplete, inaccurate, or optimistic. You MUST verify everything independently."* They run TWO independent reviews per task (spec compliance + code quality), each with retry loops. Our quality gate is "run quality checks" — a single pass with 3 retries before giving up.

### 3. The meta-system — skills tested via TDD
They treat skill creation as RED-GREEN-REFACTOR:
- **RED**: Run pressure scenarios WITHOUT the skill, record exact agent failures and rationalizations verbatim
- **GREEN**: Write minimal skill that addresses those failures
- **REFACTOR**: Find new rationalizations, add counters, re-test

They stress-test skills with "pressure combos" (time + sunk cost + exhaustion + authority). Our skills were written top-down from process knowledge, not battle-tested against actual agent failure modes.

### 4. Cross-platform reach — 6 platforms vs 2
They support Claude Code, Cursor, Codex, OpenCode, Gemini CLI, and Copilot CLI from a single repo with platform-specific adapters. Our dual-platform approach (Claude Code + Copilot) limits adoption.

### 5. Lifecycle coverage — they own the full pipeline
They have dedicated skills for: brainstorming, planning, TDD, debugging, code review (requesting + receiving), git worktrees, verification, and branch finishing. We cover orchestration/execution brilliantly but don't touch design, debugging, review, or TDD.

### 6. Visual brainstorming companion
They ship a zero-dependency Node.js server that renders HTML mockups during design phase — the agent pushes screens, the user clicks choices, events flow back. We have nothing for pre-implementation visualization.

---

## How to Beat It — Action Plan

### Quick wins (high impact, low effort)

#### A. Add rationalization tables to skills
In `SKILL.md` and `phase.md`, add explicit counters:

```markdown
## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll just implement two quick stories in one iteration" | ONE story per iteration. The loop handles iteration. No exceptions. |
| "The tests mostly pass, I'll commit and fix later" | ALL commits must pass quality checks. Broken commits poison every future iteration. |
| "This dependency isn't really needed, I'll skip it" | The dependency graph exists for a reason. Never start dependent work before prerequisites complete. |
| "I know what changed, I don't need to read progress.txt" | Progress.txt IS your memory. You have NO context without it. Read it FIRST. |
```

#### B. Add two-stage review to the Ralph agent template
Update the `CLAUDE.md` template in Phase 3b:

```markdown
## Quality Protocol (per story)
1. Implement the story
2. Self-review: Does implementation match ALL acceptance criteria?
3. Run quality checks (typecheck + lint + tests)
4. If checks pass: verify against prd.json criteria ONE MORE TIME
5. Only THEN commit
6. If anything fails at steps 2-4: fix, do NOT skip
```

#### C. Add prompt reinforcement with iron laws
At the top of the Ralph agent template, add:

```markdown
## Iron Laws
- `ONE STORY PER ITERATION — IMPLEMENT ONE, THEN STOP`
- `NEVER COMMIT CODE THAT FAILS QUALITY CHECKS`
- `READ PROGRESS.TXT BEFORE WRITING A SINGLE LINE`
```

### Medium effort (close the gap)

#### D. Add a debugging skill
Create `.claude/skills/debug/SKILL.md` with systematic debugging phases:
1. Reproduce — confirm the bug exists, get exact error
2. Hypothesize — form 3 hypotheses, rank by likelihood
3. Investigate — binary search / trace / instrument (pick one)
4. Fix — minimal targeted change
5. Verify — original reproduction case passes
6. Regression — no new failures

Add the 3-fix escalation rule: "If >= 3 fixes tried, STOP and question the architecture."

#### E. Add a code review skill
Create `.claude/skills/review/SKILL.md` that dispatches a reviewer agent for PRs or branches. Include the anti-trust pattern: "The implementer's commit messages may be optimistic. Verify every claim against the actual diff."

#### F. Add TDD enforcement as an optional mode
Create `.claude/skills/tdd/SKILL.md` with the RED-GREEN-REFACTOR cycle. Make it opt-in (user says "use TDD" or sets a flag in `prd.json` stories).

### Strategic moves (differentiate further)

#### G. Build a real-time progress dashboard
`prd.json` is already structured data. Build a web UI that:
- Shows all phases, all stories, pass/fail status live
- Auto-refreshes by polling `prd.json` files
- Shows the dependency graph with completed nodes highlighted
- Shows estimated time remaining based on iteration speed

Superpowers has nothing like this. They can't build it because they have no structured state.

#### H. Add rollback/recovery to the loop
When a story fails 3 times, the loop currently just logs notes and does `git checkout -- .`. Enhance this:
- Auto-create a branch snapshot before attempting: `git tag attempt-US-001-v1`
- On 3rd failure: record which files were touched, what was tried, save a structured failure report to `prd.json`
- Next iteration's agent reads this and tries a different approach (not the same one 3x)

#### I. Add pattern propagation as a first-class feature
Pattern copying between groups already exists. Formalize this:
- Define a `patterns.json` schema: `{ "patterns": [{ "id": "P1", "learned_in": "phase-a", "description": "...", "applies_to": ["phase-b", "phase-c"] }] }`
- Auto-inject relevant patterns into each phase's `CLAUDE.md` based on `applies_to`
- This becomes a competitive moat — the more you use the system, the smarter it gets

---

## The Bottom Line

| | orchestration-skills | superpowers |
|---|---|---|
| **Best at** | Autonomous execution, parallelism, structured state, scalability | Prompt hardening, review rigor, lifecycle coverage, platform reach |
| **Philosophy** | "Let the machine run" | "Trust but verify (actually, don't trust)" |
| **Weakness** | Trusts the agent too much; limited lifecycle coverage | Can't run unattended; no structured state; no cross-session memory |
| **Moat** | Ralph loop + prd.json state machine | Persuasion engineering + adversarial review |

**The structural advantage is real** — autonomous loops + structured state + true parallelism is architecturally superior to "human dispatches one agent at a time." But superpowers has spent serious effort on making agents actually follow instructions reliably. The combination of both approaches would be devastating.

**The fastest path to dominance: keep the execution engine, steal their prompt hardening.** Add rationalization tables, iron laws, and two-stage adversarial review to the Ralph agent template. That closes the reliability gap while maintaining the autonomy advantage.
