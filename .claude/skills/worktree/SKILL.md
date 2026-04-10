---
name: worktree
description: "Git worktree lifecycle management. Use when creating, navigating, syncing, or cleaning up git worktrees for parallel development."
user-invocable: true
---

# Git Worktree Management

## Iron Law
`NEVER MODIFY FILES IN A WORKTREE YOU DID NOT CREATE — VERIFY YOUR WORKING DIRECTORY`

## Operations

### 1. Create
Create a new worktree with an isolated branch.
```bash
git worktree add <path> -b <branch-name>
```
- Validate: target path doesn't already exist
- Validate: branch name doesn't already exist
- Base branch should be clean (no uncommitted changes)
- Initialize a `progress.txt` if this is a Ralph phase workspace

### 2. List
Show all active worktrees with their status.
```bash
git worktree list
```
- Show path, branch, and HEAD commit for each
- Flag stale worktrees (no commits in 7+ days)
- Flag worktrees with uncommitted changes

### 3. Switch
Navigate to an existing worktree.
- Verify the worktree exists before switching
- Show the branch name and recent commits on arrival
- Warn if the worktree has uncommitted changes from a prior session

### 4. Sync
Pull latest changes from the base branch into a worktree.
```bash
cd <worktree-path>
git fetch origin
git rebase origin/<base-branch>
```
- Handle conflicts by reporting them, NOT auto-resolving
- If conflicts exist, list the conflicting files and stop
- Never force-push after a sync

### 5. Cleanup
Remove a worktree and its branch.
```bash
git worktree remove <path>
git branch -D <branch-name>
git worktree prune
```
- Check for uncommitted changes BEFORE removing
- If uncommitted changes exist, warn and ask for confirmation
- Prune stale references after removal

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll just work in the main repo directory" | Use a worktree. Isolation prevents cross-contamination. |
| "I'll delete the directory manually" | Use `git worktree remove`. Manual deletion leaves stale references. |
| "I'll force-remove the worktree with uncommitted changes" | Check for uncommitted work first. Stash or commit before removing. |
| "I'll reuse an existing branch for a new worktree" | One branch per worktree. Create a fresh branch. |

## Rules
- Always verify your working directory before modifying files
- Never force-remove a worktree without checking for uncommitted changes
- Prune stale references after every cleanup
- One branch per worktree — never share branches across worktrees
- Document worktree purpose in progress.txt for Ralph workspaces
