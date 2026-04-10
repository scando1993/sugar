# Benchmark Strategy: sugar vs superpowers vs naive Ralph

---

## The Seven Contestants

| # | System | Planning model | Execution model | Description |
|---|---|---|---|---|
| **A** | sugar (full) | Opus | Opus | Full phase workflow: plan → worktrees → prd.json → ralph-loop.sh |
| **B1** | superpowers (auto-approved) | Opus | Opus | Full pipeline: brainstorming → writing-plans → subagent-driven-development. Human responses auto-approved to test pure capability. |
| **B2** | superpowers (human-assisted) | Opus | Opus | Same as B1 but with a real human operator dispatching and reviewing. Tests whether human-in-the-loop actually improves results. |
| **C** | naive Ralph | — | Opus | Raw `claude --print` loop with a basic CLAUDE.md and prd.json, no phases, no dependency analysis, no pattern propagation. All-Opus execution (~50K tokens/story × 10 stories × 3 phases = ~1.5M tokens → ~$90). |
| **D** | sugar (tiered) | Opus | Sonnet | Same as A but ralph-loop.sh uses Sonnet for execution, Opus for planning only |
| **E** | sugar (aggressive) | Opus | Haiku | Same as A but ralph-loop.sh uses Haiku for execution with Opus escalation on 2x failure |
| **F** | sugar (adaptive) | Opus | Sonnet + Opus escalation | Same as D but with adaptive escalation: starts Sonnet, auto-escalates to Opus after 2 consecutive failures, de-escalates on success. See [Model Tiering Strategy](model_tiering_strategy.md) §Adaptive Escalation. |

### Key Questions
- **D, E, F vs A:** If tiered execution scores within 90% of A at 20-50% of the cost, the model tiering strategy is validated.
- **B1 vs B2:** Does human-in-the-loop actually produce better results, or just slower ones?
- **F vs D:** Does adaptive escalation recover enough failures to justify its ~10% cost premium ($69 vs $63)?

See [Model Tiering Strategy](model_tiering_strategy.md) for full rationale and adaptive escalation logic.

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
For each contestant (A, B1, B2, C, D, E, F):
  1. Clone benchmark repo from clean tag v1.0.0
  2. Start timer
  3. Start token logger (benchmark/token-logger/ — intercepts all API calls,
     records model, input_tokens, output_tokens, timestamp per call)
  4. Load contestant-specific config from benchmark/configs/
  5. Run the system with the same prompt:
     "Implement all features described in REQUIREMENTS.md.
      All tests in tests/ must pass."
  6. Log every human intervention (with timestamp, description, and duration)
     - For B1: auto-approve all prompts (log each auto-approval)
     - For B2: human operator responds naturally (log each interaction)
     - For A, C, D, E, F: log only if the system halts and requires input
  7. Stop when: all tests pass OR system declares done OR 60-min timeout
  8. Record: test results, measured token usage, measured cost, time, interventions, git log
  9. Run post-hoc quality analysis: tsc --noEmit, eslint, code review rubric
  10. Calculate PERF_SCORE, EFF_SCORE, VALUE_SCORE using measured data
```

---

## Handling the Control Variable Problem

Superpowers requires human interaction (dispatching tasks, reviewing). To make it fair:

| Option | Description | Pros | Cons |
|---|---|---|---|
| **Option 1** — Best-effort automation | Script the human responses for superpowers (always approve, always dispatch next) | Reproducible, tests systems as-designed | Handicaps superpowers' review advantage |
| **Option 2** — Human operator for all | One person runs all three, measures total human time + quality | Most realistic | Less reproducible |
| **Option 3** — Two runs each | One fully autonomous (human just starts it), one human-assisted | Reveals whether human-in-the-loop actually helps | Double the runs |

**Recommended: Option 3** — it reveals whether superpowers' human-in-the-loop actually produces better results or just slower ones. This is why the contestant table splits B into B1 (auto-approved) and B2 (human-assisted).

---

## Scoring Formulas

### Performance Score (quality + completion)

```
PERF_SCORE = (tests_passed / total_tests) * 100   # max 100
           + (lint_clean ? 10 : 0)                 # quality bonus
           + (typecheck_clean ? 10 : 0)            # quality bonus
           + (zero_interventions ? 20 : 0)         # autonomy bonus (lost if ANY intervention)
```

**Bounds: 0–140.** The autonomy bonus is the sole penalty for human intervention — no additional per-intervention deduction, to avoid double-penalizing human-in-the-loop systems like B2. A system that completes all tests with clean quality but needed human help scores max 120; a fully autonomous equivalent scores 140.

### Efficiency Score (cost-adjusted)

```
EFF_SCORE  = PERF_SCORE
           - (measured_tokens / 100_000)            # -1 per 100K tokens consumed
           - (minutes_elapsed / 10)                 # -1 per 10 minutes wall-clock
