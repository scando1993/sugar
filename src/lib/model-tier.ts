import { ModelTierState, ModelEscalatedEvent } from '../types';

export class ModelTier {
  private state: ModelTierState;

  constructor(defaultModel: string, escalationModel: string, threshold = 2) {
    this.state = {
      currentModel: defaultModel,
      defaultModel,
      escalationModel,
      consecutiveFailures: 0,
      escalationThreshold: threshold,
    };
  }

  get currentModel(): string {
    return this.state.currentModel;
  }

  get consecutiveFailures(): number {
    return this.state.consecutiveFailures;
  }

  get isEscalated(): boolean {
    return this.state.currentModel !== this.state.defaultModel;
  }

  recordResult(success: boolean): ModelEscalatedEvent | null {
    if (success) {
      return this.deescalate();
    }
    return this.recordFailure();
  }

  private recordFailure(): ModelEscalatedEvent | null {
    this.state.consecutiveFailures++;
    if (
      this.state.consecutiveFailures >= this.state.escalationThreshold &&
      this.state.currentModel !== this.state.escalationModel
    ) {
      return this.escalate();
    }
    return null;
  }

  private escalate(): ModelEscalatedEvent {
    const from = this.state.currentModel;
    this.state.currentModel = this.state.escalationModel;
    return {
      type: 'model_escalated',
      from,
      to: this.state.escalationModel,
      consecutiveFailures: this.state.consecutiveFailures,
      timestamp: new Date().toISOString(),
    };
  }

  private deescalate(): ModelEscalatedEvent | null {
    const wasEscalated = this.state.currentModel !== this.state.defaultModel;
    this.state.currentModel = this.state.defaultModel;
    this.state.consecutiveFailures = 0;
    if (wasEscalated) {
      return {
        type: 'model_escalated',
        from: this.state.escalationModel,
        to: this.state.defaultModel,
        consecutiveFailures: 0,
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }

  getState(): ModelTierState {
    return { ...this.state };
  }

  static fromState(state: ModelTierState): ModelTier {
    const tier = new ModelTier(state.defaultModel, state.escalationModel, state.escalationThreshold);
    tier.state = { ...state };
    return tier;
  }
}
