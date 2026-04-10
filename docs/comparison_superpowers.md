# Deep Competitive Analysis: sugar vs obra/superpowers

---

## Architecture Comparison

| Dimension | **sugar** | **obra/superpowers** |
| --- | --- | --- |
| **Core pattern** | Ralph loop — autonomous bash-driven iteration, one story per fresh agent spawn, consensus verification via verifier quorum | Subagent dispatch — orchestrator manually dispatches per-task agents with review loops |
| **State machine** | `prd.json` (6-status consensus lifecycle: pending/implementing/verifying/passed/rejected/blocked) + `progress.txt` + `patterns.json` + git | Plan markdown files + TodoWrite checkboxes + git. No structured state |
| **Verification** | Raft-inspired consensus — quorum of independent verifier agents cast VOTE:PASS/VOTE:FAIL per story | Two-stage review (spec compliance + code quality) with retry loops, but manual dispatch |
| **Parallelism** | Real — multiple `ralph-loop.sh` processes running simultaneously in background | Conceptual — `dispatching-parallel-agents` skill exists but requires manual orchestration |
| **Autonomy** | High — loop runs unattended with model tiering, auto-escalation, rollback, and consensus verification | Low — human must initiate each task dispatch, review each result |
| **Prompt hardening** | Iron laws, rationalization tables, quality protocol, STORY_FAILED escalation | Iron laws, rationalization tables, anti-sycophancy rules, pressure-tested |
| **Platforms** | 6 (Claude Code, GitHub Copilot, Cursor, Codex, OpenCode, Gemini CLI) | 6+ (Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Copilot CLI) |
| **Skill count** | 10 skills (orchestrate, prd, ralph, debug, review, tdd, brainstorm, worktree, finish, respond-review) | 14 skills covering the full dev lifecycle |
| **Model management** | Model tiering with auto-escalation/de-escalation per phase | No model management — uses whatever the user configures |
| **Session bootstrap** | Skill-on-demand | SessionStart hook injects bootstrap into every session |
| **Dependencies** | TypeScript CLI for validation + HTML dashboard | Zero — pure markdown/bash |

---

## Where sugar Already Wins

### 1. Autonomous execution is the killer feature
Superpowers requires a human in the loop for every task dispatch. The Ralph loop runs `N` stories unattended — the agent picks the next story, implements, commits, exits, and a fresh instance picks up the next one. This is fundamentally more scalable. Superpowers cannot "leave it running overnight."

### 2. Structured state machine beats prose plans
`prd.json` is machine-readable with a 6-status consensus lifecycle: `pending` -> `implementing` -> `verifying` -> `passed`/`rejected`/`blocked`. Each story carries `term`, `votes[]`, and `notes`. Superpowers tracks progress via markdown checkboxes in plan documents — fragile, hard to query, impossible to aggregate programmatically. The `src/index.ts` CLI can validate structure, report status with vote tallies, scan all phases with progress bars, and generate an interactive HTML dashboard. They have nothing equivalent.

### 3. True parallelism vs theoretical parallelism
`ralph-loop.sh` processes launch in background with staggered starts and jitter. Superpowers has a `dispatching-parallel-agents` skill but it's a prompt — the human must manually coordinate agents in separate windows. sugar runs phases concurrently as actual OS processes.

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

### ~~3. The meta-system — skills tested via TDD~~ CLOSED
~~They treat skill creation as RED-GREEN-REFACTOR. Our skills were written top-down from process knowledge, not battle-tested against actual agent failure modes.~~
**Status: IMPLEMENTED.** We now have a complete pressure-testing framework (`docs/pressure_testing.md`) that applies RED-GREEN-REFACTOR methodology to skills themselves. The framework includes: 7 pressure combos (time, sunk cost, exhaustion, authority, scope creep, ambiguity, conflicting instructions), a standardized test scenario template, combo recipes (e.g., "time + sunk cost"), aggregate metrics tracking per skill, and an example pressure test for the orchestrate skill. Results are tracked in `docs/pressure_test_results/`. The framework is ready for live validation runs.

### ~~4. Cross-platform reach — 6 platforms vs 2~~ CLOSED
~~They support 6+ platforms from a single repo. Our dual-platform approach limited adoption.~~
**Status: IMPLEMENTED.** All 10 skills now ship with adapters for 6 platforms:
- **Claude Code**: `.claude/skills/<name>/SKILL.md` (native)
- **GitHub Copilot**: `.github/agents/<name>.md` + `.github/prompts/<name>.prompt.md` (agents + prompt files)
- **Cursor**: `.cursor/rules/<name>.mdc` (rules with intelligent matching)
- **Codex**: `.agents/skills/<name>/SKILL.md` (native skill format)
- **OpenCode**: `.opencode/agents/<name>.md` + native `.claude/skills/` compatibility (zero-config)
- **Gemini CLI**: `.gemini/skills/<name>.md` + `GEMINI.md` with `@` imports

