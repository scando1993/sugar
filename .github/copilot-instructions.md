This repository contains an orchestration skill for phased software engineering execution.

The skill drives large engineering tasks (refactors, migrations, feature work, testing efforts) through a strict multi-phase workflow: planning → workspace setup → dependency analysis → PRD-driven implementation → merge.

Each implementation phase follows the Ralph agent pattern (https://github.com/snarktank/ralph): one user story at a time, atomic commits, progress tracking, and pattern consolidation.

Key files to understand:
- `.claude/skills/orchestrate/SKILL.md` — the Claude Code version of the skill
- `.github/prompts/phase.prompt.md` — the Copilot version of the skill
- `src/` — TypeScript CLI utilities for plan validation

When working in this repo, follow the phased execution discipline: plan before coding, isolate work per phase, commit atomically, and track progress in managed files (`plan.md`, `todo.md`, `execution.md`, `prd.json`, `progress.txt`, `merge_order.md`).
