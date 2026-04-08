# Merge Order

Base branch: `feature/benchmarks-suite`

## Merge sequence

1. **phase-a-typescript** (no conflicts expected — only src/ files)
2. **phase-b-orchestrate-skill** (no conflicts — only .claude/skills/orchestrate/SKILL.md)
3. **phase-d-ralph-skill** (no conflicts — only ralph skill files)
4. **phase-e-new-skills** (no conflicts — all new files)
5. **phase-c-copilot-sync** (no conflicts — only .github/agents/phase.md + phase.prompt.md)

## Rationale

- Phase-A first: TypeScript changes are independent and foundational
- Phase-B second: the primary SKILL.md change; no file overlap with Phase-A
- Phase-D + Phase-E: touch different files than A/B, no cross-dependencies
- Phase-C last: touches phase.md/phase.prompt.md which are different from all other phases

## Expected conflict areas

None — each phase touches a completely disjoint set of files:
- Phase-A: `src/types.ts`, `src/index.ts`
- Phase-B: `.claude/skills/orchestrate/SKILL.md`
- Phase-C: `.github/agents/phase.md`, `.github/prompts/phase.prompt.md`
- Phase-D: `.claude/skills/ralph/SKILL.md`, `.github/agents/ralph.md`, `.github/prompts/ralph.prompt.md`
- Phase-E: 9 new files (no existing file modifications)

## Post-merge validation

- [ ] `npm run build` — TypeScript compiles clean
- [ ] `node dist/index.js validate` — legacy prd.json passes
- [ ] `node dist/index.js status-all` — status command works
- [ ] Read-through: SKILL.md has all 10 story changes
- [ ] Read-through: 9 new skill files exist
- [ ] Read-through: ralph.md/ralph.prompt.md have rationalization tables

## Actual merge notes

_(filled in below)_
