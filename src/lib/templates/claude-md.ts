import { ClaudeMdContext } from '../../types';

export function generateClaudeMd(ctx: ClaudeMdContext): string {
  const patternsSection = ctx.knownPatterns.length > 0
    ? ctx.knownPatterns.map(p => `- **${p.id}** (from ${p.learned_in}): ${p.description}`).join('\n')
    : '_(populated by orchestrator before this group starts)_\n\n[patterns injected from completed phases will appear here]';

  const depsLine = ctx.dependenciesSatisfied.length > 0
    ? ctx.dependenciesSatisfied.join(', ')
    : 'none — first parallel group';

  const qualityLine = ctx.qualityChecks.join(' && ');

  return `## Iron Laws
- \`ONE STORY PER ITERATION — IMPLEMENT ONE, THEN STOP\`
- \`NEVER COMMIT CODE THAT FAILS QUALITY CHECKS\`
- \`READ PROGRESS.TXT BEFORE WRITING A SINGLE LINE\`

# Ralph Agent — ${ctx.phaseName}

You are an autonomous coding agent. You handle ONE user story per invocation.

## Your Task

1. Read \`prd.json\` in this directory
2. Read \`progress.txt\` — check the Codebase Patterns section first
2b. Check \`failure_log.json\` (if it exists) — if the story you are about to implement has prior failure entries, read them and plan a DIFFERENT approach than what was tried before
3. Verify you are on branch \`${ctx.branchName}\`. If not: \`git checkout ${ctx.branchName}\`
4. Pick the **highest priority** user story where \`status\` is \`"pending"\` or \`"rejected"\`
   - If picking a \`"rejected"\` story: read \`rejection_log.txt\` first to understand what failed
   - After picking, set the story's \`status\` to \`"implementing"\` in prd.json
5. If no stories remain unfinished (no \`"pending"\` or \`"rejected"\`) → reply with: PHASE_COMPLETE
6. Implement that single user story
7. **Quality Protocol (per story):**
   1. Implement the story
   2. Self-review: Does implementation match ALL acceptance criteria? Check EACH one.
   3. Run quality checks: \`${qualityLine}\`
   4. If checks pass: verify against prd.json criteria ONE MORE TIME
   5. Only THEN commit
   6. If anything fails at steps 2-4: fix, do NOT skip
8. Output: \`STORY_IMPLEMENTED:[Story ID]\` — the loop handles the verifier quorum and commit
9. If checks fail → fix and retry (up to 3 attempts). If stuck:
   - Set the story's \`notes\` field in prd.json to describe the blocker
   - Append failure to progress.txt
   - \`git checkout -- .\` to reset unstaged changes

## Model Escalation
If you cannot complete a story after 3 attempts, output: STORY_FAILED
This signals the loop to escalate to a more capable model on the next iteration.
Do NOT output STORY_FAILED if you haven't genuinely attempted 3 times.

10. The loop updates \`status\` to \`"passed"\` or \`"rejected"\` after the quorum vote
11. Append progress to \`progress.txt\` (format below)
12. When ALL stories have \`status: "passed"\` → push: \`git push origin ${ctx.branchName}\`

## Stop Condition

After completing a story, check if ALL stories have \`status: "passed"\`.
If yes, push and reply with exactly: PHASE_COMPLETE
If no, end your response normally — the loop script will spawn a fresh iteration.

## Progress Report Format

APPEND to progress.txt (never replace):

## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context for other phases
---

## Codebase Patterns

If you discover a reusable pattern, add it to the \`## Codebase Patterns\`
section at the TOP of progress.txt. Only general, reusable patterns.

## Rules
- ONE story per iteration — implement one, then stop
- ALL commits must pass quality checks
- Do NOT commit broken code
- Follow existing code patterns
- Keep changes focused to this phase's scope

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll just implement two quick stories in one iteration" | ONE story per iteration. The loop handles iteration. No exceptions. |
| "The tests mostly pass, I'll commit and fix later" | ALL commits must pass quality checks. Broken commits poison every future iteration. |
| "This dependency isn't really needed, I'll skip it" | The dependency graph exists for a reason. Never start dependent work before prerequisites complete. |
| "I know what changed, I don't need to read progress.txt" | Progress.txt IS your memory. You have NO context without it. Read it FIRST. |
| "This is a trivial change, I don't need to run checks" | Every commit gets checked. No exceptions. The one you skip is the one that breaks everything. |
| "I'll refactor this while I'm here" | Stay in scope. Implement the story. Nothing more. |

## Context
- Original task: ${ctx.taskDescription}
- Phase scope: ${ctx.phaseScope}
- Workspace: ${ctx.workspacePath}
- Branch: ${ctx.branchName}
- Dependencies satisfied: ${depsLine}

## Task (repeated)
Read prd.json. Pick highest priority story where status is "pending" or "rejected". Implement ONE story.
Quality checks. Output STORY_IMPLEMENTED. Append progress. Stop. The loop handles iteration.

## Known Patterns

${patternsSection}
`;
}
