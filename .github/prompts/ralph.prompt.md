---
name: 'ralph'
description: 'Convert a PRD to prd.json format for Ralph-style autonomous agent execution. Triggers on: convert prd, create prd.json, ralph format.'
agent: 'agent'
tools:
  - 'read_file'
  - 'write_file'
argument-hint: '<path to PRD markdown file>'
---

# Ralph PRD Converter

Convert the PRD at ${input} to `prd.json` format.

## Output Format

```json
{
  "project": "[Project Name]",
  "branchName": "[branch-name-kebab-case]",
  "description": "[Feature description]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[Story title]",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": ["Criterion 1", "Typecheck passes"],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Rules

1. **Story size**: Each story completable in one agent pass. If 2-3 sentences can't describe it, split it.
2. **Ordering**: Dependencies first. Schema → backend → UI → validation.
3. **Acceptance criteria**: Must be verifiable. Always include "Typecheck passes".
4. **IDs**: Sequential (US-001, US-002, etc.)
5. **All stories**: `passes: false`, empty `notes`
