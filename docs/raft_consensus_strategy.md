# Raft Consensus Strategy for Ralph Loop

---

## The Problem

The Ralph loop has a self-assessment trust gap:

```
Agent implements story → Same agent says "passes: true" → Nobody verifies → Done
```

The implementing agent is judge, jury, and executioner. Superpowers addresses this with human-in-the-loop adversarial review. We automate it with consensus — multiple cheap verifier agents independently check work before a story is "committed."

---

## Raft-to-Ralph Mapping

| Raft Concept | Ralph Consensus Mapping |
|---|---|
| **Leader** | The implementing agent (writes code) |
| **Followers** | Verifier agents (independently check the work) |
| **Log entry** | A story implementation (code diff + claim "this passes") |
| **AppendEntries RPC** | "Here's what I implemented. Verify against acceptance criteria." |
| **Majority quorum** | Story is `passed` ONLY when >50% of verifiers agree |
| **Term number** | Iteration/attempt number — detects stale assessments |
| **Heartbeat** | Loop script checking agent liveness (timeout = stuck) |
| **Election restriction** | Only the most up-to-date agent (latest git state) can implement |
| **Commit protocol** | A story is "committed" only after quorum, never on self-report alone |
| **nextIndex backtracking** | On failed consensus, collect rejection reasons, feed to next attempt |

---

## The Consensus Loop

```
ralph-loop.sh (outer loop)
  │
  ├── Iteration N:
  │   │
  │   ├── IMPLEMENT (Sonnet — the "Leader")
  │   │   claude --model sonnet < CLAUDE.md
  │   │   → Implements one story, runs checks, commits
  │   │   → Outputs: STORY_IMPLEMENTED:US-003
  │   │
  │   ├── VERIFY (3x Haiku in parallel — the "Followers")
  │   │   claude --model haiku < VERIFY.md &   # verifier 1
  │   │   claude --model haiku < VERIFY.md &   # verifier 2
  │   │   claude --model haiku < VERIFY.md &   # verifier 3
  │   │   wait
  │   │   Each independently checks:
  │   │   - Acceptance criteria satisfied in actual code?
  │   │   - Quality checks pass? (typecheck, lint, tests)
  │   │   - Implementation correct and complete?
  │   │   → Outputs: VOTE:PASS or VOTE:FAIL:{reason}
  │   │
  │   ├── TALLY (bash — deterministic, no model needed)
  │   │   Count PASS vs FAIL votes
  │   │   Majority PASS → set passes: true, committed
  │   │   Majority FAIL → collect reasons → feed to next attempt
  │   │   Tie → escalate to Opus tiebreaker
  │   │
  │   └── Next iteration or PHASE_COMPLETE
```

---

## Cost Analysis

Verification is read-only — verifiers don't generate code, they read a diff and check criteria. Haiku is perfect for this.

| Component | Model | Tokens (~) | Cost per story |
|---|---|---|---|
| Implementer | Sonnet | ~50K | ~$0.90 |
| Verifier x3 | Haiku | ~15K each | ~$0.07 each |
| **Total per story** | | | **~$1.11** |
| Opus solo (no consensus) | Opus | ~50K | **~$4.50** |

Adversarial review at 25% of the cost of Opus solo. And the quality guarantee is stronger because three independent agents are harder to fool than one.

### Cost per typical run (10 stories, 3 phases)

| Strategy | Cost | Quality |
|---|---|---|
| All Opus, no consensus | ~$135 | Medium-High (self-assessed) |
| Sonnet impl + Haiku consensus | ~$33 | High (quorum-verified) |
| Sonnet impl + Sonnet consensus | ~$54 | Higher (smarter verifiers) |
| Haiku impl + Haiku consensus | ~$11 | Medium (cheap but fragile) |

---

## prd.json State Machine Evolution

### Current (no consensus)

```
passes: false → passes: true (self-assessed)
```

### With consensus

```
status: "pending"
  → "implementing" (leader picked it up)
    → "verifying" (implementation done, votes in progress)
      → "passed" (quorum achieved)
      → "rejected" (quorum failed, reasons recorded)
        → "implementing" (retry with feedback)
          → ... (up to 3 attempts)
            → "blocked" (escalate)
```

### Updated TypeScript schema

