---
name: ralph
description: "Convert PRDs to prd.json format for the Ralph autonomous agent system. Use when you have an existing PRD and need to convert it to Ralph's JSON format. Triggers on: convert this prd, turn this into ralph format, create prd.json, ralph json."
user-invocable: true
---

# Ralph PRD Converter

Converts existing PRDs to `prd.json` — the format that drives Ralph-style autonomous agent loops.

---

## Output Format

```json
{
  "project": "[Project Name]",
  "branchName": "phase-a-[scope-kebab-case]",
  "description": "[Feature description]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[Story title]",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": [
        "Criterion 1",
        "Criterion 2",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## The Number One Rule: Story Size

**Each story must be completable in ONE agent pass (one context window).**

Right-sized:
- Add a database column and migration
- Add a UI component to an existing page
- Update a server action with new logic
- Write tests for one module

Too big (split these):
- "Build the entire dashboard" → split into schema, queries, components, filters
- "Add authentication" → split into schema, middleware, login UI, session handling

**Rule of thumb:** If you cannot describe the change in 2-3 sentences, split it.

---

## Story Ordering: Dependencies First

Stories execute in priority order. Earlier stories must not depend on later ones.

**Correct order:**
1. Schema / database changes (migrations)
2. Server actions / backend logic
3. UI components that use the backend
4. Dashboard / summary views that aggregate data

---

## Acceptance Criteria: Must Be Verifiable

Each criterion must be something an agent can CHECK.

Good: "Add `status` column to tasks table with default 'pending'"
Bad: "Works correctly"

**Always include as final criterion:** `"Typecheck passes"`
**For testable logic:** also include `"Tests pass"`

---

## Conversion Rules

1. Each user story becomes one JSON entry
2. IDs: Sequential (US-001, US-002, etc.)
3. Priority: Based on dependency order, then document order
4. All stories: `passes: false` and empty `notes`
5. branchName: Derive from feature name, kebab-case
6. Always add "Typecheck passes" to every story

---

## Splitting Large PRDs

**Original:** "Add user notification system"

**Split into:**
1. US-001: Add notifications table to database
2. US-002: Create notification service
3. US-003: Add notification bell icon to header
4. US-004: Create notification dropdown panel
5. US-005: Add mark-as-read functionality

Each is one focused change that can be completed and verified independently.
