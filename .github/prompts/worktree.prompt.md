---
name: 'worktree'
description: 'Git worktree lifecycle management. Create, list, switch, sync, and clean up worktrees for isolated parallel development.'
agent: 'agent'
tools:
  - 'read_file'
  - 'edit_file'
  - 'codebase_search'
  - 'run_in_terminal'
  - 'run_tests'
argument-hint: '<worktree operation: create, list, switch, sync, or cleanup>'
---

# Git Worktree Management

Manage ${input} using the following structured approach.

## Iron Law
`NEVER MODIFY FILES IN A WORKTREE YOU DID NOT CREATE — VERIFY YOUR WORKING DIRECTORY`

## Operations

### Create — Add a new worktree
Create an isolated worktree for parallel development with `git worktree add <path> -b <branch>`.
- Validate the target path does **NOT** already exist
- Validate the branch name does **NOT** already exist
- Validate the base branch is clean (no uncommitted changes)
- Use a descriptive branch name that matches the work being done

### List — Show all worktrees
List all active worktrees with `git worktree list`.
- Show the path, branch, and HEAD commit for each worktree
- Flag stale worktrees that have had no commits in 7+ days
- Identify worktrees whose branches have been merged or deleted on the remote

### Switch — Navigate to a worktree
Navigate to an existing worktree for continued work.
- Verify the worktree path exists before switching
- Show the worktree's current branch and recent commits
- Confirm the working directory is correct after switching

### Sync — Pull latest into a worktree
Pull the latest changes from the base branch into a worktree.
- Fetch from the remote before merging
- Handle conflicts by **reporting them**, not auto-resolving
- If conflicts exist, list each conflicted file and stop — let the user decide

### Cleanup — Remove a worktree
Remove a worktree with `git worktree remove <path>` and prune stale references.
- Check for uncommitted changes **before** removing
- If uncommitted changes exist, prompt the user to stash or commit first
- Run `git worktree prune` after removal to clean stale references
- Verify the worktree no longer appears in `git worktree list`

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "I'll just work in the main repo directory" | Use a worktree. Isolation prevents cross-contamination. |
| "I'll delete the directory manually" | Use `git worktree remove`. Manual deletion leaves stale references. |
| "I'll force-remove the worktree with uncommitted changes" | Check for uncommitted work first. Stash or commit before removing. |
| "I'll reuse an existing branch for a new worktree" | One branch per worktree. Create a fresh branch. |

## Rules
- ALWAYS verify your working directory before modifying any files
- NEVER force-remove a worktree without checking for uncommitted changes
- ALWAYS prune stale references after cleanup with `git worktree prune`
- ONE branch per worktree — never reuse a branch across worktrees