```

Uses **measured** token counts, not estimates. Can go negative for extremely expensive/slow runs.

### Value Score (performance per dollar — the key metric for D, E, and F)

```
VALUE_SCORE = PERF_SCORE / (measured_cost_usd + (minutes_elapsed / 60))
```

Uses **measured cost** from the token counter (not pre-estimated costs — those are hypotheses, not data). Time is included as a normalizing factor: 60 minutes of wall-clock adds $1 equivalent to the denominator, so faster systems with equal quality and cost rank higher.

**Important:** `measured_cost_usd` is calculated from actual API token logs:
```
measured_cost_usd = (input_tokens × model_input_price + output_tokens × model_output_price)
                    summed across all API calls for the run
```

Separating performance from efficiency lets us answer three questions:
1. Does tiered execution maintain quality? (compare PERF_SCORE of A vs D vs E vs F)
2. Is the cost reduction worth it? (compare VALUE_SCORE across all seven)
3. Does adaptive escalation justify its cost premium? (compare VALUE_SCORE of F vs D)

---

## Benchmark Deliverables

| File/Directory | Purpose |
|---|---|
| `benchmark/` | The TypeScript project with failing tests |
| `benchmark/REQUIREMENTS.md` | Task descriptions mapped to test files |
| `benchmark/run-benchmark.sh` | Harness that clones, times, scores, and logs token usage for each run |
| `benchmark/configs/` | Setup files for each contestant (CLAUDE.md, prd.json, skill configs) |
| `benchmark/configs/contestant-b1.env` | Superpowers auto-approved config |
| `benchmark/configs/contestant-b2.env` | Superpowers human-assisted config |
| `benchmark/configs/contestant-d.env` | Model tiering config: `DEFAULT_MODEL=sonnet ESCALATION_MODEL=opus` |
| `benchmark/configs/contestant-e.env` | Aggressive tiering config: `DEFAULT_MODEL=haiku ESCALATION_MODEL=opus` |
| `benchmark/configs/contestant-f.env` | Adaptive config: `DEFAULT_MODEL=sonnet ESCALATION_MODEL=opus ESCALATION_THRESHOLD=2` |
| `benchmark/SCORING.md` | Rubric and formula documentation (bounds, edge cases, measurement protocol) |
| `benchmark/token-logger/` | Proxy or wrapper that logs all API calls with model, token counts, and timestamps |

---

## Expected Outcomes (Hypotheses)

> **Note:** All cost figures below are **hypotheses to be validated**, not predetermined results. The benchmark MUST measure actual token consumption via the token logger. The "estimated cost" row reflects pre-benchmark expectations; VALUE_SCORE will use measured costs.

| Metric | A: orch-skills (Opus) | B1: superpowers (auto) | B2: superpowers (human) | C: naive Ralph (Opus) | D: orch-skills (Sonnet) | E: orch-skills (Haiku) | F: orch-skills (adaptive) |
|---|---|---|---|---|---|---|---|
| Task completion | High | High | High | Medium | High (slight drop) | Medium-High (more failures) | High (escalation recovers) |
| Correctness | Medium-High | Medium-High | Highest | Medium | Medium (close to A) | Medium-Low (criteria drift) | Medium-High (Opus catches hard cases) |
| Token efficiency | Medium | Low | Low | Medium | High (5x cheaper exec) | Highest (19x cheaper exec) | High (mostly Sonnet) |
| Time to complete | Fast | Slow | Slowest | Medium | Faster (Sonnet is quicker) | Fastest (Haiku is quickest) | Fast (Sonnet + occasional Opus) |
| Human interventions | Near zero | Zero (scripted) | Many | Zero | Near zero | Low (some escalations) | Near zero |
| Recovery rate | Medium | Low (no retry loop) | High (human catches errors) | Low | Medium | Low-Medium | Medium-High (escalation helps) |
| Code quality | Medium | Medium | Highest | Lowest | Medium (slight drop) | Low-Medium | Medium |
| **Estimated cost** | ~$135 | ~TBD (measured) | ~TBD (measured) | ~$90 | ~$63 | ~$50 | ~$69 |
| **Value score** | Baseline | TBD | TBD | Medium (cheap but messy) | **Likely highest** | High if quality holds | High (best cost/quality tradeoff?) |

### Cost Breakdown for Contestant C (Naive Ralph)

C uses all-Opus with no phases or planning overhead:
- 10 stories × ~50K tokens/story = ~500K tokens per phase
- 3 phases × 500K = ~1.5M total tokens
- At Opus pricing ($15/1M input, $75/1M output, ~50/50 split): ~$90
- No planning cost (no Opus planning phase) — but also no dependency analysis, so more wasted iterations

### Hypotheses to Validate

1. **D (Opus planning + Sonnet execution) will be the optimal VALUE_SCORE configuration** — achieving 85-95% of A's quality at 45-55% of the cost.

2. **F (adaptive escalation) will have the best PERF_SCORE among tiered contestants** — the ~10% cost premium over D ($69 vs $63) should recover enough failures to close the quality gap with A.

3. **E (Haiku execution) will show diminishing returns** — quality drops faster than cost, but with adaptive escalation may still outperform C (naive Ralph) on quality while being cheaper.

4. **B1 vs B2 will reveal whether human-in-the-loop adds quality or just time** — if B1 and B2 have similar PERF_SCORES, the human bottleneck is pure overhead.

5. **Critical threshold:** if D's PERF_SCORE is within 10 points of A, model tiering is validated as the default execution strategy.
