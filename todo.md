# Todo: Model Tiering + Raft Consensus + Superpowers

## Phase-A: TypeScript (`src/types.ts` + `src/index.ts`)

**Completion criteria:** `npx tsc --noEmit` passes; validate/status commands work in both legacy and consensus mode.

- [x] **A1** Add `Vote` interface to `src/types.ts` — fields: `term`, `verifier`, `result: "pass"|"fail"`, optional `reason`, `timestamp`
- [x] **A2** Add `ConsensusConfig` interface to `src/types.ts` — fields: `quorumSize`, `requiredMajority`, `implementModel`, `verifyModel`, `escalationModel`, `maxTerms`
- [x] **A3** Update `UserStory` in `src/types.ts` — make `passes` optional; add optional: `status` (6-value union), `term`, `votes: Vote[]`
- [x] **A4** Add optional `consensus: ConsensusConfig` to `PrdJson` in `src/types.ts`
- [x] **A5** Add `isConsensusMode(prd: PrdJson): boolean` helper to `src/index.ts`
- [x] **A6** Add `storyIsPassed(story, consensusMode)` and `storyIsBlocked(story, consensusMode)` helpers to `src/index.ts`
- [x] **A7** Update `validatePrd()` in `src/index.ts` — branch on `isConsensusMode`: legacy keeps existing `passes` boolean check; consensus validates ConsensusConfig fields and story `status`/`votes`
- [x] **A8** Update `reportStatus()` in `src/index.ts` — consensus mode shows 6-status categories with vote tallies from current term
- [x] **A9** Update `scanWorkspaces()` in `src/index.ts` — use status helpers per workspace; add consensus metrics to aggregate
- [x] **A10** Add `dashboard` command to `src/index.ts` — `orchestrate dashboard <base-path>` scans all prd.json files, generates self-contained HTML with phase cards + progress bars + story detail, opens in browser
- [x] **A11** Update `printUsage()` in `src/index.ts` to document `dashboard` command
- [x] **A12** Run `npx tsc --noEmit` — must compile clean _(depends: A1-A11)_

---

## Phase-B: Orchestrate SKILL.md (`.claude/skills/orchestrate/SKILL.md`)

**Completion criteria:** Read-through confirms all 9 change sets are present in the correct sections.

### B1-B3: Prompt hardening in CLAUDE.md template (superpowers A, B, C)

- [x] **B1** Add Iron Laws at top of CLAUDE.md template (before "Your Task") — 3 laws: ONE STORY, NEVER COMMIT BROKEN, READ PROGRESS.TXT FIRST
- [x] **B2** Replace single "Run quality checks" step in CLAUDE.md template with 6-step Quality Protocol (self-review → checks → verify criteria → commit)
- [x] **B3** Add rationalization table to CLAUDE.md template after Rules section — 6-row table with orchestrate-agent red flags

### B4-B5: ralph-loop.sh model tiering (plan_model_tiering Steps 1-3, plan_raft Step 4)

- [x] **B4** Update ralph-loop.sh template usage line: `# Usage: ./ralph-loop.sh [max_iterations] [default_model]`
- [x] **B5** Add model tiering variables to ralph-loop.sh template: `DEFAULT_MODEL`, `ESCALATION_MODEL`, `CURRENT_MODEL`, `CONSECUTIVE_FAILURES`, `ESCALATION_THRESHOLD=2`; add startup banner
- [x] **B6** Update `claude` invocation in ralph-loop.sh template to use `--model "$CURRENT_MODEL"`
- [x] **B7** Add escalation/de-escalation block to ralph-loop.sh template (after PHASE_COMPLETE check)
- [x] **B8** Add model logging line to ralph-loop.sh template (log model + result to progress.txt each iteration)
- [x] **B9** Add `STORY_FAILED` signal section to CLAUDE.md template (Model Escalation section)

### B10-B11: Consensus in ralph-loop.sh + VERIFY.md template (plan_raft Step 5)

- [x] **B10** Add VERIFY.md template section to SKILL.md (after CLAUDE.md template in Phase 3b) — verifier agent instructions, iron laws, rationalization table, VOTE:PASS/VOTE:FAIL output format; note: only generated when prd.json has consensus config
- [x] **B11** Update ralph-loop.sh template with consensus detection + dual path — consensus: IMPLEMENT→VERIFY(parallel quorum)→TALLY→commit or reject; legacy: existing model-tiered loop
- [x] **B12** Update CLAUDE.md template for consensus mode — pick `status: "pending"` or `"rejected"` stories; read rejection_log.txt before retry; set `status: "verifying"` after implementation; output `STORY_IMPLEMENTED:US-XXX`
- [x] **B13** Add managed files table entry: `VERIFY.md | each worktree | Phase 3b (consensus only)`

### B14: Rollback/recovery (plan_superpowers Step H)

- [x] **B14** Update ralph-loop.sh template — before each attempt: create snapshot tag `attempt-${STORY_ID}-v${ATTEMPT_NUM}`; on 3rd failure: write structured JSON to `failure_log.json` (storyId, attempt, filesModified, failureType, lastError)
- [x] **B15** Update CLAUDE.md template — add instruction to check `failure_log.json` before implementing; if story has prior failures, read report and try DIFFERENT approach

### B16: Pattern propagation (plan_superpowers Step I)

- [x] **B16** Update Phase 3b in SKILL.md — add `patterns.json` schema definition and generation instructions
- [x] **B17** Replace "Collect Codebase Patterns" step in Phase 3c "Between groups" — new 4-step instruction: parse progress.txt → extract to patterns.json → inject relevant patterns into next-group CLAUDE.md → CLAUDE.md template gains `## Known Patterns` section
- [x] **B18** Add `patterns.json | repo root | Phase 3c (between groups)` to managed files table

