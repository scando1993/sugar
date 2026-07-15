# Remediation Plan: Close the Gaps Between the Sugar Skill, CLI, and Generated Runtime

> **Audience:** any agent (or human) picking up this work without prior conversation context.
> This document is the single source of truth for the remediation effort. Read it fully before
> implementing. The previous plan.md (TypeScript engine extraction) is complete — see commit
> `d4998f7` and git history if you need it.

---

## 1. Context — what this repository is

**Sugar** is a phased software-engineering execution system. A skill document
(`.claude/skills/orchestrate/SKILL.md`, registered as `/sugar`) drives a top-level agent through
four phases: planning → workspace setup → PRD-driven parallel implementation → merge. Each
implementation phase runs in an isolated git worktree containing a self-contained "Ralph"
environment:

- `prd.json` — user-story state machine (`pending → implementing → verifying → passed/rejected/blocked`)
- `CLAUDE.md` — instructions for a fresh implementer agent spawned per story
- `VERIFY.md` — instructions for verifier agents that vote `VOTE:PASS` / `VOTE:FAIL`
- `ralph-loop.sh` — bash loop that spawns one `claude` CLI instance per iteration
- `progress.txt` — cross-iteration memory / learnings

Supporting engine (TypeScript, `src/`):

| Path | Role |
|---|---|
| `src/index.ts` | CLI entry (`sugar validate/status/status-all/dashboard/brainstorm/config/workspace/pick-story/story-update/snapshot/propagate-patterns`) |
| `src/lib/orchestrator.ts` | `Orchestrator` — workspace setup, workspace-file generation, merge order, pattern propagation |
| `src/lib/ralph-loop.ts` | `RalphLoop` — story picking, snapshots, progress/failure recording |
| `src/lib/consensus.ts` | `ConsensusEngine` — vote tally, consensus rounds, term increments |
| `src/lib/model-tier.ts` | `ModelTier` — escalation/de-escalation state machine |
| `src/lib/dependency.ts` | `DependencyAnalyzer` — parallel groups, critical path, cycle detection |
| `src/lib/workspace.ts` | `WorkspaceManager` — git worktree lifecycle |
| `src/lib/patterns.ts` | `PatternManager` — extract patterns from progress.txt, inject into CLAUDE.md |
| `src/lib/templates/*.ts` | Generators for `CLAUDE.md`, `VERIFY.md`, `ralph-loop.sh` |
| `scripts/install.sh` | Bootstrap (`npm install && npm run build && npm link`) — **currently an empty file** |

The skill is duplicated for 6+ platforms (`.claude/`, `.agents/`, `.opencode/`, `.gemini/`,
`.github/agents/` + `.github/prompts/`, `.cursor/`). `.claude/skills/orchestrate/SKILL.md` is the
canonical copy; all others have already drifted.

## 2. Current state — where execution actually breaks

An architectural review (2026-07-14) found the system has **three engines that disagree**: the TS
library, the generated bash loop, and the skill prose. The load-bearing path between them is
broken. Verified findings, ordered by severity:

### F1 — `sugar verify` does not exist (FATAL)
`ralph-loop.sh` gates every story on `if $SUGAR verify ...`
(`src/lib/templates/ralph-loop-sh.ts:47`), but `src/index.ts` has no `verify` command — unknown
commands exit 1. Consequence: **every story is rejected and `git checkout -- .` wipes the
implementation.** Nothing anywhere spawns verifier agents or parses votes; the entire consensus
subsystem (`ConsensusEngine`, `VERIFY.md`, `verifyModel`, quorum config) has no execution path.

### F2 — Phase 3b (workspace-file generation) is unreachable from the CLI (FATAL)
The skill says the library generates `prd.json`/`CLAUDE.md`/`VERIFY.md`/`ralph-loop.sh`/
`execution.md`, but no CLI command calls `Orchestrator.generateWorkspaceFiles()`. `Orchestrator`
is imported in `src/index.ts:6` and never used. Likewise `sugar propagate-patterns` only extracts
to `patterns.json`; the injection into the next group's CLAUDE.md
(`Orchestrator.propagatePatterns`, `src/lib/orchestrator.ts:256-278`) is never invoked.

