# Benchmark Strategy: orchestration-skills vs superpowers vs naive Ralph

---

## The Five Contestants

| # | System | Planning model | Execution model | Description |
|---|---|---|---|---|
| **A** | orchestration-skills (full) | Opus | Opus | Full phase workflow: plan → worktrees → prd.json → ralph-loop.sh |
| **B** | superpowers | Opus | Opus | Full pipeline: brainstorming → writing-plans → subagent-driven-development |
| **C** | naive Ralph | — | Opus | Raw `claude --print` loop with a basic CLAUDE.md and prd.json, no phases, no dependency analysis, no pattern propagation |
| **D** | orchestration-skills (tiered) | Opus | Sonnet | Same as A but ralph-loop.sh uses Sonnet for execution, Opus for planning only |
| **E** | orchestration-skills (aggressive) | Opus | Haiku | Same as A but ralph-loop.sh uses Haiku for execution with Opus escalation on 2x failure |

### Key Question for D and E
If tiered execution scores within 90% of A at 20-50% of the cost, the model tiering strategy is validated. See [Model Tiering Strategy](model_tiering_strategy.md) for full rationale and adaptive escalation logic.

---

## What to Measure (7 Dimensions)

| Metric | How to measure | Why it matters |
|---|---|---|
| **Task completion rate** | Stories with `passes: true` / total stories | Core effectiveness |
| **Code correctness** | Automated test suite pass rate on final output | Quality, not just "done" |
| **Token efficiency** | Total API tokens consumed (input + output) | Cost at scale |
| **Time to complete** | Wall-clock minutes from start to all-green | Practical speed |
| **Human interventions** | Count of times a human had to step in | Autonomy |
| **Recovery rate** | Failed attempts that self-corrected / total failures | Resilience |
| **Code quality score** | Lint warnings + type errors + code review rubric | Maintainability |

---

## The Benchmark Project

### Design Principles

The benchmark project must be:
- Complex enough to stress all three systems
- Reproducible (same starting point every run)
- Objectively measurable (automated test suite as ground truth)
- Representative of real work (not a toy)

### Approach: Pre-built Scaffold with Frozen Test Suite

Create a TypeScript project with:
- A complete test suite that **already exists but all tests fail** (RED state)
- Clear requirements mapped to test files
- Varying difficulty levels across tasks
- Intentional dependency chains between features

The benchmark score = how many tests go green + how fast + at what cost.

---

## Benchmark Tasks (3 Tiers)

### Tier 1 — Independent tasks (tests parallelism)

| ID | Task | Scope | Tests |
|---|---|---|---|
| T1 | Add input validation to an API endpoint | 1 file | 4 tests |
| T2 | Implement a date formatting utility | 1 file | 6 tests |
| T3 | Add pagination to a list endpoint | 2 files | 5 tests |
| T4 | Implement rate limiting middleware | 1 file | 3 tests |

### Tier 2 — Sequential dependencies (tests planning)

| ID | Task | Scope | Tests | Depends on |
|---|---|---|---|---|
| T5 | Create a user authentication module | 3 files | 8 tests | T1 |
| T6 | Add role-based access control | 2 files | 6 tests | T5 |
| T7 | Implement audit logging | 2 files | 4 tests | T5, T6 |

### Tier 3 — Cross-cutting refactors (tests recovery + quality)

| ID | Task | Scope | Tests | Depends on |
|---|---|---|---|---|
| T8 | Migrate all endpoints from callbacks to async/await | 5 files | 12 tests | — |
| T9 | Add comprehensive error handling with typed errors | 4 files | 7 tests | T8 |
| T10 | Integration test suite that exercises the full stack | 1 file | 10 tests | All |

**Total: 10 tasks, 65 tests, 3 dependency tiers.**

### Dependency Graph

```
Tier 1 (parallel):     T1    T2    T3    T4
                         \
Tier 2 (sequential):    T5 ──────┐
                         |       |
                        T6       |
                         \      /
                          T7 ──┘

Tier 3 (cross-cutting): T8 ──→ T9
                                 \
                        All ──→ T10
```

---

## Execution Protocol

```
For each system (A, B, C):
  1. Clone benchmark repo from clean tag v1.0.0
  2. Start timer
  3. Start token counter (proxy or API logging)
  4. Run the system with the same prompt:
     "Implement all features described in REQUIREMENTS.md.
      All tests in tests/ must pass."
  5. Log every human intervention (with timestamp and description)
  6. Stop when: all tests pass OR system declares done OR 60-min timeout
  7. Record: test results, token usage, time, interventions, git log
  8. Run post-hoc quality analysis: tsc --noEmit, eslint, code review rubric
```

