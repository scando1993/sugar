# TODO: Library Extraction Refactor

## Phase A — Core Types + Interfaces
- [x] Expand `src/types.ts` with config schema (`SugarConfig`: models, quorum, escalation thresholds, quality commands)
- [x] Add event types (`StoryStarted`, `StoryPassed`, `StoryFailed`, `VoteCast`, `PhaseComplete`, `ModelEscalated`)
- [x] Add dependency graph types (`PhaseNode`, `DependencyEdge`, `ParallelGroup`, `CriticalPath`)
- [x] Add workspace types (`WorkspaceConfig`, `PhaseWorkspace`)
- [x] Add template context types (`ClaudeMdContext`, `VerifyMdContext`, `RalphLoopContext`)

## Phase B — Library Modules
_Depends on: Phase A_

### B1 — Model Tiering (`src/lib/model-tier.ts`)
- [x] Implement `ModelTier` class: tracks consecutive failures, current model, escalation/de-escalation
- [x] `escalate()` — switch to escalation model after N failures
- [x] `deescalate()` — revert to default model after success
- [x] `recordResult(success: boolean)` — update state
- [x] Configurable thresholds via `SugarConfig`

### B2 — Consensus Engine (`src/lib/consensus.ts`)
- [x] Implement `ConsensusEngine` class
- [x] `runQuorum(storyId, quorumSize)` — spawn verifier invocations, collect votes
- [x] `tallyVotes(votes[])` — determine pass/fail based on `requiredMajority`
- [x] `recordVote(storyId, vote)` — append to prd.json votes array
- [x] `updateStoryStatus(storyId, 'passed' | 'rejected')` — write prd.json
- [x] Handle rejection logging → `rejection_log.txt`
- [x] Term management — increment term on rejection

### B3 — Ralph Loop Engine (`src/lib/ralph-loop.ts`)
- [x] Implement `RalphLoop` class
- [x] `pickNextStory(prd)` — highest priority pending/rejected story
- [x] `createSnapshot(storyId, attempt)` — git tag `attempt-US-XXX-vN`
- [x] `runIteration(workspace)` — single story implementation cycle
- [x] `recordProgress(storyId, result, learnings)` — append to progress.txt
- [x] `recordFailure(storyId, attempt, error)` — write to failure_log.json after 3 fails
- [x] `isPhaseComplete(prd)` — all stories passed check
- [x] Integrate with `ModelTier` for escalation
- [x] Integrate with `ConsensusEngine` for verification

### B4 — Dependency Analyzer (`src/lib/dependency.ts`)
- [x] `analyzeDependencies(plan)` — parse plan.md, map produces/consumes per phase
- [x] `buildGraph(phases[])` — directed acyclic graph of phase dependencies
- [x] `findParallelGroups(graph)` — group phases by dependency level
- [x] `findCriticalPath(graph)` — longest chain analysis
- [x] `detectCircular(graph)` — halt on circular deps
- [x] `toAscii(graph)` — ASCII visualization for execution.md

### B5 — Pattern Propagation (`src/lib/patterns.ts`)
- [x] `extractPatterns(progressTxt)` — parse Codebase Patterns section from progress.txt
- [x] `mergePatterns(existing, discovered)` — deduplicate + merge into patterns.json
- [x] `injectPatterns(claudeMd, patterns[])` — insert into ## Known Patterns section
- [x] Read/write `patterns.json` at repo root

### B6 — Workspace Manager (`src/lib/workspace.ts`)
- [x] `createWorkspace(phase, config)` — git worktree add + branch
- [x] `initProgress(workspace)` — write initial progress.txt
- [x] `generateFiles(workspace, context)` — write CLAUDE.md, VERIFY.md, ralph-loop.sh, prd.json
- [x] `destroyWorkspace(workspace)` — git worktree remove + branch delete
- [x] `listWorkspaces(basePath)` — scan for phase directories
- [x] `cleanupAll(basePath)` — destroy all + prune

## Phase C — Template Generators
_Depends on: Phase A, Phase B_

### C1 — CLAUDE.md Generator (`src/lib/templates/claude-md.ts`)
- [x] `generateClaudeMd(context: ClaudeMdContext)` — produce full CLAUDE.md from context
- [x] Include: iron laws, task steps, quality protocol, red flags table, model escalation signal
- [x] Parameterize: branch name, phase scope, task description, known patterns, dependencies satisfied
- [x] Output: string (written by workspace manager)

### C2 — VERIFY.md Generator (`src/lib/templates/verify-md.ts`)
- [x] `generateVerifyMd(context: VerifyMdContext)` — produce VERIFY.md
- [x] Include: iron law, vote format, red flags table
- [x] Parameterize: phase name

