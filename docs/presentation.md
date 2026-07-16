# Sugar Rush 

## Problem

My wife had a performance issue with their company site, when I looked at the code I saw where the issue was. 
They had a canvas like component on angular that was almost 8K lines of code. So my solution was easy ask Claude 
to refactor it into smaller components following strong separation of concerns.

But how to do it on a bugdet? (Or do it on a normal account)? Also without compromising the application, since this is the
main feature of the application. Even with Claude this is a big task because it involve refactoring multiple components

I tried Superpowers and it was a great tool, but I saw main issues with it:

- It ran out of normal usage really fast.
- It needed a lot of hand holding to get it to work, each small refactor needed validation and reiteration.
- Large subfeatures wasn't being refactored it went through secure routes.

So I decided to try a different approach.
I created a Claude skill that would allow me to phased engineering (Planning, Task Assignment, Parallelization, Execution, Review)

I called it Sugar Rush.

The main idea is instead of having one huge agent or a team of agents of the same capacity, split the work between smaller agents
and check with the dummest possible agents to check.

So for example, using Claude's models

Planning:
(Understanting the issue and refining it) -> (Accionable items) -> (Split Features using separation of concerns)

Task Assignment:
- Each feature is a branch, using a different git worktree so changes are isolated
- When done all changes on the branches are pushed and they need to be merged
- Then create a task execution plan, this generates a task execution graph, it will split into subagents and parallelize when possible 

Execution:
- For each branch, the plugin will use subagents (1 to execute, 3 to check)
- Each actionable item in a feature can be splitted into concrete user stories using NO TRUST POLICY, quorum consensus and 2/3 majority.
- It generates a PRD.json file with the user stories to execute, so for each actionable item inside a feature it can generate multiple user stories.
- It has to do TTD first, then executor will do the implementation following the user story, then the checkers will check the implementation.
- In order to reach a consensus, it uses a modified version of the RAFT algorithm, where the checkers will vote if the implementation is correct or not, 
- If 2/3 of the checkers agree that the implementation is correct, then we can move to the next user story, if not, then we need to iterate again until we reach a consensus.

Review & Merge:
- Merge can be fully automated, but it can be decided to use human intervention.
- For each conflict it tries to use the best strategy to resolve it. If not possible or not sure it ask the user to resolve it.

## The Consensus Loop

```
ralph-loop.sh (outer loop)
  │
  ├── Iteration N:
  │   │
  │   ├── IMPLEMENT (Sonnet — the "Leader")
  │   │   claude --model sonnet < CLAUDE.md
  │   │   → Implements one story, runs checks, commits
  │   │   → Outputs: STORY_IMPLEMENTED:US-003
  │   │
  │   ├── VERIFY (3x Haiku in parallel — the "Followers")
  │   │   claude --model haiku < VERIFY.md &   # verifier 1
  │   │   claude --model haiku < VERIFY.md &   # verifier 2
  │   │   claude --model haiku < VERIFY.md &   # verifier 3
  │   │   wait
  │   │   Each independently checks:
  │   │   - Acceptance criteria satisfied in actual code?
  │   │   - Quality checks pass? (typecheck, lint, tests)
  │   │   - Implementation correct and complete?
  │   │   → Outputs: VOTE:PASS or VOTE:FAIL:{reason}
  │   │
  │   ├── TALLY (bash — deterministic, no model needed)
  │   │   Count PASS vs FAIL votes
  │   │   Majority PASS → set passes: true, committed
  │   │   Majority FAIL → collect reasons → feed to next attempt
  │   │   Tie → escalate to Opus tiebreaker
  │   │
  │   └── Next iteration or PHASE_COMPLETE
```

---

## Cost Analysis

Verification is read-only — verifiers don't generate code, they read a diff and check criteria. Haiku is perfect for this.

| Component | Model | Tokens (~) | Cost per story |
|---|---|---|---|
| Implementer | Sonnet | ~50K | ~$0.90 |
| Verifier x3 | Haiku | ~15K each | ~$0.07 each |
| **Total per story** | | | **~$1.11** |
| Opus solo (no consensus) | Opus | ~50K | **~$4.50** |

Adversarial review at 25% of the cost of Opus solo. And the quality guarantee is stronger because three independent agents are harder to fool than one.

### Cost per typical run (10 stories, 3 phases)