---

## Handling the Control Variable Problem

Superpowers requires human interaction (dispatching tasks, reviewing). To make it fair:

| Option | Description | Pros | Cons |
|---|---|---|---|
| **Option 1** — Best-effort automation | Script the human responses for superpowers (always approve, always dispatch next) | Reproducible, tests systems as-designed | Handicaps superpowers' review advantage |
| **Option 2** — Human operator for all | One person runs all three, measures total human time + quality | Most realistic | Less reproducible |
| **Option 3** — Two runs each | One fully autonomous (human just starts it), one human-assisted | Reveals whether human-in-the-loop actually helps | Double the runs |

**Recommended: Option 3** — it reveals whether superpowers' human-in-the-loop actually produces better results or just slower ones.

---

## Scoring Formulas

### Performance Score (quality + completion)

```
PERF_SCORE = (tests_passed / total_tests) * 100   # max 100
           - (human_interventions * 5)             # penalty per intervention
           + (lint_clean ? 10 : 0)                 # quality bonus
           + (typecheck_clean ? 10 : 0)            # quality bonus
           + (zero_interventions ? 20 : 0)         # autonomy bonus
```

### Efficiency Score (cost-adjusted)

```
EFF_SCORE  = PERF_SCORE
           - (tokens_used / 100_000)               # cost penalty
           - (minutes_elapsed / 10)                 # time penalty
```

### Value Score (performance per dollar — the key metric for D and E)

```
VALUE_SCORE = PERF_SCORE / (estimated_cost_usd + 0.01)
```

Separating performance from efficiency lets us answer two questions:
1. Does tiered execution maintain quality? (compare PERF_SCORE of A vs D vs E)
2. Is the cost reduction worth it? (compare VALUE_SCORE across all five)

---

## Benchmark Deliverables

| File/Directory | Purpose |
|---|---|
| `benchmark/` | The TypeScript project with failing tests |
| `benchmark/REQUIREMENTS.md` | Task descriptions mapped to test files |
| `benchmark/run-benchmark.sh` | Harness that clones, times, and scores each run |
| `benchmark/configs/` | Setup files for each contestant (CLAUDE.md, prd.json, skill configs) |
| `benchmark/configs/contestant-d.env` | Model tiering config: `DEFAULT_MODEL=sonnet ESCALATION_MODEL=opus` |
| `benchmark/configs/contestant-e.env` | Aggressive tiering config: `DEFAULT_MODEL=haiku ESCALATION_MODEL=opus` |
| `benchmark/SCORING.md` | Rubric and formula documentation |

---

## Expected Outcomes (Hypotheses)

| Metric | A: orch-skills (Opus) | B: superpowers | C: naive Ralph | D: orch-skills (Sonnet) | E: orch-skills (Haiku) |
|---|---|---|---|---|---|
| Task completion | High | High | Medium | High (slight drop) | Medium-High (more failures) |
| Correctness | Medium-High | Highest | Medium | Medium (close to A) | Medium-Low (criteria drift) |
| Token efficiency | Medium | Low | Highest | High (5x cheaper exec) | Highest (19x cheaper exec) |
| Time to complete | Fastest | Slowest | Medium | Faster (Sonnet is quicker) | Fastest (Haiku is quickest) |
| Human interventions | Near zero | Many | Zero | Near zero | Low (some escalations) |
| Recovery rate | Medium | High | Low | Medium (escalation helps) | Low-Medium (more escalations) |
| Code quality | Medium | Highest | Lowest | Medium (slight drop) | Low-Medium |
| **Estimated cost** | ~$135 | ~$150+ | ~$90 | ~$63 | ~$50 |
| **Value score** | Baseline | Low (expensive + slow) | Medium (cheap but messy) | **Likely highest** | High if quality holds |

### Hypothesis to Validate

**D (Opus planning + Sonnet execution) will be the optimal configuration** — achieving 85-95% of A's quality at 45-55% of the cost. E (Haiku execution) will show diminishing returns where quality drops faster than cost, but with adaptive escalation may still outperform C (naive Ralph) on quality while being cheaper.

The critical threshold: if D's PERF_SCORE is within 10 points of A, model tiering is validated as the default execution strategy.