### F3 — `scripts/install.sh` is empty (FATAL for onboarding)
SKILL.md's prerequisite section instructs agents to run it.

### F4 — Story state machine holes cause false success (HIGH)
- Nothing ever sets `status: "blocked"`; `maxTerms` is validated but never enforced → endless
  reject loops until `maxIterations`.
- `sugar pick-story` prints `PHASE_COMPLETE` when no `pending|rejected` stories remain
  (`src/index.ts:567-572`), so a story stranded in `implementing`/`verifying`/`blocked` makes the
  loop **exit 0 as success**, contradicting `RalphLoop.isPhaseComplete()` (all `passed`).

### F5 — Logic triplication (HIGH, root cause of F1/F2)
Model escalation exists in TS (`ModelTier`) and again in bash (`ralph-loop-sh.ts:71-78`); the TS
state is in-memory only and discarded every CLI invocation, so the class is dead weight. Story
picking exists in TS (`RalphLoop.pickNextStory`) and again as prose in generated CLAUDE.md — the
loop snapshots the story the CLI picked while the agent independently re-picks its own.

### F6 — Snapshot tags collide across parallel phases (HIGH)
Git tags are repo-global across worktrees and every workspace numbers stories from `US-001`, so
parallel phases both create `attempt-US-001-v1`; the collision is silently swallowed
(`src/lib/ralph-loop.ts:33-41`) and the rollback tag points at another phase's commit. Also
`--attempt "$i"` passes the loop iteration, not the per-story attempt.

### F7 — Fragile agent↔loop contract (HIGH)
The loop detects results by grepping free-text agent output
(`grep -qiE "STORY_FAILED|stuck|blocked|retry.?exhausted"`). Merely *mentioning* "blocked" trips
failure; consensus-fail + text-match double-increments failures; a malformed
`STORY_IMPLEMENTED` line yields an empty `STORY_ID` passed to downstream commands.

### F8 — Config system half-wired (MEDIUM)
- Shallow merge `{ ...DEFAULT_CONFIG, ...userConfig }` (duplicated in `src/index.ts:543-550` and
  `src/lib/orchestrator.ts:280-287`) — setting only `models.default` deletes
  `models.escalation`/`models.verify`.
- `sugar.config.json` is resolved from `process.cwd()`, so behavior depends on where the loop was
  launched.
- Workspace base path `/tmp/<repo>-phases` is hardcoded (`src/index.ts:619`,
  `orchestrator.ts:46`), not configurable, lost to /tmp cleanup, and collides across same-named
  repos. `repoRoot` uses `process.cwd()` instead of `git rev-parse --show-toplevel`.
- `maxTerms: 3` hardcoded in `orchestrator.ts:132`; `sugarBin: 'npx sugar'` hardcoded at
  `orchestrator.ts:175` although the package is `private: true` (unpublished — `npx sugar` can
  fetch the unrelated Sugar.js from the registry).

### F9 — Skill/harness mismatches (MEDIUM)
- SKILL.md Phase 3c uses foreground `ralph-loop.sh ... & wait` — exceeds Claude Code's Bash tool
  timeout (10 min max); contradicts the frontmatter claim of "parallel subagents".
- `--dangerously-skip-permissions` is baked into the generated loop with no user-facing choice.
- Six skill copies drift with no generation step; the 2026-07 prerequisite section exists only in
  the `.claude` copy.
- TS-only assumptions: `validatePrd` *requires* a "Typecheck passes" criterion via regex
  (`src/index.ts:91-94`); default quality checks are npm scripts. Non-JS repos cannot validate.
- README claims 8-platform parity but `ralph-loop.sh` hardcodes the `claude` binary.

