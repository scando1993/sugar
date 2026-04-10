# Git Worktree Management

## Iron Law
`NEVER MODIFY FILES IN A WORKTREE YOU DID NOT CREATE`

## Operations

### 1. Create
Create a new worktree for isolated development on a feature or phase.

```bash
git worktree add /tmp/<repo>-phases/<name> -b <branch-name>
```

- Always use a descriptive branch name: `phase-a-<scope>`, `feature/<name>`
- Place worktrees in `/tmp/` or a dedicated directory outside the main repo
- Initialize workspace files (progress.txt, CLAUDE.md, prd.json) immediately after creation

### 2. List
Show all active worktrees and their branches.

```bash
git worktree list
```

- Verify worktree state before starting work
- Check for stale or orphaned worktrees

### 3. Switch
Navigate between worktrees for inspection or work.

- Each worktree is a full working directory — `cd` into it
- Verify you are on the correct branch after switching: `git branch --show-current`
- Never work in the wrong worktree — check before every operation

### 4. Sync
Keep worktrees up to date with upstream changes when needed.

```bash
cd /tmp/<repo>-phases/<name>
git fetch origin
git rebase origin/main  # or merge, depending on strategy
```

- Only sync when explicitly needed (e.g., before merge phase)
- Resolve conflicts in the worktree where they appear
- Run quality checks after any sync

### 5. Cleanup
Remove completed or abandoned worktrees.

```bash
git worktree remove /tmp/<repo>-phases/<name> --force
git branch -D <branch-name>  # only if branch is fully merged or abandoned
git worktree prune
```

- Always prune after removing worktrees
- Verify the branch is merged before deleting it
- Repo-root tracking files are preserved; phase-local files are deleted with the worktree

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll just make a quick edit in this other worktree" | NEVER modify files in a worktree you did not create. Switch properly. |
| "I don't need to check which worktree I'm in" | Wrong worktree = wrong branch = wrong commits. Always verify. |
| "I'll clean up worktrees later" | Stale worktrees cause confusion and waste disk space. Clean up when done. |
| "I can skip the branch check after switching" | Branch mismatches cause commits on wrong branches. Verify every time. |

## Rules
- One worktree per phase or feature — never share worktrees between tasks
- Always verify your current worktree and branch before making changes
- Initialize workspace files immediately after creating a worktree
- Clean up worktrees as soon as a phase is complete or abandoned
- Never force-remove a worktree with uncommitted changes without explicit approval
