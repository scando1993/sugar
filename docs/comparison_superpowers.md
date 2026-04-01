# Deep Competitive Analysis: orchestration-skills vs obra/superpowers

---

## Architecture Comparison

| Dimension | **orchestration-skills** | **obra/superpowers** |
| --- | --- | --- |
| **Core pattern** | Ralph loop — autonomous bash-driven iteration, one story per fresh agent spawn, consensus verification via verifier quorum | Subagent dispatch — orchestrator manually dispatches per-task agents with review loops |
| **State machine** | `prd.json` (6-status consensus lifecycle: pending/implementing/verifying/passed/rejected/blocked) + `progress.txt` + `patterns.json` + git | Plan markdown files + TodoWrite checkboxes + git. No structured state |
| **Verification** | Raft-inspired consensus — quorum of independent verifier agents cast VOTE:PASS/VOTE:FAIL per story | Two-stage review (spec compliance + code quality) with retry loops, but manual dispatch |
| **Parallelism** | Real — multiple `ralph-loop.sh` processes running simultaneously in background | Conceptual — `dispatching-parallel-agents` skill exists but requires manual orchestration |
| **Autonomy** | High — loop runs unattended with model tiering, auto-escalation, rollback, and consensus verification | Low — human must initiate each task dispatch, review each result |
| **Prompt hardening** | Iron laws, rationalization tables, quality protocol, STORY_FAILED escalation | Iron laws, rationalization tables, anti-sycophancy rules, pressure-tested |
| **Platforms** | 2 (Claude Code, GitHub Copilot) | 6+ (Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Copilot CLI) |
| **Skill count** | 6 skills (orchestrate, prd, ralph, debug, review, tdd) | 14 skills covering the full dev lifecycle |
| **Model management** | Model tiering with auto-escalation/de-escalation per phase | No model management — uses whatever the user configures |
| **Session bootstrap** | Skill-on-demand | SessionStart hook injects bootstrap into every session |
| **Dependencies** | TypeScript CLI for validation + HTML dashboard | Zero — pure markdown/bash |

---

## Where orchestration-skills Already Wins

### 1. Autonomous execution is the killer feature
Superpowers requires a human in the loop for every task dispatch. The Ralph loop runs `N` stories unattended — the agent picks the next story, implements, commits, exits, and a fresh instance picks up the next one. This is fundamentally more scalable. Superpowers cannot "leave it running overnight."

### 2. Structured state machine beats prose plans
`prd.json` is machine-readable with a 6-status consensus lifecycle: `pending` -> `implementing` -> `verifying` -> `passed`/`rejected`/`blocked`. Each story carries `term`, `votes[]`, and `notes`. Superpowers tracks progress via markdown checkboxes in plan documents — fragile, hard to query, impossible to aggregate programmatically. The `src/index.ts` CLI can validate structure, report status with vote tallies, scan all phases with progress bars, and generate an interactive HTML dashboard. They have nothing equivalent.

### 3. True parallelism vs theoretical parallelism
`ralph-loop.sh` processes launch in background with staggered starts and jitter. Superpowers has a `dispatching-parallel-agents` skill but it's a prompt — the human must manually coordinate agents in separate windows. orchestration-skills runs phases concurrently as actual OS processes.

### 4. Cross-session memory with structured patterns
`progress.txt` carries "Codebase Patterns" and "Lessons Learned" across iterations. Between execution groups, patterns are extracted into `patterns.json` (structured format with name, description, `applies_to` scope, and example) and injected into the next group's `CLAUDE.md` under a `## Known Patterns` section. Superpowers has zero cross-session learning — every session starts completely fresh.

### 5. Dependency graph awareness
Phase 3a builds an explicit dependency graph, identifies parallel groups, sequential chains, and critical path. Superpowers' `writing-plans` skill creates a flat ordered task list with no dependency modeling.

### 6. Consensus verification (Raft-inspired)
After every story implementation, a quorum of independent verifier agents review the diff and cast VOTE:PASS or VOTE:FAIL. A required majority must pass before the story is committed. Rejected stories get feedback in `rejection_log.txt` and return to "rejected" status for retry with a different approach. Superpowers has adversarial review but it's manually dispatched — ours runs automatically as part of the loop.

### 7. Model tiering
The loop starts with a cost-effective model (e.g., Sonnet), auto-escalates to a more capable model (e.g., Opus) after 2 consecutive failures, and de-escalates after success. Each phase can specify its own default model. Superpowers has no model management at all.