### F10 — Smaller cleanups (LOW)
`tallyVotes` ignores `quorumSize`; `validatePrd` demands pre-sorted priorities (redundant);
hand-rolled argv parsing with silent cwd fallbacks; two inline HTML apps bloat `src/index.ts` to
806 lines; `workspace cleanup` force-deletes branches (`git branch -D`) without a merged check;
tests cover TS units but zero CLI/bash integration (which is why F1 survived).

## 3. Target architecture

**One engine.** The TypeScript CLI owns the loop; bash shrinks to a thin launcher (or is removed).
The skill prose only narrates and calls CLI commands that actually exist.

```
skill (SKILL.md, one canonical copy)
   │  calls documented CLI commands only
   ▼
sugar CLI (src/index.ts — thin command router)
   ├─ sugar generate  ──► Orchestrator.generateWorkspaceFiles()   (fixes F2)
   ├─ sugar run <ws>  ──► LoopRunner: iterate → spawn implementer
   │                       → sugar-internal verify (spawn N verifiers,
   │                         parse votes, ConsensusEngine tally)     (fixes F1, F5, F7)
   │                       → ModelTier persisted to <ws>/.sugar-state.json
   ├─ sugar verify    ──► standalone verifier quorum (also used by run)
   └─ existing commands, all reading config via findRepoRoot()      (fixes F8)
```

Key decisions:
1. **`sugar run <workspace>` replaces the bash loop's brain.** Iteration, story claim
   (`pending → implementing` written atomically before implementation), snapshots, escalation,
   consensus, commit, and completion detection all happen in tested TS. `ralph-loop.sh` becomes
   `exec sugar run "$SCRIPT_DIR" --max-iterations N --model M` (kept for backward compat).
2. **Structured agent contract.** The implementer agent writes `<ws>/.sugar-result.json`
   (`{storyId, outcome: implemented|failed|phase_complete, notes}`) as its final act; stdout
   markers remain as fallback. The runner treats the file as authoritative.
3. **Tag namespacing.** Snapshot tags become `sugar/<phase>/<storyId>/attempt-<n>` with a real
   per-story attempt counter persisted in `.sugar-state.json`.
4. **State machine closed.** `term >= maxTerms` → `blocked`. `sugar run` exits non-zero with a
   `PHASE_BLOCKED` report when unfinished non-pending stories remain; `pick-story` gains
   `--strict` distinguishing `PHASE_COMPLETE` from `PHASE_STUCK`.
5. **Config unification.** One `loadConfig()` in `src/lib/config.ts` with deep merge, repo root
   via `git rev-parse --show-toplevel`, `workspaceBasePath` + `maxTerms` + `permissionMode` +
   `runner` (claude binary) as config fields. `sugarBin` resolved from the actual installed
   binary path.
6. **Docs single-sourced.** `.claude/skills/*/SKILL.md` is canonical; `scripts/sync-skills.ts`
   generates all other platform variants; CI (or a test) fails on drift.
7. **Language-agnostic gates.** The mandatory-criterion check derives from
   `config.qualityChecks[0]` instead of a hardcoded "Typecheck passes" regex.

## 4. Workstreams, dependencies, execution phases

Sized for the sugar workflow itself (one workspace per workstream is viable).

### WS-A — Foundation: config + repo-root resolution *(no dependencies)*
Produces: `src/lib/config.ts` (deep merge, findRepoRoot, new fields), both former `loadConfig`
call sites migrated, `install.sh` written (npm install/build/link + `command -v` self-check).
Fixes: F3, F8.

### WS-B — Consensus execution path: `sugar verify` *(depends on WS-A)*
Produces: verifier spawner (N parallel `claude --model <verifyModel> < VERIFY.md`), vote parser,
`ConsensusEngine` wiring, `maxTerms → blocked` enforcement, `rejection_log` feedback loop.
Fixes: F1, part of F4.

### WS-C — Loop ownership: `sugar run` + state persistence *(depends on WS-A, WS-B)*
Produces: `LoopRunner` class + command; persisted `ModelTierState`; structured result-file
contract (template updates in `claude-md.ts`); namespaced snapshot tags with real attempt
counters; `PHASE_STUCK` semantics; `ralph-loop.sh` template reduced to a thin `exec`.
Fixes: F4, F5, F6, F7.

