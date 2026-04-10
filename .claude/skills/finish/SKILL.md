---
name: finish
description: "Branch finishing and PR preparation. Use when completing a feature branch, preparing a pull request, or cleaning up commit history before merge."
user-invocable: true
---

# Branch Finishing & PR Preparation

## Iron Law
`NEVER MERGE WITHOUT ALL CHECKS PASSING — GREEN CI IS NON-NEGOTIABLE`

## Steps

### 1. Verify
Run full quality checks before anything else.
- Typecheck: `npx tsc --noEmit` (or equivalent)
- Lint: `npx eslint .` (or equivalent)
- Tests: `npm test` (or equivalent)
- ALL must pass. If any fail, fix before proceeding.

### 2. Rebase
Rebase onto the target branch to ensure a clean history.
```bash
git fetch origin
git rebase origin/<target-branch>
```
- Resolve conflicts one commit at a time
- Re-run quality checks after resolving conflicts
- Never squash during rebase — that's the next step

### 3. Clean History
Interactive rebase to tidy the commit log.
- Squash fixup commits (typo fixes, "oops" commits)
- Reword unclear commit messages
- Each remaining commit should be atomic and buildable
- Preserve meaningful commit boundaries — don't squash everything into one

### 4. Write PR Description
Create a structured PR description:
- **Summary**: What changed and why (2-3 sentences)
- **Test plan**: How to verify the changes work
- **Breaking changes**: List any, or state "None"
- **Related issues**: Link to tickets/issues

### 5. Self-Review
Read the complete diff before anyone else sees it.
```bash
git diff <target-branch>...HEAD
```
- Read every changed line
- Flag anything that looks wrong, incomplete, or confusing
- Check for: debug code, TODO comments, hardcoded values, missing error handling
- Fix issues found — don't leave them for reviewers

### 6. Push & Create PR
Push the branch and create the pull request.
- Push with `-u` to set upstream tracking
- Create PR with the prepared description
- Request appropriate reviewers
- Add labels if applicable

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "Tests are slow, I'll skip them this once" | Run them. The one time you skip is the time they'd catch a bug. |
| "I'll squash everything into one commit" | Atomic commits tell a story. Squash only fixups, not meaningful changes. |
| "The PR description can be brief, reviewers will read the code" | Reviewers need context. A good description saves review time. |
| "I'll fix that in a follow-up PR" | Fix it now. Follow-up PRs get deprioritized and forgotten. |

## Rules
- All quality checks must pass before creating a PR
- Each commit must be atomic and independently buildable
- PR description must include summary and test plan
- Self-review the complete diff before pushing
- Never push code you haven't read yourself
