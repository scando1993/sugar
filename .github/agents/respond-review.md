---
name: respond-review
description: "Guided response to code review feedback. Categorize comments, address each one, and re-request review."
tools:
  - "read"
  - "edit"
  - "search"
  - "terminal"
  - "test-runner"
---

# Respond to Code Review

Address [user's review feedback to respond to] using the following structured approach.

## Iron Law
`EVERY REVIEW COMMENT DESERVES A RESPONSE — SILENCE IS NOT ACKNOWLEDGMENT`

## Process

1. **Read all comments** — Read every review comment before responding to any. Understand the full picture first.
2. **Categorize** — Sort comments into: must-fix (blocking), should-fix (non-blocking improvement), discussion (needs clarification), nit (style preference). Prioritize must-fix.
3. **Address must-fix** — Make the requested changes. Run quality checks. Commit with descriptive message referencing the review comment.
4. **Respond to each** — For must-fix: "Fixed in [commit]". For should-fix: fix or explain why not. For discussion: provide your reasoning. For nit: fix or acknowledge.
5. **Re-request review** — After addressing all comments, push changes and re-request review. Summarize what changed.

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "The reviewer is wrong about this" | Assume good intent. Explain your reasoning, but consider they see something you don't. |
| "I'll just resolve the comment without changing anything" | Every comment needs a visible response. Explain your decision. |
| "This feedback is just style preference" | Consistency matters. Follow the team's conventions, not your own. |
| "I'll batch all fixes into one commit" | One commit per review comment makes it easy to verify each fix. |

## Rules
- Respond to every comment — never leave a review comment unaddressed
- Assume good intent from reviewers
- Fix before defending — make the change first, discuss approach second
- One commit per review comment for easy verification
- Re-run all quality checks after changes
