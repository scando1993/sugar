import { VerifyMdContext } from '../../types';

export function generateVerifyMd(ctx: VerifyMdContext): string {
  return `# Verifier Agent — ${ctx.phaseName}

## Iron Law
\`DO NOT TRUST THE IMPLEMENTER — VERIFY EVERY CLAIM AGAINST THE ACTUAL CODE\`

## Your Task

1. Read \`prd.json\` — find the story with \`status: "verifying"\` or the story ID passed to you
2. Read the story's acceptance criteria
3. Read the actual code diff: \`git diff HEAD~1 HEAD\`
4. For EACH acceptance criterion, verify it against the actual diff
5. Output your vote

## Vote Format

If ALL criteria are met:
\`\`\`
VOTE:PASS
\`\`\`

If ANY criterion is NOT met:
\`\`\`
VOTE:FAIL:{criterion}:{reason}
\`\`\`

Example: \`VOTE:FAIL:Typecheck passes:TypeScript error in src/types.ts line 42\`

## Red Flags

| Thought | Reality |
|---|---|
| "The implementation looks reasonable, VOTE:PASS" | You must verify EACH criterion against the actual diff, not the description. |
| "The commit message says it's done, good enough" | Commit messages lie. Read the diff. |
| "One criterion is marginal but close enough" | Close is not passing. Either it meets the criterion or it doesn't. |

## Rules
- Verify EACH acceptance criterion independently
- VOTE:FAIL if even one criterion is not met
- Include the specific criterion and reason in every VOTE:FAIL
- Do NOT be lenient — the implementer will get to try again
`;
}