```typescript
interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  status: "pending" | "implementing" | "verifying" | "passed" | "rejected" | "blocked";
  term: number;              // iteration epoch — increments on each attempt
  votes: Vote[];             // verification history
  notes: string;
}

interface Vote {
  term: number;              // which attempt this vote belongs to
  verifier: number;          // verifier index (1, 2, 3)
  result: "pass" | "fail";
  reason?: string;           // required for fail votes
  timestamp: string;
}

interface PrdJson {
  project: string;
  branchName: string;
  description: string;
  consensus: ConsensusConfig;
  userStories: UserStory[];
}

interface ConsensusConfig {
  quorumSize: number;        // number of verifiers (default: 3)
  requiredMajority: number;  // votes needed to pass (default: 2)
  implementModel: string;    // "sonnet" | "opus"
  verifyModel: string;       // "haiku" | "sonnet"
  escalationModel: string;   // "opus" — used on tie or 2x rejection
  maxTerms: number;          // max attempts before blocked (default: 3)
}
```

---

## Raft Safety Properties Applied

### 1. Election restriction → Implementation quality gate
Before an agent can implement, it must have the latest git state. No implementing on stale code. The loop enforces `git pull` before each iteration.

### 2. Commit requires current-term entry → No stale approvals
A story can only be "committed" (status: passed) based on votes from the CURRENT term. If the code changes between implementation and verification, the votes are invalidated.

### 3. Majority quorum → Byzantine tolerance (lite)
With 3 verifiers, one can hallucinate "PASS" and you still catch it. With 5 verifiers, you tolerate 2 bad assessments. This is cheaper than making a single agent smarter.

### 4. nextIndex backtracking → Structured retry feedback
When consensus fails, you don't just retry blindly. The FAIL reasons from verifiers become the "prevLogIndex check" — the next implementer reads exactly WHY the previous attempt was rejected and must address those specific points.

### 5. Split brain prevention → No conflicting story states
Only one agent implements a story at a time (leader). Verifiers only verify the current term's implementation. No race conditions on prd.json.

---

## Where Raft Doesn't Map (and That's Fine)

| Raft Concept | Why it doesn't apply |
|---|---|
| **Leader election** | The loop script IS the election — it spawns the implementer. No competing candidates. |
| **Log replication** | `prd.json` + git IS the shared log, and it's a file, not a distributed system. |
| **Network partitions** | All agents run on the same machine. |
| **Membership changes** | Cluster size (number of verifiers) is fixed per run. |

We take the **consensus and commit protocol** from Raft, not the distributed infrastructure.

---

## VERIFY.md Template

The verifier prompt must be precise — check acceptance criteria literally, not "vibe check":

```markdown
# Verifier Agent

You are an independent code verifier. You did NOT write this code. Your job is to verify
whether the implementation meets the acceptance criteria. Do NOT trust the implementer's
self-assessment.

## Your Task
1. Read prd.json — find the story marked as status: "verifying"
2. Read the acceptance criteria for that story
3. Read the git diff for the latest commit: git diff HEAD~1
4. For EACH acceptance criterion, verify independently:
   - Is there actual code that satisfies this criterion?
   - Not "it looks like it might" — does it ACTUALLY?
5. Run quality checks: typecheck, lint, tests
6. Cast your vote

## Voting Rules
- ALL acceptance criteria met AND quality checks pass → output: VOTE:PASS
- ANY criterion NOT met → output: VOTE:FAIL:{specific criterion}:{what's wrong}
- Quality checks fail → output: VOTE:FAIL:QUALITY:{which check}:{error}

## Iron Laws
- `DO NOT TRUST THE IMPLEMENTER'S REPORT`
- `VERIFY EVERY CRITERION AGAINST ACTUAL CODE, NOT COMMIT MESSAGES`
- `A VOTE:FAIL MUST INCLUDE THE SPECIFIC REASON`
- `WHEN IN DOUBT, VOTE FAIL — FALSE PASSES ARE WORSE THAN FALSE REJECTS`

## Red Flags — If You Catch Yourself Thinking:

| Thought | Reality |
|---|---|
| "The commit message says it's done, so it probably is" | Commit messages lie. Read the code. |
| "This criterion is basically met, close enough" | Close enough is not met. Vote FAIL with specifics. |
| "I'll vote PASS because the tests pass" | Tests passing is necessary but not sufficient. Check ALL criteria. |
| "The code looks reasonable, I'll trust it" | You are here to NOT trust it. Verify. |
```

---

## ralph-loop.sh with Consensus

```bash
#!/bin/bash
# Ralph loop with Raft consensus — [phase-name]
# Usage: ./ralph-loop.sh [max_iterations] [impl_model] [verify_model]