| Strategy | Cost | Quality |
|---|---|---|
| All Opus, no consensus | ~$135 | Medium-High (self-assessed) |
| Sonnet impl + Haiku consensus | ~$33 | High (quorum-verified) |
| Sonnet impl + Sonnet consensus | ~$54 | Higher (smarter verifiers) |
| Haiku impl + Haiku consensus | ~$11 | Medium (cheap but fragile) |

---

## prd.json State Machine Evolution

```
status: "pending"
  → "implementing" (leader picked it up)
    → "verifying" (implementation done, votes in progress)
      → "passed" (quorum achieved)
      → "rejected" (quorum failed, reasons recorded)
        → "implementing" (retry with feedback)
          → ... (up to 3 attempts)
            → "blocked" (escalate)
```

---

## Raft Safety Properties Applied

### 1. Election restriction → Implementation quality gate
Before an agent can implement, it must have the latest git state. No implementing on stale code. The loop enforces `git pull` before each iteration.

### 2. Commit requires current-term entry → No stale approvals
A story can only be "committed" (status: passed) based on votes from the CURRENT term. If the code changes between implementation and verification, the votes are invalidated.

### 3. Majority quorum → Byzantine tolerance (lite)
With 3 verifiers, one can hallucinate "PASS" and you still catch it. With 5 verifiers, you tolerate 2 bad assessments. This is cheaper than making a single agent smarter.

### 4. nextIndex backtracking → Structured retry feedback
When consensus fails, you don't just retry blindly. The FAIL reasons from verifiers become the "prevLogIndex check" — the next implementer reads exactly WHY the previous attempt was rejected and must address those specific points.

### 5. Split brain prevention → No conflicting story states
Only one agent implements a story at a time (leader). Verifiers only verify the current term's implementation. No race conditions on prd.json.

---

## Where Raft Doesn't Map (and That's Fine)

| Raft Concept | Why it doesn't apply |
|---|---|
| **Leader election** | The loop script IS the election — it spawns the implementer. No competing candidates. |
| **Log replication** | `prd.json` + git IS the shared log, and it's a file, not a distributed system. |
| **Network partitions** | All agents run on the same machine. |
| **Membership changes** | Cluster size (number of verifiers) is fixed per run. |

We take the **consensus and commit protocol** from Raft, not the distributed infrastructure.

---

## Compounding with Model Tiering

The consensus mechanism compounds with the model tiering strategy (see [model_tiering_strategy.md](model_tiering_strategy.md)):

| Configuration | Impl model | Verify model | Cost/story | Quality |
|---|---|---|---|---|
| Baseline (Opus, no consensus) | Opus | — | $4.50 | Medium-High (self-assessed) |
| Budget consensus | Sonnet | Haiku x3 | $1.11 | High (quorum-verified) |
| Balanced consensus | Sonnet | Sonnet x3 | $3.60 | Very High |
| Premium consensus | Opus | Sonnet x3 | $7.20 | Highest |
| Ultra-cheap consensus | Haiku | Haiku x3 | $0.32 | Medium (cheap everywhere) |

The sweet spot is **Sonnet implementer + Haiku verifiers**: 75% cheaper than Opus solo with HIGHER quality due to independent verification.

---

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
| **Platforms** | 8 (Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Codex, OpenCode, Gemini CLI) | 6+ (Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Copilot CLI) |
| **Skill count** | 10 skills (orchestrate, prd, ralph, debug, review, tdd, brainstorm, worktree, finish, respond-review) | 14 skills covering the full dev lifecycle |
| **Model management** | Model tiering with auto-escalation/de-escalation per phase | No model management — uses whatever the user configures |
| **Session bootstrap** | Skill-on-demand | SessionStart hook injects bootstrap into every session |

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
Before each attempt, a snapshot tag namespaced by phase and story (`sugar/<phase>/<story-id>/attempt-<n>`) is created for clean rollback. On 3rd failure, a structured report is written to `failure_log.json` (storyId, attempt, filesModified, failureType, lastError). Future agents read this to try a different approach. Superpowers just retries — no structured failure memory.

### 9. Visual brainstorming companion
They ship a zero-dependency Node.js server that renders HTML mockups during design phase — the agent pushes screens, the user clicks choices, events flow back. We have nothing for pre-implementation visualization.

**Gap remains.** We have the HTML dashboard for progress tracking (Phase 3c status), but no interactive design-phase visualization tool.

---
