# Plan: Implement Model Tiering Strategy

## Context

The Ralph loop currently uses the same model for every iteration. Since prd.json stories are well-scoped and verifiable, cheaper models can execute them reliably while reserving expensive models for planning and escalation. This plan implements adaptive model tiering from `model_tiering_strategy.md`.

---

## Step 1: Update ralph-loop.sh template in orchestrate skill

**File:** `.claude/skills/orchestrate/SKILL.md` — ralph-loop.sh template (~line 237-276)

**Replace** the current ralph-loop.sh template with the model-tiered version:

### New variables (after MAX_ITERATIONS)
```bash
DEFAULT_MODEL="${2:-sonnet}"
ESCALATION_MODEL="opus"
CURRENT_MODEL="$DEFAULT_MODEL"
CONSECUTIVE_FAILURES=0
ESCALATION_THRESHOLD=2
```

### Updated Usage line
```bash
# Usage: ./ralph-loop.sh [max_iterations] [default_model]
```

### Updated claude invocation
```bash
# Before:
claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md"

# After:
claude --model "$CURRENT_MODEL" --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md"
```

### Add escalation/de-escalation block (after PHASE_COMPLETE check)
```bash
# Check if story failed — escalate model if needed
if echo "$OUTPUT" | grep -qiE "STORY_FAILED|stuck|blocked|retry.?exhausted"; then
  CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
  echo "Failure detected ($CONSECUTIVE_FAILURES consecutive)"
  if [ "$CONSECUTIVE_FAILURES" -ge "$ESCALATION_THRESHOLD" ] && [ "$CURRENT_MODEL" != "$ESCALATION_MODEL" ]; then
    echo ">>> Escalating from $CURRENT_MODEL to $ESCALATION_MODEL"
    CURRENT_MODEL="$ESCALATION_MODEL"
  fi
else
  if [ "$CURRENT_MODEL" != "$DEFAULT_MODEL" ]; then
    echo ">>> De-escalating back to $DEFAULT_MODEL"
  fi
  CURRENT_MODEL="$DEFAULT_MODEL"
  CONSECUTIVE_FAILURES=0
fi
```

### Add model logging (after each iteration)
```bash
echo "[$(date)] Iteration $i — model: $CURRENT_MODEL — result: $(echo $OUTPUT | grep -oE '(STORY_IMPLEMENTED|STORY_FAILED|PHASE_COMPLETE)' | head -1)" >> "$SCRIPT_DIR/progress.txt"
```

### Add startup banner
```bash
echo "Default model: $DEFAULT_MODEL | Escalation model: $ESCALATION_MODEL"
```

---

## Step 2: Update CLAUDE.md template for STORY_FAILED signal

**File:** `.claude/skills/orchestrate/SKILL.md` — CLAUDE.md template (~line 166-235)

**Add** after the existing "Fail -> fix/retry 3x" step:

```markdown
## Model Escalation
If you cannot complete a story after 3 attempts, output: STORY_FAILED
This signals the loop to escalate to a more capable model on the next iteration.
Do NOT output STORY_FAILED if you haven't genuinely attempted 3 times.
```

This gives the loop a reliable signal to detect failure and trigger escalation.

---

## Step 3: Update Phase 3c launch examples

**File:** `.claude/skills/orchestrate/SKILL.md` — Phase 3c parallel execution section

**Replace** the current launch examples:

```bash
# Before:
/tmp/<repo>-phases/phase-a/ralph-loop.sh 20 &

# After — with model parameter:
/tmp/<repo>-phases/phase-a/ralph-loop.sh 20 sonnet &
```

Also add a note about model selection strategy:

```markdown
#### Model selection per phase

Choose the default model based on task complexity:
- **Sonnet** (default): Well-scoped implementation tasks, refactors, migrations
- **Haiku**: Mechanical tasks — config changes, simple file operations, boilerplate
- **Opus**: Complex architectural decisions, cross-cutting refactors, ambiguous requirements

The loop automatically escalates to Opus on 2+ consecutive failures regardless of the starting model.
```

---

## Step 4: Update execution.md template

**File:** `.claude/skills/orchestrate/SKILL.md` — Phase 3b execution.md section

**Add** item to the execution.md template contents list:

```markdown
7. Model strategy — default model per phase, escalation thresholds, rationale
```

This ensures the generated execution.md documents which model is assigned to each phase and why.

---

## Step 5: Sync to Copilot agent

**File:** `.github/agents/phase.md`

Apply Steps 1-4 changes. This file already has retry/backoff in its ralph-loop.sh template — merge the model tiering variables and escalation logic INTO the existing retry structure.

The existing retry block handles transient API errors (503, rate limits). The new escalation block handles story-level failures. These are independent:
- Retry = same model, same story, API error
- Escalation = different model, same story, implementation failure

Both go in the loop but at different check points.

---

## Step 6: Sync to Copilot prompt

**File:** `.github/prompts/phase.prompt.md`

Apply Steps 1-4 changes. This file has a simpler ralph-loop.sh — bring it to parity:
1. Add retry/backoff logic (matching phase.md)
2. Add model tiering variables and escalation
3. Update claude invocation with `--model`

---

## Execution Order

```
Step 1 (ralph-loop.sh template — core change)
  ↓
Step 2 (CLAUDE.md template — STORY_FAILED signal)
  ↓
Step 3 + 4 (launch examples + execution.md — same file, minor edits)
  ↓
Step 5 + 6 (sync to Copilot — parallel, different files)
```

---

## Files Summary

| File | Changes |
|---|---|
| `.claude/skills/orchestrate/SKILL.md` | Steps 1, 2, 3, 4 |
| `.github/agents/phase.md` | Step 5 |
| `.github/prompts/phase.prompt.md` | Step 6 |

No new files. No TypeScript changes. This is purely template updates in markdown skill files.

---

## Verification

| Check | Command/Action |
|---|---|
| Templates parse correctly | Read-through: no syntax errors in bash template |
| Model parameter accepted | Verify `ralph-loop.sh 20 sonnet` usage line present |
| Escalation logic present | Verify CONSECUTIVE_FAILURES counter, threshold check, model swap |
| De-escalation present | Verify reset to DEFAULT_MODEL on success |
| STORY_FAILED signal documented | Verify CLAUDE.md template includes model escalation section |
| Launch examples updated | Verify Phase 3c shows `ralph-loop.sh 20 sonnet` |
| Execution.md template updated | Verify item 7 (model strategy) in template |
| Copilot agent synced | Diff phase.md against SKILL.md — all template changes present |
| Copilot prompt synced | Diff phase.prompt.md against SKILL.md — all template changes present |
| Backward compatible | Verify `ralph-loop.sh 20` (no model arg) defaults to sonnet |
