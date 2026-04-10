---
name: 'finish'
description: 'Branch finishing and PR preparation.'
agent: 'agent'
tools:
  - 'read_file'
  - 'edit_file'
  - 'codebase_search'
  - 'run_in_terminal'
  - 'run_tests'
argument-hint: '<branch name or PR preparation task>'
---

# Finish Branch

Finish ${input} using the following process.

## Iron Law
`NEVER MERGE WITHOUT ALL CHECKS PASSING — GREEN CI IS NON-NEGOTIABLE`

## Process

1. **Verify** — Run full quality checks (typecheck, lint, tests). All must pass before proceeding.
2. **Rebase** — `git rebase main` (or target branch). Resolve conflicts one commit at a time. Never squash during rebase.
3. **Clean history** — Interactive rebase to squash fixup commits, reword unclear messages. Each remaining commit should be atomic and descriptive.
4. **Write PR description** — Summary (what changed and why), test plan (how to verify), breaking changes (if any). Link to issue/ticket.
5. **Self-review** — `git diff main...HEAD`. Read every changed line. Flag anything that looks wrong.
6. **Push and create PR** — Push branch, create PR with the prepared description. Request reviewers.

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "Tests are slow, I'll skip them this once" | Run them. The one time you skip is the time they'd catch a bug. |
| "I'll squash everything into one commit" | Atomic commits tell a story. Squash only fixups, not meaningful changes. |
| "The PR description can be brief, reviewers will read the code" | Reviewers need context. A good description saves review time. |
| "I'll fix that in a follow-up PR" | Fix it now. Follow-up PRs get deprioritized and forgotten. |

## Rules
- All checks must pass before creating PR
- Each commit must be atomic and buildable
- PR description must include summary + test plan
- Self-review the diff before pushing