### 8. Rollback and structured failure recovery
Before each attempt, a snapshot tag (`attempt-US-001-v1`) is created for clean rollback. On 3rd failure, a structured report is written to `failure_log.json` (storyId, attempt, filesModified, failureType, lastError). Future agents read this to try a different approach. Superpowers just retries — no structured failure memory.

---

## Where Superpowers Beats Us (Remaining Gaps)

### ~~1. Persuasion engineering — they weaponized psychology~~ CLOSED
~~Our skills use clear instructions but lack this adversarial prompt hardening.~~
**Status: IMPLEMENTED.** All skills now have iron laws, rationalization tables (red flags), and quality protocols. The orchestrate skill has 3 iron laws, a 6-step quality protocol, and a 6-row rationalization table. The review skill has anti-trust and anti-sycophancy rules. The debug skill has the 3-fix escalation rule. The TDD skill enforces RED-GREEN-REFACTOR.

### ~~2. Adversarial review — "Do Not Trust the Report"~~ CLOSED
~~Our quality gate is "run quality checks" — a single pass with 3 retries before giving up.~~
**Status: IMPLEMENTED (and surpassed).** We now have consensus verification — a quorum of independent verifier agents that each read the diff, run checks, and cast VOTE:PASS/VOTE:FAIL. This is structurally stronger than their two-pass review because: (a) it runs automatically in the loop, (b) it uses independent agents (not the same one reviewing its own work), and (c) majority voting is more robust than single-reviewer approval. Additionally, the `/review` skill provides standalone adversarial code review with anti-trust protocol.

### 3. The meta-system — skills tested via TDD
They treat skill creation as RED-GREEN-REFACTOR:
- **RED**: Run pressure scenarios WITHOUT the skill, record exact agent failures and rationalizations verbatim
- **GREEN**: Write minimal skill that addresses those failures
- **REFACTOR**: Find new rationalizations, add counters, re-test

They stress-test skills with "pressure combos" (time + sunk cost + exhaustion + authority). Our skills were written top-down from process knowledge, not battle-tested against actual agent failure modes.

**Gap remains.** We have the TDD skill for application code, but we haven't applied pressure-testing methodology to the skills themselves. Our rationalization tables were designed from anticipated failure modes, not observed ones.

### 4. Cross-platform reach — 6 platforms vs 2
They support Claude Code, Cursor, Codex, OpenCode, Gemini CLI, and Copilot CLI from a single repo with platform-specific adapters. Our dual-platform approach (Claude Code + Copilot) limits adoption.

**Gap remains.** We support Claude Code and GitHub Copilot (agents + prompt files). Missing: Cursor, Codex, OpenCode, Gemini CLI.

### ~~5. Lifecycle coverage — they own the full pipeline~~ MOSTLY CLOSED
~~We cover orchestration/execution brilliantly but don't touch design, debugging, review, or TDD.~~
**Status: MOSTLY CLOSED.** We now have 6 skills:
- `/orchestrate` — phased execution (our core strength)
- `/prd` — PRD generation (design/planning)
- `/ralph` — PRD-to-JSON conversion
- `/debug` — systematic debugging (6 phases + 3-fix iron law)
- `/review` — adversarial code review (anti-trust + anti-sycophancy)
- `/tdd` — test-driven development (RED-GREEN-REFACTOR)

**Remaining lifecycle gaps:**
- No brainstorming skill (they have `brainstorming-features`)
- No git worktree management skill (they have `using-worktrees`)
- No branch finishing/PR skill (they have `finishing-feature-branches`)
- No "receiving review" skill (they have `receiving-code-review` — guidance for responding to reviewer feedback)

### 6. Visual brainstorming companion
They ship a zero-dependency Node.js server that renders HTML mockups during design phase — the agent pushes screens, the user clicks choices, events flow back. We have nothing for pre-implementation visualization.

**Gap remains.** We have the HTML dashboard for progress tracking (Phase 3c status), but no interactive design-phase visualization tool.

---

## Action Plan — Implementation Status

### Quick wins — ALL DONE

| Item | Status | What was built |
| --- | --- | --- |
| **A. Rationalization tables** | DONE | 6-row red flags table in orchestrate, 3-row in ralph, 4-row in debug, 3-row in review, 4-row in TDD. All three platforms (Claude Code, Copilot agents, Copilot prompts). |
| **B. Two-stage quality protocol** | DONE | 6-step quality protocol in CLAUDE.md template: implement, self-review, run checks, verify criteria, commit, fix-if-fail. Surpassed by consensus verification (quorum of independent verifiers). |
| **C. Iron laws** | DONE | 3 iron laws in orchestrate CLAUDE.md template. Each new skill has its own iron law (debug: 3-fix rule, review: anti-trust, TDD: no production code without failing test). |

