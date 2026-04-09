import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ModelTier } from '../src/lib/model-tier';

describe('ModelTier', () => {
  it('starts with default model', () => {
    const tier = new ModelTier('sonnet', 'opus', 2);
    assert.equal(tier.currentModel, 'sonnet');
    assert.equal(tier.isEscalated, false);
    assert.equal(tier.consecutiveFailures, 0);
  });

  it('does not escalate on first failure', () => {
    const tier = new ModelTier('sonnet', 'opus', 2);
    const event = tier.recordResult(false);
    assert.equal(event, null);
    assert.equal(tier.currentModel, 'sonnet');
    assert.equal(tier.consecutiveFailures, 1);
  });

  it('escalates after reaching threshold', () => {
    const tier = new ModelTier('sonnet', 'opus', 2);
    tier.recordResult(false);
    const event = tier.recordResult(false);
    assert.notEqual(event, null);
    assert.equal(event!.type, 'model_escalated');
    assert.equal(event!.from, 'sonnet');
    assert.equal(event!.to, 'opus');
    assert.equal(tier.currentModel, 'opus');
    assert.equal(tier.isEscalated, true);
  });

  it('de-escalates on success after escalation', () => {
    const tier = new ModelTier('sonnet', 'opus', 2);
    tier.recordResult(false);
    tier.recordResult(false); // escalated
    const event = tier.recordResult(true);
    assert.notEqual(event, null);
    assert.equal(event!.from, 'opus');
    assert.equal(event!.to, 'sonnet');
    assert.equal(tier.currentModel, 'sonnet');
    assert.equal(tier.consecutiveFailures, 0);
  });

  it('returns null on success when not escalated', () => {
    const tier = new ModelTier('sonnet', 'opus', 2);
    const event = tier.recordResult(true);
    assert.equal(event, null);
  });

  it('resets consecutive failures on success', () => {
    const tier = new ModelTier('sonnet', 'opus', 3);
    tier.recordResult(false);
    tier.recordResult(false);
    assert.equal(tier.consecutiveFailures, 2);
    tier.recordResult(true);
    assert.equal(tier.consecutiveFailures, 0);
  });

  it('restores from state', () => {
    const tier = new ModelTier('sonnet', 'opus', 2);
    tier.recordResult(false);
    tier.recordResult(false);
    const state = tier.getState();
    const restored = ModelTier.fromState(state);
    assert.equal(restored.currentModel, 'opus');
    assert.equal(restored.consecutiveFailures, 2);
    assert.equal(restored.isEscalated, true);
  });

  it('does not escalate again when already escalated', () => {
    const tier = new ModelTier('sonnet', 'opus', 2);
    tier.recordResult(false);
    tier.recordResult(false); // escalated
    const event = tier.recordResult(false); // already on opus
    assert.equal(event, null);
    assert.equal(tier.currentModel, 'opus');
  });
});