MAX_ITERATIONS=${1:-20}
IMPL_MODEL="${2:-sonnet}"
VERIFY_MODEL="${3:-haiku}"
ESCALATION_MODEL="opus"
QUORUM_SIZE=3
REQUIRED_MAJORITY=2
MAX_RETRIES=3
BASE_SLEEP=8
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Ralph consensus loop — Phase: [phase-name]"
echo "Impl model: $IMPL_MODEL | Verify model: $VERIFY_MODEL | Quorum: $QUORUM_SIZE"

# Stagger parallel phase starts
JITTER=$((RANDOM % 15))
[ "$JITTER" -gt 0 ] && echo "Stagger delay: ${JITTER}s" && sleep $JITTER

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "=== Iteration $i of $MAX_ITERATIONS ==="

  # ── Phase A: IMPLEMENT ──────────────────────────────────
  echo "--- IMPLEMENT (model: $IMPL_MODEL) ---"

  IMPL_OUTPUT=""
  RETRY_DELAY=10
  for attempt in $(seq 1 $MAX_RETRIES); do
    IMPL_OUTPUT=$(claude --model "$IMPL_MODEL" --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1) && break
    if echo "$IMPL_OUTPUT" | grep -qiE "transient|rate.?limit|overload|503|529"; then
      echo "Transient error (attempt $attempt/$MAX_RETRIES) — retrying in ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
      RETRY_DELAY=$((RETRY_DELAY * 2))
    else
      break
    fi
  done

  echo "$IMPL_OUTPUT"

  # Check for phase completion (all stories already done)
  if echo "$IMPL_OUTPUT" | grep -q "PHASE_COMPLETE"; then
    echo "Phase [phase-name] complete at iteration $i!"
    exit 0
  fi

  # Check if a story was implemented
  if ! echo "$IMPL_OUTPUT" | grep -q "STORY_IMPLEMENTED"; then
    echo "No story implemented this iteration. Continuing..."
    sleep $BASE_SLEEP
    continue
  fi

  STORY_ID=$(echo "$IMPL_OUTPUT" | grep -o "STORY_IMPLEMENTED:[A-Za-z0-9_-]*" | cut -d: -f2)
  echo "Story $STORY_ID implemented. Starting consensus verification..."

  # ── Phase B: VERIFY (parallel quorum) ───────────────────
  echo "--- VERIFY ($QUORUM_SIZE x $VERIFY_MODEL) ---"

  VOTE_DIR=$(mktemp -d)
  for v in $(seq 1 $QUORUM_SIZE); do
    (
      V_OUTPUT=$(claude --model "$VERIFY_MODEL" --dangerously-skip-permissions --print < "$SCRIPT_DIR/VERIFY.md" 2>&1)
      echo "$V_OUTPUT" > "$VOTE_DIR/vote_$v.txt"
    ) &
  done
  wait

  # ── Phase C: TALLY ──────────────────────────────────────
  echo "--- TALLY ---"

  PASS_COUNT=0
  FAIL_COUNT=0
  FAIL_REASONS=""

  for v in $(seq 1 $QUORUM_SIZE); do
    VOTE_CONTENT=$(cat "$VOTE_DIR/vote_$v.txt")
    if echo "$VOTE_CONTENT" | grep -q "VOTE:PASS"; then
      PASS_COUNT=$((PASS_COUNT + 1))
      echo "  Verifier $v: PASS"
    elif echo "$VOTE_CONTENT" | grep -q "VOTE:FAIL"; then
      FAIL_COUNT=$((FAIL_COUNT + 1))
      REASON=$(echo "$VOTE_CONTENT" | grep -o "VOTE:FAIL:.*" | head -1)
      FAIL_REASONS="$FAIL_REASONS\n  Verifier $v: $REASON"
      echo "  Verifier $v: FAIL — $REASON"
    else
      FAIL_COUNT=$((FAIL_COUNT + 1))
      echo "  Verifier $v: NO VOTE (counted as FAIL)"
    fi
  done

  rm -rf "$VOTE_DIR"

  echo "Tally: $PASS_COUNT PASS / $FAIL_COUNT FAIL (need $REQUIRED_MAJORITY to pass)"

  if [ "$PASS_COUNT" -ge "$REQUIRED_MAJORITY" ]; then
    echo ">>> CONSENSUS REACHED — Story $STORY_ID committed as PASSED"
    # prd.json update happens inside CLAUDE.md agent on next iteration
    # (it reads passes: true and moves to next story)
  else
    echo ">>> CONSENSUS FAILED — Story $STORY_ID rejected"
    echo -e "Rejection reasons:$FAIL_REASONS"
    echo ""
    echo "Feeding rejection reasons to next implementation attempt..."
    # Write rejection reasons to a temp file for next iteration's agent
    echo -e "REJECTED Story $STORY_ID (term $i)\nReasons:$FAIL_REASONS" >> "$SCRIPT_DIR/rejection_log.txt"
    # Revert the commit so next iteration starts clean
    git -C "$SCRIPT_DIR" reset --soft HEAD~1
  fi

  echo "Sleeping ${BASE_SLEEP}s before next iteration..."
  sleep $BASE_SLEEP
