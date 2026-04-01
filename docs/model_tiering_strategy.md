# Model Tiering Strategy

---

## Core Insight

The Ralph loop decouples planning intelligence from execution intelligence. Each `prd.json` story is small, well-scoped, dependency-ordered, and verifiable — a recipe. You need a chef to **write** the recipe, not to **follow** it.

**The better the prd.json stories, the dumber the execution model can be.**

---

## Phase-Level Model Assignment

| Phase | Task | Model | Reasoning |
|---|---|---|---|
| 1 (Planning) | plan.md, todo.md | **Opus** | Architecture, tradeoffs, dependency reasoning |
| 2 (Setup) | git worktrees, scaffolding | **Haiku** | Mechanical — mkdir, git commands |
| 3a (Analysis) | Dependency graph, critical path | **Opus** | Requires understanding the full system |
| 3b (PRD generation) | prd.json, CLAUDE.md, execution.md | **Opus** | Story quality determines execution success |
| 3c (Ralph loop) | Implement one story per iteration | **Sonnet** (default) | Well-scoped tasks with clear criteria |
| 3c (Ralph loop — retry) | Story failed 2x | **Opus** (escalate) | Something tricky — bring in the big model |
| 4 (Merge) | Conflict resolution, validation | **Opus** | Cross-branch reasoning |

---

## Adaptive Escalation in ralph-loop.sh

Start cheap and escalate on failure:

```bash
#!/bin/bash
# Ralph loop with model escalation — [phase-name]
# Usage: ./ralph-loop.sh [max_iterations] [default_model]

MAX_ITERATIONS=${1:-20}
DEFAULT_MODEL="${2:-sonnet}"
ESCALATION_MODEL="opus"
MAX_RETRIES=3
BASE_SLEEP=8
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CURRENT_MODEL="$DEFAULT_MODEL"
CONSECUTIVE_FAILURES=0
ESCALATION_THRESHOLD=2

echo "Starting Ralph loop — Phase: [phase-name]"
echo "Max iterations: $MAX_ITERATIONS"
echo "Default model: $DEFAULT_MODEL | Escalation model: $ESCALATION_MODEL"

# Stagger parallel phase starts
JITTER=$((RANDOM % 15))
[ "$JITTER" -gt 0 ] && echo "Stagger delay: ${JITTER}s" && sleep $JITTER

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "=== Iteration $i of $MAX_ITERATIONS (model: $CURRENT_MODEL) ==="

  OUTPUT=""
  RETRY_DELAY=10

  for attempt in $(seq 1 $MAX_RETRIES); do
    OUTPUT=$(claude --model "$CURRENT_MODEL" --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1) && break
    if echo "$OUTPUT" | grep -qiE "transient|rate.?limit|overload|503|529"; then
      echo "Transient error (attempt $attempt/$MAX_RETRIES) — retrying in ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
      RETRY_DELAY=$((RETRY_DELAY * 2))
    else
      break
    fi
  done

  echo "$OUTPUT"

  # Check for phase completion
  if echo "$OUTPUT" | grep -q "PHASE_COMPLETE"; then
    echo "Phase [phase-name] complete at iteration $i!"
    echo "Model usage: started with $DEFAULT_MODEL, ended with $CURRENT_MODEL"
    exit 0
  fi

  # Check if story failed — escalate model if needed
  if echo "$OUTPUT" | grep -qiE "STORY_FAILED|stuck|blocked|retry.?exhausted"; then
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    echo "Failure detected ($CONSECUTIVE_FAILURES consecutive)"

    if [ "$CONSECUTIVE_FAILURES" -ge "$ESCALATION_THRESHOLD" ] && [ "$CURRENT_MODEL" != "$ESCALATION_MODEL" ]; then
      echo ">>> Escalating from $CURRENT_MODEL to $ESCALATION_MODEL after $CONSECUTIVE_FAILURES failures"
      CURRENT_MODEL="$ESCALATION_MODEL"
    fi
  else
    # Success — reset to default model
    if [ "$CURRENT_MODEL" != "$DEFAULT_MODEL" ]; then
      echo ">>> De-escalating back to $DEFAULT_MODEL after successful iteration"
    fi
    CURRENT_MODEL="$DEFAULT_MODEL"
    CONSECUTIVE_FAILURES=0
  fi

  echo "Sleeping ${BASE_SLEEP}s before next story..."
  sleep $BASE_SLEEP
done

echo "Reached max iterations ($MAX_ITERATIONS). Check prd.json for status."
exit 1
```

---

## Cost Analysis

### Token pricing (per 1M tokens, input/output)

| Model | Input | Output | Relative cost |
|---|---|---|---|
| Opus | $15 | $75 | 1x (baseline) |
| Sonnet | $3 | $15 | ~5x cheaper |
| Haiku | $0.80 | $4 | ~19x cheaper |

### Cost per typical Ralph run (10 stories, ~50K tokens per story, 3 phases)

| Strategy | Planning cost | Execution cost | Total | Savings vs all-Opus |
|---|---|---|---|---|
| All Opus | ~$45 | ~$90 | ~$135 | — |
| All Sonnet | ~$9 | ~$18 | ~$27 | **80%** |
| All Haiku | ~$2.40 | ~$4.80 | ~$7.20 | **95%** |
| **Tiered: Opus plan + Sonnet exec** | ~$45 | ~$18 | ~$63 | **53%** |
| **Tiered: Opus plan + Haiku exec** | ~$45 | ~$4.80 | ~$50 | **63%** |
| **Adaptive: Opus plan + Sonnet exec + Opus escalation** | ~$45 | ~$24 (est.) | ~$69 | **49%** |

---

## The Virtuous Cycle

```
Better planning (Opus)
    → Clearer, more precise stories in prd.json
        → Cheaper model can follow them reliably
            → More budget available for planning
                → Even better stories
                    → Even cheaper execution
```

This is a structural advantage that compounds over time. The investment in Opus-quality planning pays for itself through cheaper execution — the marginal cost of adding one more story drops as story quality improves.

---

## Why Superpowers Cannot Do This

Superpowers recommends model selection ("cheap models for mechanical tasks, capable models for judgment tasks") but:

1. **No automation** — the human must manually choose the model for each subagent dispatch
2. **No escalation logic** — if a cheap model fails, the human must notice and re-dispatch
3. **No structured stories** — their plans are prose, so a cheap model has more room to misinterpret
4. **No loop** — each task is a one-shot dispatch, so there's no mechanism to retry with a bigger model

orchestration-skills automates all four: the loop script controls the model flag, detects failures, escalates automatically, and de-escalates after success.

---

## Implementation Checklist

- [ ] Add `--model` parameter to `ralph-loop.sh` template in Phase 3b
- [ ] Add `DEFAULT_MODEL` and `ESCALATION_MODEL` variables
- [ ] Add failure detection pattern matching (STORY_FAILED, stuck, blocked)
- [ ] Add escalation/de-escalation logic with configurable threshold
- [ ] Update `execution.md` template to document model strategy per phase
- [ ] Add model usage logging to `progress.txt` (track cost per story)
- [ ] Benchmark: measure quality delta between Opus-only and tiered execution
