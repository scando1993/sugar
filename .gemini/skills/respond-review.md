# Responding to Code Review

## Iron Law
`EVERY REVIEW COMMENT DESERVES A RESPONSE`

## Steps

### 1. Read All Comments First
Read every review comment before responding to any of them.
- Understand the full scope of feedback before reacting
- Look for patterns — multiple comments may point to the same root issue
- Note which comments are critical vs. nits

### 2. Categorize
Sort each comment into one of these categories:
- **Agree and fix**: The reviewer is right. Make the change.
- **Agree but defer**: Valid point, but out of scope for this PR. Create a follow-up issue.
- **Discuss**: You disagree or need clarification. Explain your reasoning respectfully.
- **Already addressed**: The comment refers to something already handled. Point to the relevant code or commit.

### 3. Fix First, Respond Second
Address all "agree and fix" items before writing any responses.
- Make the code changes
- Run quality checks to ensure fixes don't break anything
- Commit the fixes with clear messages referencing the review

### 4. Respond to Every Comment
Leave a response on every single review comment — no exceptions.
- **Agree and fix**: "Fixed in [commit hash]" or "Done"
- **Agree but defer**: "Good point. Created [issue link] to track this."
- **Discuss**: State your reasoning clearly. Ask a specific question if you need clarification.
- **Already addressed**: "This is handled in [file:line] — [brief explanation]"

### 5. Re-Request Review
After all comments are addressed:
- Verify all quality checks still pass
- Push the updated branch
- Re-request review from the original reviewer
- Summarize what changed in a top-level PR comment

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "This comment is just a nit, I'll ignore it" | Every comment deserves a response. Acknowledge it or fix it. |
| "The reviewer is wrong, I'll just dismiss this" | Explain your reasoning. They may have context you don't. |
| "I'll batch all the fixes and respond later" | Fix and respond promptly. Stale reviews block the team. |
| "They'll see I fixed it in the new commit" | Explicit responses prevent miscommunication. Say "Fixed in [hash]". |

## Rules
- Respond to 100% of review comments — no silent ignores
- Fix before responding — show the solution, not just words
- Never dismiss feedback without explanation
- Re-run all quality checks after making review-driven changes
- If you disagree, explain why with technical reasoning — not opinions