done

echo "Reached max iterations ($MAX_ITERATIONS). Check prd.json for status."
exit 1
```

---

## Compounding with Model Tiering

The consensus mechanism compounds with the model tiering strategy (see [model_tiering_strategy.md](model_tiering_strategy.md)):

| Configuration | Impl model | Verify model | Cost/story | Quality |
|---|---|---|---|---|
| Baseline (Opus, no consensus) | Opus | — | $4.50 | Medium-High (self-assessed) |
| Budget consensus | Sonnet | Haiku x3 | $1.11 | High (quorum-verified) |
| Balanced consensus | Sonnet | Sonnet x3 | $3.60 | Very High |
| Premium consensus | Opus | Sonnet x3 | $7.20 | Highest |
| Ultra-cheap consensus | Haiku | Haiku x3 | $0.32 | Medium (cheap everywhere) |

The sweet spot is **Sonnet implementer + Haiku verifiers**: 75% cheaper than Opus solo with HIGHER quality due to independent verification.

---

## Competitive Advantage vs Superpowers

| Dimension | superpowers | sugar + consensus |
|---|---|---|
| Review mechanism | Human dispatches reviewer subagent | Automated quorum of verifier agents |
| Review speed | Minutes (human bottleneck) | Seconds (parallel Haiku) |
| Review cost | Opus-tier for both impl + review | Sonnet impl + Haiku review |
| Review independence | 1 reviewer (single point of failure) | 3+ independent verifiers |
| Structured feedback | Reviewer prose | Machine-parseable VOTE:FAIL:{reason} |
| Autonomy | Requires human for dispatch | Fully autonomous |
| Audit trail | None (conversation context lost) | Every vote recorded in prd.json |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Haiku too dumb to verify complex stories | False passes on hard tasks | Escalate to Sonnet verifiers for Tier 3 tasks; configurable `verifyModel` in ConsensusConfig |
| False rejections waste iterations | Time/cost overhead | Require VOTE:FAIL to include specific criterion + evidence; implementer can read rejection_log.txt |
| Verifiers disagree with each other consistently | Deadlock | After 2 consecutive rejections, escalate to Opus tiebreaker |
| VERIFY.md prompt drift | Verifiers stop checking properly | Apply persuasion engineering: iron laws, rationalization tables, anti-trust framing |
| Added latency per story (~15-20s) | Slower overall execution | Acceptable given quality gain; parallel verification minimizes wall-clock impact |

---

## Implementation Roadmap

### Phase 1 — Schema update
- [ ] Extend `UserStory` type with `status`, `term`, `votes` fields
- [ ] Add `ConsensusConfig` to `PrdJson` interface
- [ ] Update CLI validator to handle new schema (backward-compatible with old `passes` boolean)

### Phase 2 — VERIFY.md template
- [ ] Write verifier prompt with iron laws and rationalization tables
- [ ] Test with Haiku on 3-5 known-good and known-bad implementations
- [ ] Calibrate: does Haiku reliably catch real issues without false rejecting?

### Phase 3 — Loop integration
- [ ] Update `ralph-loop.sh` template with consensus phases
- [ ] Add `rejection_log.txt` mechanism for structured retry feedback
- [ ] Add `--consensus` flag to enable/disable (backward-compatible)
- [ ] Update CLAUDE.md template to read rejection_log.txt on retry attempts

### Phase 4 — Benchmark
- [ ] Add contestant F (Sonnet + Haiku consensus) to benchmark strategy
- [ ] Compare against A (Opus solo) and D (Sonnet tiered, no consensus)
- [ ] Measure: does consensus actually improve pass rate? At what cost delta?

---

## Related Documents

- [Benchmark Strategy](benchmark_strategy.md) — includes contestants for consensus configurations
- [Model Tiering Strategy](model_tiering_strategy.md) — cost analysis and adaptive escalation
- [Competitive Analysis: superpowers](comparison_superpowers.md) — trust gap that consensus addresses
