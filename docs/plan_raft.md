# Plan: Implement Model Tiering + Raft Consensus

> **Status: historical, executed and superseded.** This plan targeted the pre-TypeScript-extraction
> architecture, where all logic lived as bash/markdown inside `.claude/skills/orchestrate/SKILL.md`
> (the file:line references below predate `src/lib/`). The design it describes was later
> extracted into a TypeScript library and then, in a 2026-07 remediation, wired up so the CLI
> commands it depends on (`sugar verify`) actually exist and execute. For the current
> architecture, see `src/lib/consensus.ts`, `src/lib/verifier.ts`, `src/lib/loop-runner.ts`, and
> the "Implementation status" sections at the top of `raft_consensus_strategy.md` and
> `model_tiering_strategy.md`. Kept here as a historical record of the original step-by-step plan.

## Context

The Ralph loop currently has two gaps:
1. **No model tiering** — every iteration uses the same model, wasting money on simple stories
2. **Self-assessment trust gap** — the implementing agent marks its own work as `passes: true` with no independent verification

This plan implements both features from `docs/model_tiering_strategy.md` and `docs/raft_consensus_strategy.md`. Consensus is **opt-in** — old prd.json files continue to work unchanged.

---

## Step 1: Extend type definitions

**File:** `src/types.ts`

- Add `Vote` interface: `{ term, verifier, result: "pass"|"fail", reason?, timestamp }`
- Add `ConsensusConfig` interface: `{ quorumSize, requiredMajority, implementModel, verifyModel, escalationModel, maxTerms }`
- Make `passes` optional on `UserStory`, add optional: `status`, `term`, `votes`
- Add optional `consensus` to `PrdJson`
- Backward compat: both `passes` (legacy) and `status` (consensus) coexist as optional fields

**Verify:** `npx tsc --noEmit`

---

## Step 2: Update CLI validation

**File:** `src/index.ts` — `validatePrd()` (lines 5-69)

- Add `isConsensusMode(prd)` helper — returns `true` when `prd.consensus` exists
- **Legacy mode:** keep existing `typeof story.passes !== 'boolean'` check (line 56)
- **Consensus mode:** validate `ConsensusConfig` fields (quorumSize > 0, requiredMajority <= quorumSize, models non-empty, maxTerms > 0). Validate each story's `status` is one of 6 allowed values. Validate `votes[]` entries if present (term >= 0, verifier > 0, result is "pass"|"fail", fail votes need reason)
- The branch point replaces lines 56-58 with an if/else on `consensusMode`

**Verify:** `npx tsc --noEmit` + test with both old and new format prd.json

---

## Step 3: Update CLI status reporting

**File:** `src/index.ts` — `reportStatus()` (lines 71-111) + `scanWorkspaces()` (lines 113-171)

- Add `storyIsPassed(story, consensusMode)` and `storyIsBlocked(story, consensusMode)` helpers
- **reportStatus consensus mode:** show `passed | implementing | verifying | rejected | blocked | pending` categories. For rejected/verifying stories, show vote tallies from current term
- **scanWorkspaces:** use same helpers per-workspace. Add consensus metrics to aggregate: total votes cast, escalation count

**Verify:** `node dist/index.js status` on both formats

---

## Step 4: Model tiering in ralph-loop.sh template

**File:** `.claude/skills/orchestrate/SKILL.md` — ralph-loop.sh template (~line 237)

- Add `DEFAULT_MODEL="${2:-sonnet}"`, `ESCALATION_MODEL="opus"`, `CURRENT_MODEL`, `CONSECUTIVE_FAILURES`, `ESCALATION_THRESHOLD=2`
- Change `claude` invocation to `claude --model "$CURRENT_MODEL"`
- Add escalation logic: after 2 consecutive failures, switch to ESCALATION_MODEL. On success, de-escalate back
- Add model logging to progress.txt
- Update CLAUDE.md template: add note about STORY_FAILED output for model escalation
- Update Phase 3c launch examples: `ralph-loop.sh 20 sonnet`

**Verify:** read-through of template logic

---

## Step 5: Consensus in ralph-loop.sh + new VERIFY.md template

**File:** `.claude/skills/orchestrate/SKILL.md`

**5a — Add VERIFY.md template** (new section after CLAUDE.md template in Phase 3b):
- Verifier agent instructions with iron laws and rationalization tables
- Check each acceptance criterion against actual code diff
- Output `VOTE:PASS` or `VOTE:FAIL:{criterion}:{reason}`
- Only generated when prd.json has `consensus` config

**5b — Update ralph-loop.sh template** with consensus mode:
- Detect consensus via `grep -q '"consensus"' prd.json`
- Consensus path: IMPLEMENT → VERIFY (parallel quorum) → TALLY → commit or reject
- Legacy path: existing model-tiered loop (no verification)
- Tally: count PASS/FAIL in temp dir, majority wins, tie escalates to Opus
- On rejection: write to `rejection_log.txt`, soft-reset commit

**5c — Update CLAUDE.md template** for consensus mode:
- Pick stories where `status: "pending"` or `status: "rejected"`
- Read `rejection_log.txt` before retrying rejected stories
- Set `status: "verifying"` after implementation (not "passed")
- Output `STORY_IMPLEMENTED:US-XXX` signal

**5d — Update managed files table:** add `VERIFY.md | each worktree | Phase 3b (consensus only)`

**Verify:** read-through of all templates

---

## Step 6: Sync to Copilot agent

**File:** `.github/agents/sugar.md`

Apply all template changes from Steps 4-5. Preserve existing differences:
- Uses `[user's task]` variable syntax
- Has retry/backoff already in ralph-loop.sh (merge with new tiering/consensus)
- Uses `read`/`edit`/`search`/`terminal`/`test-runner` tool names

---

## Step 7: Sync to Copilot prompt

**File:** `.github/prompts/sugar.prompt.md`

Apply all template changes from Steps 4-5. Preserve existing differences:
- Uses `${input}` variable syntax
- Has simpler ralph-loop.sh (bring to parity with sugar.md retry logic + new features)
- Uses `read_file`/`write_file`/`edit_file`/`codebase_search`/`run_in_terminal`/`run_tests` tool names

---

## Step 8: Update Ralph converter skill

**File:** `.claude/skills/ralph/SKILL.md`

- Add second example showing consensus-format prd.json (with `consensus` config, `status`, `term`, `votes`)
- Add conversion rule 7: "For consensus mode: stories start with `status: 'pending'`, `term: 0`, `votes: []`"
- Keep existing legacy format as default

Also sync to: `.github/agents/ralph.md` and `.github/prompts/ralph.prompt.md`

---

## Execution order

```
Step 1 (types.ts)
  ↓
Step 2 + 3 (index.ts — can be done together, same file)
  ↓
Step 4 (SKILL.md — model tiering)
  ↓
Step 5 (SKILL.md — consensus, builds on Step 4)
  ↓
Step 6 + 7 (sync to Copilot, parallel)
  ↓
Step 8 (ralph skill + sync)
```

---

## Verification

After all steps:
1. `npx tsc --noEmit` — must compile clean
2. `node dist/index.js validate` — test with legacy prd.json (passes)
3. `node dist/index.js validate` — test with consensus prd.json (passes)
4. `node dist/index.js validate` — test with malformed consensus prd.json (errors)
5. `node dist/index.js status` — both formats display correctly
6. `node dist/index.js status-all` — mixed directory works
7. Read-through: ralph-loop.sh template parses correctly in both modes
8. Read-through: VERIFY.md template has iron laws, rationalization tables, proper vote output format