### WS-D — Generation command: `sugar generate` *(depends on WS-A; parallel with WS-B/C)*
Produces: `sugar generate --phases <phases.json>` invoking `Orchestrator.generateWorkspaceFiles`
(+ `execution.md`), documented `phases.json` schema in types, `propagate-patterns --inject` flag
wiring `injectPatterns`. Fixes: F2.

### WS-E — Skill + docs realignment *(depends on WS-B, WS-C, WS-D)*
Produces: SKILL.md rewritten against the real CLI surface (background execution via
`run_in_background` + `sugar status-all` polling — no foreground `wait`), permission mode as an
explicit user choice, `scripts/sync-skills.ts` + drift test, README platform-parity claims
corrected. Fixes: F9.

### WS-F — Hygiene *(depends on WS-C; can trail)*
Produces: quorum-aware `tallyVotes`, argv parsing hardening, HTML apps extracted from
`index.ts`, `workspace cleanup` merged-check guard, an end-to-end smoke test (generate → one
mocked `sugar run` iteration with a stub `claude`) plus shellcheck on the generated script.
Fixes: F10, guards against F1-class regressions.

**Parallel groups:** Group 1: `WS-A` → Group 2: `WS-B`, `WS-D` (parallel) → Group 3: `WS-C` →
Group 4: `WS-E`, `WS-F` (parallel).
**Critical path:** A → B → C → E.

## 5. Acceptance criteria (per workstream)

- **A:** partial `sugar.config.json` overrides merge deeply (unit test); `sugar` commands behave
  identically from repo root and subdirectories; `./scripts/install.sh` from a clean clone yields
  a working `sugar` on PATH.
- **B:** `sugar verify --workspace <ws> --story US-001` spawns quorum, records votes in
  `prd.json`, returns exit 0/1 by majority; a story rejected `maxTerms` times becomes `blocked`.
- **C:** `sugar run` completes a 2-story fixture with a stubbed `claude` binary; kills/timeouts
  leave the story re-claimable (no permanent `implementing`); tags namespaced per phase; exit
  code distinguishes complete vs stuck.
- **D:** `sugar generate --phases fixtures/phases.json` emits all five files per workspace and
  `execution.md`; `sugar validate` passes on the generated `prd.json`.
- **E:** drift test proves all platform copies are regenerated from the canonical skill; SKILL.md
  references only commands that exist (`grep`-able check).
- **F:** e2e smoke test green in CI; shellcheck clean on generated script.

## 6. Open decisions (need owner input before the affected workstream starts)

1. **Keep or drop the bash `ralph-loop.sh` entirely?** Plan assumes keep-as-thin-wrapper for
   backward compat. Dropping simplifies WS-C but breaks documented invocations. *(Blocks WS-C.)*
2. **Verifier isolation:** verifiers currently read `git diff HEAD~1 HEAD` in the same worktree —
   run them in the workspace (cheap, chosen default) or in ephemeral read-only worktrees (safer)?
   *(Blocks WS-B.)*
3. **Default permission mode** for spawned agents: keep `--dangerously-skip-permissions` as an
   opt-in config value (`permissionMode: "skip" | "acceptEdits" | "default"`), default to which?
   Plan proposes defaulting to `acceptEdits`. *(Blocks WS-C templates.)*
4. **`phase` / `orchestrate` / `sugar` naming:** consolidate on `sugar` and delete stale aliases?
   *(Affects WS-E only.)*

## 7. Working conventions for agents on this effort

- One workstream per branch/workspace; branch naming `ws-a-config`, `ws-b-verify`, etc.
- Every commit passes `npm run build && npm test`.
- Do not edit generated platform copies by hand once WS-E lands — edit the canonical skill and
  regenerate.
- Update the checkbox list in `todo.md` (if present) and this file's §6 when a decision is made;
  record deviations from this plan at the bottom of this file under "## Deviations".