### C3 — ralph-loop.sh Generator (`src/lib/templates/ralph-loop-sh.ts`)
- [x] `generateRalphLoop(context: RalphLoopContext)` — produce ralph-loop.sh
- [x] Replace inline Python with `sugar story-update <storyId> <status>` calls
- [x] Replace inline consensus logic with `sugar verify <storyId>` calls
- [x] Parameterize: phase name, max iterations, default model, escalation model
- [x] Script still calls `claude` CLI for agent execution — library handles state

## Phase D — Orchestrator + CLI
_Depends on: Phase B, Phase C_

### D1 — Orchestrator (`src/lib/orchestrator.ts`)
- [x] Implement `Orchestrator` class — phase state machine
- [x] `plan(task)` — Phase 1: produce plan.md + todo.md (guidance only, agent still does the thinking)
- [x] `setup(plan)` — Phase 2: create workspaces via workspace manager
- [x] `analyze(plan)` — Phase 3a: run dependency analysis
- [x] `generatePrds(plan, analysis)` — Phase 3b: generate execution.md + workspace files
- [x] `execute(analysis)` — Phase 3c: launch ralph loops by parallel group, wait, propagate patterns
- [x] `merge(analysis)` — Phase 4: generate merge_order.md, optionally auto-merge
- [x] State persistence — resume from any phase

### D2 — New CLI Commands (`src/index.ts`)
- [x] `sugar run <task>` — full orchestration (Phase 1-4 with approval gates)
- [x] `sugar workspace create <phase> [--branch]` — create single workspace
- [x] `sugar workspace destroy <phase>` — cleanup single workspace
- [x] `sugar workspace list` — list all workspaces
- [x] `sugar analyze <plan.md>` — run dependency analysis, output execution.md
- [x] `sugar generate <workspace>` — generate CLAUDE.md + VERIFY.md + ralph-loop.sh + prd.json
- [x] `sugar verify <storyId> [--workspace]` — run consensus verification
- [x] `sugar story-update <storyId> <status> [--workspace]` — update story in prd.json
- [x] `sugar merge [--auto]` — generate merge_order.md, optionally auto-merge
- [x] `sugar config init` — create sugar.config.json with defaults
- [x] Keep existing commands: `validate`, `status`, `status-all`, `dashboard`, `brainstorm`

### D3 — Config System
- [x] Define `sugar.config.json` schema
- [x] `loadConfig()` — read config, merge with defaults
- [x] Defaults: `{ models: { default: "sonnet", escalation: "opus" }, consensus: { quorumSize: 3, requiredMajority: 2 }, escalation: { threshold: 2 }, qualityChecks: ["npm run typecheck", "npm run lint", "npm test"] }`

## Phase E — Thin Skills Refactor
_Depends on: Phase D_

### E1 — Claude Code Skills (`.claude/skills/`)
- [x] Refactor `orchestrate/SKILL.md` — keep behavioral sections (iron laws, red flags, prompt repetition), replace procedural logic with `sugar <command>` calls
- [x] Refactor all other skills that embed execution logic
- [x] Verify skills work both standalone (full markdown) AND with library (CLI delegation)

### E2 — GitHub Copilot (`.github/agents/` + `.github/prompts/`)
- [x] Sync thinned-down logic from Claude Code skills
- [x] Verify `@sugar` agent still works

### E3 — Cursor (`.cursor/rules/`)
- [x] Sync thinned-down logic

### E4 — Windsurf (`.windsurf/rules/`)
- [x] Create Windsurf rules (new platform)
- [x] Sync from thinned-down skill logic

### E5 — Cline (`.cline/rules/`)
- [x] Create Cline rules (new platform)
- [x] Sync from thinned-down skill logic

### E6 — Codex (`.agents/skills/`)
- [x] Sync thinned-down logic

### E7 — OpenCode (`.opencode/agents/`)
- [x] Sync thinned-down logic

### E8 — Gemini CLI (`.gemini/skills/`)
- [x] Sync thinned-down logic

## Phase F — Tests
_Depends on: Phase B, Phase C, Phase D_

- [x] Unit tests for `model-tier.ts` — escalation/de-escalation thresholds
- [x] Unit tests for `consensus.ts` — vote tallying, majority calculation, term management
- [x] Unit tests for `ralph-loop.ts` — story picking, phase complete detection, failure logging
- [x] Unit tests for `dependency.ts` — graph building, parallel groups, circular detection, critical path
- [x] Unit tests for `patterns.ts` — extraction, merge, injection
- [x] Unit tests for `workspace.ts` — workspace creation/cleanup (mock git)
- [x] Unit tests for template generators — output matches expected format
- [x] Integration test: full orchestration cycle with mock agent
- [x] Set up test runner (vitest or jest) in package.json
