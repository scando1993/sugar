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
\`sugar run\` (the loop driving this workspace) has already picked the story
for you and marked it \`"implementing"\` in prd.json before starting you —
you do not pick a story yourself, and you are never invoked when no story is
left to do.

## Your Task

1. Read \`prd.json\` in this directory — find the ONE story with \`status: "implementing"\`. That is your assignment for this iteration.
2. Read \`progress.txt\` — check the Codebase Patterns section first
2b. Check \`failure_log.json\` (if it exists) — if this story has prior failure entries, read them and plan a DIFFERENT approach than what was tried before
3. Verify you are on branch \`${ctx.branchName}\`. If not: \`git checkout ${ctx.branchName}\`
4. Implement that single user story
5. **Quality Protocol (per story):**
   1. Implement the story
   2. Self-review: Does implementation match ALL acceptance criteria? Check EACH one.
   3. Run quality checks: \`${qualityLine}\`
   4. If checks pass: verify against prd.json criteria ONE MORE TIME
   5. Only THEN proceed to step 6
   6. If anything fails at steps 2-4: fix, do NOT skip
6. Write \`.sugar-result.json\` in this directory as your FINAL action — this is what the loop reads to decide what happens next. Do NOT commit the code yourself; the loop commits only after the verifier quorum passes.
   - Implemented and ready for verification (storyId is the ID from step 1, e.g. "US-003"):
     \`{"storyId": "US-003", "outcome": "implemented"}\`
   - Genuinely stuck after real attempts (see step 7):
     \`{"outcome": "failed", "notes": "what you tried and why it didn't work"}\`
7. If checks fail, fix and retry (up to 3 attempts) before writing a \`"failed"\` result. When stuck:
   - Set the story's \`notes\` field in prd.json to describe the blocker
   - Append the failure to progress.txt
   - Leave the working tree as-is — the loop resets it (\`git checkout -- .\`) after reading your result

## Fallback output (only if you cannot write files for some reason)

If you cannot write \`.sugar-result.json\`, print one of these exactly as your last line instead —
the loop falls back to reading it, but the result file is authoritative when both are present:
- \`STORY_IMPLEMENTED:[Story ID]\`
- \`STORY_FAILED\`

## What happens after you stop

The loop reads your result, runs the verifier quorum against \`VERIFY.md\`, and:
- On consensus PASS: commits your changes and marks the story \`"passed"\`
- On consensus FAIL: resets your changes and marks the story \`"rejected"\` (or \`"blocked"\` if this story has failed too many times)

You do not need to push, check other stories' status, or decide whether the phase is complete —
the loop derives that from prd.json between iterations.

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
Read prd.json. Find the story with status "implementing" — that's yours. Implement it.
Run quality checks. Write .sugar-result.json. Stop. The loop handles verification and iteration.

## Known Patterns

${patternsSection}
`;
}