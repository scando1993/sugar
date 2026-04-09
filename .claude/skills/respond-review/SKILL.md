---
name: respond-review
description: "Guidance for receiving and responding to code review feedback. Use when addressing PR review comments, incorporating reviewer suggestions, or managing review discussions."
user-invocable: true
---

# Responding to Code Review

## Iron Law
`EVERY REVIEW COMMENT DESERVES A RESPONSE — SILENCE IS NOT ACKNOWLEDGMENT`

## Steps

### 1. Read All Comments
Read every review comment before responding to any.
- Understand the full picture first
- Note patterns — if multiple comments point to the same issue, address the root cause
- Don't start fixing until you've read everything

### 2. Categorize
Sort each comment into one of four categories:
- **Must-fix** (blocking): Bugs, security issues, correctness problems. The reviewer won't approve without these.
- **Should-fix** (non-blocking): Improvements to readability, performance, or maintainability. Good suggestions that make the code better.
- **Discussion** (needs clarification): The reviewer is asking a question or proposing an alternative approach. Requires a thoughtful response.
- **Nit** (style preference): Formatting, naming conventions, minor style points. Quick fixes.

Prioritize must-fix items.

### 3. Address Must-Fix
For each must-fix comment:
- Make the requested change
- Run quality checks (typecheck, lint, tests)
- Commit with a descriptive message referencing the review: `fix: address review — <description>`
- One commit per review comment for easy verification

### 4. Respond to Each
Every comment gets a visible response:
- **Must-fix**: "Fixed in [commit hash]" or "Fixed — [brief description of change]"
- **Should-fix**: Fix and note the change, OR explain why you chose not to (with reasoning)
- **Discussion**: Provide your reasoning. Acknowledge the alternative. If the reviewer's approach is better, say so and switch.
- **Nit**: Fix it (quick wins build goodwill), or acknowledge: "Good catch, fixed" / "I prefer X because Y, but happy to change if you feel strongly"

### 5. Re-Request Review
After addressing all comments:
- Push all changes
- Leave a summary comment: "Addressed all feedback — [brief list of changes]"
- Re-request review from the original reviewer
- Don't resolve conversation threads yourself — let the reviewer confirm

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "The reviewer is wrong about this" | Assume good intent. Explain your reasoning, but consider they see something you don't. |
| "I'll just resolve the comment without changing anything" | Every comment needs a visible response. Explain your decision. |
| "This feedback is just style preference" | Consistency matters. Follow the team's conventions, not your own. |
| "I'll batch all fixes into one commit" | One commit per review comment makes it easy to verify each fix. |

## Rules
- Respond to every comment — never leave any unaddressed
- Assume good intent from reviewers
- Fix before defending — if the suggestion improves the code, just do it
- One commit per review comment for traceability
- Re-run all quality checks after making changes
- Let reviewers resolve their own conversation threads
