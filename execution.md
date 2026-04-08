# Execution Plan

## Dependency Graph

```
Phase-A (src/types.ts + src/index.ts)   ──────────────────────────────────── Group 1
Phase-B (.claude/skills/orchestrate/SKILL.md) ──────────────────────────────── Group 1
Phase-D (ralph skill files) ─────────────────────────────────────────────────── Group 1
Phase-E (new skills: debug/review/tdd) ──────────────────────────────────────── Group 1
                                                                   │
                                                    Phase-B must complete
                                                                   │
Phase-C (.github/agents/phase.md + .github/prompts/phase.prompt.md) ──────── Group 2
```

## Parallel Execution Groups

### Group 1 — No dependencies (run simultaneously)

| Phase | Branch | Files touched |
|---|---|---|
| Phase-A | `phase-a-typescript` | `src/types.ts`, `src/index.ts` |
| Phase-B | `phase-b-orchestrate-skill` | `.claude/skills/orchestrate/SKILL.md` |
| Phase-D | `phase-d-ralph-skill` | `.claude/skills/ralph/SKILL.md`, `.github/agents/ralph.md`, `.github/prompts/ralph.prompt.md` |
| Phase-E | `phase-e-new-skills` | 9 new files (debug, review, tdd skills) |

### Group 2 — After Phase-B completes

| Phase | Branch | Dependency |
|---|---|---|
| Phase-C | `phase-c-copilot-sync` | Reads updated SKILL.md from Phase-B |

## Execution Order

1. **Start Group 1**: launch Phase-A, Phase-B, Phase-D, Phase-E simultaneously
2. **Wait**: Phase-B must exit 0 before Phase-C can start
3. **Start Group 2**: launch Phase-C after Phase-B completes
4. **Wait**: all phases complete
5. **Merge**: Phase-A → Phase-B → Phase-D → Phase-E → Phase-C (in that order)

## Critical Path

```
Phase-B (10 stories, largest file) → Phase-C (5 stories)
```

Phase-B is the bottleneck. Phase-A, Phase-D, Phase-E are unconstrained.

## Risk Assessment

| Risk | Affected phases | Mitigation |
|---|---|---|
| SKILL.md edit conflicts (large file, many sections) | Phase-B | Stories ordered by location in file; each story reads current state |
| Phase-C reads stale SKILL.md | Phase-C | Reads Phase-B worktree path explicitly |
| TypeScript compile failure | Phase-A | Each story runs `npm run build` before commit |
| Bash template syntax errors | Phase-B | Agent validates bash syntax via read-through |

## Model Strategy

| Phase | Default model | Rationale |
|---|---|---|
| Phase-A | sonnet | TypeScript changes are well-scoped |
| Phase-B | sonnet | Template edits are precise but large |
| Phase-C | sonnet | Sync work, well-specified |
| Phase-D | sonnet | Small targeted edits |
| Phase-E | sonnet | Creating new files from spec |

All phases: escalate to opus on 2+ consecutive failures.

## Actual Results

_(filled in during Phase 3c)_

| Phase | Started | Completed | Stories done | Notes |
|---|---|---|---|---|
| Phase-A | | | | |
| Phase-B | | | | |
| Phase-C | | | | |
| Phase-D | | | | |
| Phase-E | | | | |
