# Plan: Model Tiering + Raft Consensus + Superpowers Features

## Objective

Implement three sets of improvements to the orchestration-skills system:

1. **Model tiering** (`plan_model_tiering.md`) — adaptive model selection in ralph-loop.sh: start cheap (Sonnet/Haiku), escalate to Opus on repeated failures, de-escalate on success.
2. **Raft consensus** (`plan_raft.md`) — opt-in consensus mode where independent verifiers vote on implementation quality before commit. Requires TypeScript type changes and CLI updates.
3. **Superpowers features** (`plan_superpowers.md`) — 9 features (A–I): prompt hardening (rationalization tables, iron laws, quality protocol), three new skills (debug, review, tdd), dashboard CLI command, rollback/recovery, and pattern propagation.

---

## Scope

### Files modified (existing)

| File | Changes from |
|---|---|
| `src/types.ts` | plan_raft Step 1 |
| `src/index.ts` | plan_raft Steps 2-3, plan_superpowers Step G |
| `.claude/skills/orchestrate/SKILL.md` | plan_model_tiering Steps 1-4, plan_raft Steps 4-5, plan_superpowers A,B,C,H,I |
| `.github/agents/phase.md` | plan_model_tiering Step 5, plan_raft Step 6, plan_superpowers A,B,C,H,I |
| `.github/prompts/phase.prompt.md` | plan_model_tiering Step 6, plan_raft Step 7, plan_superpowers A,B,C,H,I |
| `.claude/skills/ralph/SKILL.md` | plan_raft Step 8, plan_superpowers Step A |
| `.github/agents/ralph.md` | plan_raft Step 8, plan_superpowers Step A |
| `.github/prompts/ralph.prompt.md` | plan_raft Step 8, plan_superpowers Step A |

### Files created (new)

| File | From |
|---|---|
| `.claude/skills/debug/SKILL.md` | plan_superpowers Step D |
| `.github/agents/debug.md` | plan_superpowers Step D |
| `.github/prompts/debug.prompt.md` | plan_superpowers Step D |
| `.claude/skills/review/SKILL.md` | plan_superpowers Step E |
| `.github/agents/review.md` | plan_superpowers Step E |
| `.github/prompts/review.prompt.md` | plan_superpowers Step E |
| `.claude/skills/tdd/SKILL.md` | plan_superpowers Step F |
| `.github/agents/tdd.md` | plan_superpowers Step F |
| `.github/prompts/tdd.prompt.md` | plan_superpowers Step F |

---

## Assumptions

- `src/types.ts` and `src/index.ts` use TypeScript; `npx tsc --noEmit` must pass after changes.
- Consensus mode is opt-in via a `consensus` key in `prd.json`; existing prd.json files with `passes: boolean` continue to work.
- The three plan documents are the authoritative specification; no external clarification needed.
- New skill files (debug, review, tdd) follow the same frontmatter pattern as `.claude/skills/ralph/SKILL.md`.
- Copilot files (`.github/agents/phase.md`, `.github/prompts/phase.prompt.md`) mirror SKILL.md changes with adapted syntax.

---

## Constraints

- No breaking changes to the existing `passes: boolean` prd.json format.
- TypeScript must compile clean after every phase.
- New skill SKILL.md files must have `user-invocable: true` frontmatter.
- ralph-loop.sh template changes must remain valid bash.

---

## Risks

| Risk | Mitigation |
|---|---|
| Orchestrate SKILL.md is large and touched by 9 separate change sets | Execute all changes to this file in one phase (Phase-B), sequentially by section |
| Consensus validation logic is complex | Implement types first (Phase-A), validate against spec before syncing to Copilot |
| Copilot files have different syntax (`[user's task]` vs `$ARGUMENTS`) | Phase-C reads Phase-B output as reference and adapts |
| ralph-loop.sh template must merge model tiering + consensus + rollback + patterns | Implement in defined order: tiering → consensus → rollback → patterns |

---

## Dependency Map

```
src/types.ts (Phase-A)
  └── consumed by: src/index.ts consensus validation (also Phase-A)

.claude/skills/orchestrate/SKILL.md (Phase-B)
  └── consumed by: .github/agents/phase.md (Phase-C)
                   .github/prompts/phase.prompt.md (Phase-C)

.claude/skills/ralph/SKILL.md (Phase-D)
  └── consumed by: .github/agents/ralph.md (Phase-D, same phase)
                   .github/prompts/ralph.prompt.md (Phase-D, same phase)

New skills Phase-E:
  debug, review, tdd — no dependencies, fully independent
```

**Independent files** (no cross-phase dependencies at creation time):
- Phase-A: `src/` files
- Phase-B: orchestrate `SKILL.md`
- Phase-D: ralph skill files
- Phase-E: new skill files (debug, review, tdd)

**Sequential dependency:**
- Phase-C must come after Phase-B (mirrors its ralph-loop.sh and CLAUDE.md template changes)

---

## Execution Phases

### Group 1 — Parallel (no dependencies)

**Phase-A: TypeScript** — `src/types.ts` + `src/index.ts`
- Vote, ConsensusConfig types
- Consensus-aware validatePrd, reportStatus, scanWorkspaces
- Dashboard CLI command

**Phase-B: Orchestrate SKILL.md** — `.claude/skills/orchestrate/SKILL.md`
- Iron laws + quality protocol + rationalization tables → CLAUDE.md template
- Model tiering variables + escalation/de-escalation → ralph-loop.sh template
- VERIFY.md template + consensus detection → ralph-loop.sh template
- Rollback/recovery (snapshot tags + failure_log.json)
- Pattern propagation (patterns.json)
- Update Phase 3c launch examples and execution.md template item

**Phase-D: Ralph skill files** — all three ralph files
- Rationalization tables
- Consensus format example + conversion rule 7

**Phase-E: New skills** — debug, review, tdd (9 new files)
- Each skill: SKILL.md + agents/.md + prompts/.prompt.md

### Group 2 — Sequential (after Phase-B)

**Phase-C: Copilot orchestrate files** — `phase.md` + `phase.prompt.md`
- Mirror all Phase-B changes, adapted for Copilot tool names and variable syntax

---

## Testing Strategy

1. `npx tsc --noEmit` after Phase-A (TypeScript)
2. `node dist/index.js validate <legacy-prd.json>` — must pass
3. `node dist/index.js validate <consensus-prd.json>` — must pass
4. `node dist/index.js validate <malformed-consensus-prd.json>` — must error
5. `node dist/index.js status <prd.json>` — both formats display correctly
6. `node dist/index.js status-all <base-path>` — mixed directory works
7. Read-through of ralph-loop.sh template: model tiering + consensus + rollback + patterns present
8. Read-through of VERIFY.md template: iron laws, rationalization tables, VOTE output format
9. Read-through of new skills: debug 6-phase structure, review anti-trust, tdd RED-GREEN-REFACTOR

---

## Blockers

None identified. All three plan documents provide complete specifications.