### B19-B20: Launch examples + execution.md (plan_model_tiering Steps 3-4)

- [x] **B19** Update Phase 3c launch examples in SKILL.md — change `ralph-loop.sh 20 &` to `ralph-loop.sh 20 sonnet &`; add model selection strategy note (Sonnet/Haiku/Opus guidance)
- [x] **B20** Add item 7 to execution.md template contents list: "Model strategy — default model per phase, escalation thresholds, rationale"

---

## Phase-C: Copilot orchestrate files _(depends on Phase-B)_

**Completion criteria:** Read-through confirms all Phase-B changes are mirrored with correct Copilot syntax.

- [x] **C1** Apply iron laws (B1) to `.github/agents/phase.md` CLAUDE.md template
- [x] **C2** Apply quality protocol (B2) to `.github/agents/phase.md` CLAUDE.md template
- [x] **C3** Apply rationalization table (B3) to `.github/agents/phase.md` CLAUDE.md template
- [x] **C4** Apply model tiering variables B4-B8 to `.github/agents/phase.md` ralph-loop.sh template — merge with existing retry/backoff (retry=transient API errors, escalation=implementation failures)
- [x] **C5** Apply STORY_FAILED signal (B9) to `.github/agents/phase.md` CLAUDE.md template
- [x] **C6** Apply VERIFY.md template (B10) to `.github/agents/phase.md`
- [x] **C7** Apply consensus ralph-loop.sh changes (B11-B13) to `.github/agents/phase.md`
- [x] **C8** Apply rollback/recovery (B14-B15) to `.github/agents/phase.md`
- [x] **C9** Apply pattern propagation (B16-B18) to `.github/agents/phase.md`
- [x] **C10** Apply launch example updates (B19-B20) to `.github/agents/phase.md`
- [x] **C11** Apply all above changes (C1-C10) to `.github/prompts/phase.prompt.md` — use `${input}` variable syntax and Copilot tool names (`read_file`/`write_file`/`edit_file`/`codebase_search`/`run_in_terminal`/`run_tests`)
- [x] **C12** Bring `.github/prompts/phase.prompt.md` to parity with `.github/agents/phase.md` retry/backoff logic (phase.prompt.md has simpler ralph-loop.sh — add retry before adding new features)

---

## Phase-D: Ralph skill files

**Completion criteria:** All three ralph files have rationalization tables and consensus format example.

- [x] **D1** Add rationalization table to `.claude/skills/ralph/SKILL.md` — 3-row table with ralph-converter red flags (combine stories, skip typecheck, skip description detail)
- [x] **D2** Add consensus format prd.json example to `.claude/skills/ralph/SKILL.md` — show `consensus` config, `status`, `term`, `votes` fields
- [x] **D3** Add conversion rule 7 to `.claude/skills/ralph/SKILL.md`: "For consensus mode: stories start with `status: 'pending'`, `term: 0`, `votes: []`"
- [x] **D4** Apply D1-D3 to `.github/agents/ralph.md` with Copilot agent syntax
- [x] **D5** Apply D1-D3 to `.github/prompts/ralph.prompt.md` with `${input}` syntax

---

## Phase-E: New skills

**Completion criteria:** All 9 new files created; read-through confirms required sections present.

### Debug skill (plan_superpowers Step D)

- [x] **E1** Create `.claude/skills/debug/SKILL.md` — frontmatter (name: debug, user-invocable: true), Iron Law (3-fix rule), 6 phases (Reproduce/Hypothesize/Investigate/Fix/Verify/Regression), red flags table, rules
- [x] **E2** Create `.github/agents/debug.md` — same content with `tools:` frontmatter array and `[user's bug description]` syntax
- [x] **E3** Create `.github/prompts/debug.prompt.md` — same content with `${input}` syntax and Copilot tool names

### Review skill (plan_superpowers Step E)

- [x] **E4** Create `.claude/skills/review/SKILL.md` — frontmatter, Iron Law (anti-trust), 6-step process, anti-trust protocol, anti-sycophancy rules, red flags table
- [x] **E5** Create `.github/agents/review.md` — adapted with Copilot syntax
- [x] **E6** Create `.github/prompts/review.prompt.md` — adapted with `${input}` syntax

### TDD skill (plan_superpowers Step F)

- [x] **E7** Create `.claude/skills/tdd/SKILL.md` — frontmatter, Iron Law (no production code without failing test), RED-GREEN-REFACTOR cycle, red flags table, rules
- [x] **E8** Create `.github/agents/tdd.md` — adapted with Copilot syntax
- [x] **E9** Create `.github/prompts/tdd.prompt.md` — adapted with `${input}` syntax

---

## Verification checklist (post all phases)

- [x] `npx tsc --noEmit` — clean compile
- [ ] `node dist/index.js validate <legacy-prd.json>` — passes
- [ ] `node dist/index.js validate <consensus-prd.json>` — passes
- [ ] `node dist/index.js validate <malformed-consensus-prd.json>` — errors correctly
- [ ] `node dist/index.js status <prd.json>` — both formats display
- [ ] `node dist/index.js status-all <base-path>` — mixed directory works
- [x] Read-through: ralph-loop.sh template has model tiering + consensus dual path + rollback + patterns
- [x] Read-through: VERIFY.md template has iron laws, rationalization table, VOTE output format
- [x] Read-through: debug skill has 6 phases + 3-fix iron law
- [x] Read-through: review skill has anti-trust + anti-sycophancy sections
- [x] Read-through: TDD skill has RED-GREEN-REFACTOR + failing-test-first iron law