### ~~5. Lifecycle coverage — they own the full pipeline~~ CLOSED
~~We cover orchestration/execution brilliantly but don't touch design, debugging, review, or TDD.~~
**Status: FULLY CLOSED.** We now have 10 skills covering the complete dev lifecycle:
- `/orchestrate` — phased execution (our core strength)
- `/prd` — PRD generation (design/planning)
- `/ralph` — PRD-to-JSON conversion
- `/debug` — systematic debugging (6 phases + 3-fix iron law)
- `/review` — adversarial code review (anti-trust + anti-sycophancy)
- `/tdd` — test-driven development (RED-GREEN-REFACTOR)
- `/brainstorm` — structured ideation with diverge/converge methodology + interactive HTML companion
- `/worktree` — git worktree lifecycle management (create, list, switch, sync, cleanup)
- `/finish` — branch finishing and PR preparation (6-step process)
- `/respond-review` — receiving and responding to code review feedback

All lifecycle gaps are closed. Every skill ships on all 6 platforms.

### ~~6. Visual brainstorming companion~~ CLOSED
~~They ship a zero-dependency Node.js server that renders HTML mockups during design phase. We have nothing for pre-implementation visualization.~~
**Status: IMPLEMENTED.** `orchestrate brainstorm <description>` generates a self-contained interactive HTML file with 4 phases: Diverge (idea input slots with add/remove), Cluster (drag-and-drop grouping into named themes), Evaluate (feasibility/impact/effort sliders with auto-calculated impact/effort ratio), Converge (top 3 picks with description, risks, and next step fields). Zero external dependencies, opens in browser automatically. Paired with the `/brainstorm` skill for structured ideation workflow.

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

| Dimension | sugar | superpowers |
| --- | --- | --- |
| **Best at** | Autonomous execution, consensus verification, model tiering, structured state, parallelism, scalability, full lifecycle coverage | Platform reach (marginally), pressure-tested skills (historically) |
| **Philosophy** | "Let the machine run — with verification" | "Trust but verify (actually, don't trust)" |
| **Weakness** | Skills not yet pressure-tested with live agent runs (framework exists, pending validation) | Can't run unattended; no structured state; no cross-session memory; no model management |
| **Moat** | Ralph loop + consensus quorum + prd.json state machine + model tiering + pattern propagation + 10 skills × 6 platforms + interactive brainstorm companion | Pressure-testing methodology maturity |

**The prompt hardening gap is closed.** We now have iron laws, rationalization tables, quality protocols, and anti-trust/anti-sycophancy rules across all 10 skills. Our consensus verification (automatic quorum voting) is structurally stronger than their manual two-pass review.

**The execution advantage has widened.** Model tiering, snapshot rollback, structured failure reports, and pattern propagation are capabilities they cannot replicate without a structured state machine.

**The platform gap is closed.** All 10 skills ship on 6 platforms: Claude Code, GitHub Copilot (agents + prompts), Cursor, Codex, OpenCode, and Gemini CLI. OpenCode gets zero-config compatibility by natively reading `.claude/skills/`.

**The lifecycle gap is closed.** 10 skills cover the full dev lifecycle: orchestration, PRD generation, PRD conversion, debugging, code review, TDD, brainstorming, worktree management, branch finishing, and review response. Plus an interactive HTML brainstorming companion.

## Remaining Gaps (1 item)

All major gaps are closed. One item remains as ongoing work:

| # | Gap | Effort | Impact |
| --- | --- | --- | --- |
| 1 | **Run live pressure tests** — The framework (`docs/pressure_testing.md`) is ready. Run actual agent sessions with pressure combos, record observed rationalizations, and update rationalization tables with empirical data. | Low (per test) | High — would validate skill robustness with real evidence |

### Closed gaps (formerly 4 items)

| # | Former Gap | Status | What was built |
| --- | --- | --- | --- |
| ~~1~~ | ~~Pressure-test skills~~ | CLOSED | `docs/pressure_testing.md` — RED-GREEN-REFACTOR methodology for skills, 7 pressure combos, scenario templates, aggregate metrics. Pending live runs. |
| ~~2~~ | ~~Cross-platform reach~~ | CLOSED | 6 platforms: Claude Code, Copilot, Cursor (`.cursor/rules/*.mdc`), Codex (`.agents/skills/*/SKILL.md`), OpenCode (`.opencode/agents/*.md` + native `.claude/skills/` compat), Gemini CLI (`.gemini/skills/*.md` + `GEMINI.md`). |
| ~~3~~ | ~~Remaining lifecycle skills~~ | CLOSED | 4 new skills: `/brainstorm` (diverge/converge ideation), `/worktree` (git worktree lifecycle), `/finish` (branch finishing + PR prep), `/respond-review` (receiving code review). Total: 10 skills. |
| ~~4~~ | ~~Visual brainstorming companion~~ | CLOSED | `orchestrate brainstorm <description>` — interactive HTML with 4 phases: diverge (idea slots), cluster (drag-drop), evaluate (scoring sliders), converge (top picks with risks). |
