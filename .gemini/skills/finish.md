# Branch Finishing / PR Prep

## Iron Law
`NEVER MERGE WITHOUT ALL CHECKS PASSING`

## Steps

### 1. Verify Completeness
Review the branch against its original requirements (PRD, user stories, or task description).
- Every acceptance criterion must be met
- Every story must have status "passed" in prd.json (if using Ralph)
- No pending TODOs or FIXME comments related to this branch's scope

### 2. Run Quality Checks
Execute the full quality suite before preparing the PR.

```bash
# Typecheck
npm run typecheck  # or equivalent

# Lint
npm run lint  # or equivalent

# Tests
npm run test  # or equivalent
```

- ALL checks must pass — no exceptions
- If any check fails, fix before proceeding

### 3. Clean Up History
Ensure the commit history is clean and meaningful.
- Each commit should represent one logical change
- Commit messages follow the project convention: `feat:`, `fix:`, `refactor:`, etc.
- No "WIP", "temp", or "debug" commits in the final history
- Squash or rebase if needed (with user approval)

### 4. Update Documentation
If the changes affect documented behavior:
- Update relevant README sections
- Update API docs if endpoints changed
- Update config examples if configuration changed

### 5. Create Pull Request
Write a clear PR description:
- **Summary**: What changed and why (1-3 bullet points)
- **Test plan**: How to verify the changes work
- **Breaking changes**: Any breaking changes and migration steps
- **Related issues**: Link to relevant issues or stories

### 6. Self-Review
Read through the entire diff one more time before submitting.
- Check for accidental debug logs, commented-out code, or leftover test data
- Verify no secrets or credentials are included
- Confirm the diff matches the PR description

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "Tests mostly pass, close enough" | ALL checks must pass. No exceptions. Fix the failures. |
| "I'll clean up the PR description later" | A vague PR description leads to a vague review. Write it properly now. |
| "This debug log won't matter" | Every line in the diff will be reviewed. Remove it. |
| "The reviewer will catch any issues" | You are the first reviewer. Catch issues yourself before wasting others' time. |

## Rules
- Never create a PR with failing checks
- Every PR needs a summary, test plan, and self-review
- Remove all debug artifacts before submitting
- Link to the original requirements (PRD, issue, or story)
- If the branch has merge conflicts with the target, resolve them before creating the PR