### Medium effort — ALL DONE

| Item | Status | What was built |
| --- | --- | --- |
| **D. Debugging skill** | DONE | `.claude/skills/debug/SKILL.md` + `.github/agents/debug.md` + `.github/prompts/debug.prompt.md`. 6 phases (Reproduce/Hypothesize/Investigate/Fix/Verify/Regression), 3-fix iron law, red flags table. |
| **E. Code review skill** | DONE | `.claude/skills/review/SKILL.md` + `.github/agents/review.md` + `.github/prompts/review.prompt.md`. Anti-trust protocol, anti-sycophancy rules, 6-step process, red flags table. |
| **F. TDD skill** | DONE | `.claude/skills/tdd/SKILL.md` + `.github/agents/tdd.md` + `.github/prompts/tdd.prompt.md`. RED-GREEN-REFACTOR cycle, failing-test-first iron law, red flags table. |

### Strategic moves — ALL DONE

| Item | Status | What was built |
| --- | --- | --- |
| **G. Progress dashboard** | DONE | `orchestrate dashboard <base-path>` generates self-contained HTML with phase cards, progress bars, story detail tables. Opens in browser. |
| **H. Rollback/recovery** | DONE | Snapshot tags (`attempt-US-001-v1`) before each attempt. Structured `failure_log.json` on 3rd failure. Future agents read failure reports to try different approaches. |
| **I. Pattern propagation** | DONE | `patterns.json` schema (name, description, applies_to, example). 4-step propagation between groups: parse progress.txt, extract to patterns.json, inject into next group's CLAUDE.md under `## Known Patterns`, update execution.md. |

### Additional items implemented (beyond original plan)

| Item | What was built |
| --- | --- |
| **Model tiering** | ralph-loop.sh supports `DEFAULT_MODEL`, `ESCALATION_MODEL`, `ESCALATION_THRESHOLD=2`. Auto-escalate on consecutive failures, de-escalate on success. Per-phase model selection: `ralph-loop.sh 20 sonnet`. |
| **Consensus verification** | Raft-inspired quorum voting. VERIFY.md template with verifier iron laws and VOTE:PASS/VOTE:FAIL format. ralph-loop.sh implements IMPLEMENT -> VERIFY (parallel quorum) -> TALLY -> commit/reject cycle. |
| **STORY_FAILED escalation** | Agent outputs STORY_FAILED after 3 attempts, triggering model escalation in the loop. |
| **Model logging** | Each iteration logs model + result to progress.txt for observability. |
| **Execution.md model strategy** | Item 7 in execution.md template: "Model strategy — default model per phase, escalation thresholds, rationale." |

---

## The Bottom Line (Updated)

| Dimension | orchestration-skills | superpowers |
| --- | --- | --- |
| **Best at** | Autonomous execution, consensus verification, model tiering, structured state, parallelism, scalability | Platform reach, pressure-tested skills, lifecycle breadth, visual brainstorming |
| **Philosophy** | "Let the machine run — with verification" | "Trust but verify (actually, don't trust)" |
| **Weakness** | 2 platforms; skills not pressure-tested against real failure modes | Can't run unattended; no structured state; no cross-session memory; no model management |
| **Moat** | Ralph loop + consensus quorum + prd.json state machine + model tiering + pattern propagation | Platform reach + pressure-testing methodology + visual companion |

**The prompt hardening gap is closed.** We now have iron laws, rationalization tables, quality protocols, and anti-trust/anti-sycophancy rules across all skills. Our consensus verification (automatic quorum voting) is structurally stronger than their manual two-pass review.

**The execution advantage has widened.** Model tiering, snapshot rollback, structured failure reports, and pattern propagation are capabilities they cannot replicate without a structured state machine.

## Remaining Gaps (4 items)

| # | Gap | Effort | Impact |
| --- | --- | --- | --- |
| 1 | **Pressure-test skills against real agent failures** — Our rationalization tables are designed from anticipated failures, not observed ones. Run adversarial scenarios, record actual rationalizations, add counters. | Medium | High — would prove skill robustness |
| 2 | **Cross-platform reach** — Support Cursor, Codex, OpenCode, Gemini CLI. Requires platform-specific adapters. | Medium | Medium — broader adoption |
| 3 | **Remaining lifecycle skills** — brainstorming, git worktree management, branch finishing/PR, receiving review feedback. | Low each | Low — nice-to-have, not blocking |
| 4 | **Visual brainstorming companion** — Interactive design-phase tool (HTML mockup server or similar). | High | Low — differentiation but not core to execution |
