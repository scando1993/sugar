---
name: 'prd'
description: 'Generate a Product Requirements Document for a feature. Use when planning a feature or creating requirements.'
agent: 'agent'
tools:
  - 'read_file'
  - 'write_file'
  - 'codebase_search'
argument-hint: '<feature description>'
---

# PRD Generator

Create a detailed Product Requirements Document for: ${input}

## Process

1. Ask 3-5 clarifying questions with lettered options (e.g. "1A, 2C, 3B")
2. Generate a structured PRD
3. Save to `tasks/prd-[feature-name].md`

**Do NOT implement. Just document requirements.**

## PRD Structure

1. **Introduction** — what and why
2. **Goals** — specific, measurable objectives
3. **User Stories** — "As a [user], I want [feature] so that [benefit]" with verifiable acceptance criteria
4. **Functional Requirements** — numbered (FR-1, FR-2, etc.)
5. **Non-Goals** — what is explicitly out of scope
6. **Technical Considerations** — constraints, dependencies
7. **Success Metrics** — how to measure success
8. **Open Questions** — remaining unknowns

## Story Sizing

Each story must be completable in one focused agent pass. If you cannot describe the change in 2-3 sentences, split it.

Right-sized: add a component, update a module, write tests for one unit.
Too big: "build the dashboard", "add authentication" — split into smaller stories.

## Acceptance Criteria

Must be verifiable. Good: "Add status column with default 'pending'". Bad: "Works correctly".
Always include: "Typecheck passes". For UI stories: "Verify in browser".
