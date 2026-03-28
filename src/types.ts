export type Complexity = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface SubTask {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  complexity: Complexity;
  agentType?: string;
}

export interface Phase {
  name: string;
  parallel: boolean;
  tasks: SubTask[];
}

export interface OrchestrationPlan {
  goal: string;
  phases: Phase[];
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
}
