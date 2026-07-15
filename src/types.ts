// ============================================================
// prd.json types (existing)
// ============================================================

export interface Vote {
  term: number;
  verifier: number;
  result: 'pass' | 'fail';
  reason?: string;
  timestamp?: string;
}

export interface ConsensusConfig {
  quorumSize: number;
  requiredMajority: number;
  implementModel: string;
  verifyModel: string;
  escalationModel: string;
  maxTerms: number;
}

export type StoryStatus = 'pending' | 'implementing' | 'verifying' | 'passed' | 'rejected' | 'blocked';

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  status: StoryStatus;
  term: number;
  votes: Vote[];
  notes: string;
}

export interface PrdJson {
  project: string;
  branchName: string;
  description: string;
  consensus: ConsensusConfig;
  userStories: UserStory[];
}

export interface ValidationError {
  field: string;
  message: string;
  storyId?: string;
}

// ============================================================
// Sugar config
// ============================================================

export interface ModelConfig {
  default: string;
  escalation: string;
  verify?: string;
}

export interface EscalationConfig {
  threshold: number;
}

export type PermissionMode = 'skip' | 'acceptEdits' | 'default';

export interface SugarConfig {
  models: ModelConfig;
  consensus: {
    quorumSize: number;
    requiredMajority: number;
    maxTerms: number;
  };
  escalation: EscalationConfig;
  qualityChecks: string[];
  maxIterations: number;
  /** Absolute path where phase worktrees are created. Defaults to /tmp/<repo>-phases when unset. */
  workspaceBasePath?: string;
  /** Permission mode passed to spawned implementer/verifier agents. */
  permissionMode: PermissionMode;
  /** Binary/command used to spawn implementer and verifier agents. */
  runnerBin: string;
  /** Command used by generated scripts to invoke this CLI. Resolved at generation time when unset. */
  sugarBin?: string;
}

export const DEFAULT_CONFIG: SugarConfig = {
  models: {
    default: 'sonnet',
    escalation: 'opus',
    verify: 'sonnet',
  },
  consensus: {
    quorumSize: 3,
    requiredMajority: 2,
    maxTerms: 3,
  },
  escalation: {
    threshold: 2,
  },
  qualityChecks: ['npm run typecheck', 'npm run lint', 'npm test'],
  maxIterations: 20,
  permissionMode: 'acceptEdits',
  runnerBin: 'claude',
};

// ============================================================
// Events
// ============================================================

export interface StoryStartedEvent {
  type: 'story_started';
  storyId: string;
  timestamp: string;
  model: string;
}

export interface StoryPassedEvent {
  type: 'story_passed';
  storyId: string;
  timestamp: string;
  term: number;
  passVotes: number;
  totalVotes: number;
}

export interface StoryFailedEvent {
  type: 'story_failed';
  storyId: string;
  timestamp: string;
  attempt: number;
  error: string;
}

export interface VoteCastEvent {
  type: 'vote_cast';
  storyId: string;
  verifier: number;
  result: 'pass' | 'fail';
  reason?: string;
  timestamp: string;
}

export interface PhaseCompleteEvent {
  type: 'phase_complete';
  phase: string;
  timestamp: string;
  storiesPassed: number;
  totalStories: number;
}

export interface ModelEscalatedEvent {
  type: 'model_escalated';
  from: string;
  to: string;
  consecutiveFailures: number;
  timestamp: string;
}

export type SugarEvent =
    | StoryStartedEvent
    | StoryPassedEvent
    | StoryFailedEvent
    | VoteCastEvent
    | PhaseCompleteEvent
    | ModelEscalatedEvent;

// ============================================================
// Dependency graph
// ============================================================

export type DependencyType = 'hard' | 'soft';

export interface PhaseNode {
  id: string;
  name: string;
  produces: string[];
  consumes: string[];
  dependencies: string[];  // phase IDs this depends on
}

export interface DependencyEdge {
  from: string;   // phase ID
  to: string;     // phase ID
  type: DependencyType;
  artifact?: string;  // what is being depended on
}

export interface ParallelGroup {
  groupNumber: number;
  phases: string[];         // phase IDs
  dependsOnGroups: number[];
}

export interface CriticalPath {
  phases: string[];   // ordered phase IDs on critical path
  length: number;     // number of phases
}

export interface DependencyGraph {
  nodes: PhaseNode[];
  edges: DependencyEdge[];
  parallelGroups: ParallelGroup[];
  criticalPath: CriticalPath;
}

// ============================================================
// Phase definitions (input to `sugar generate --phases <file>`)
// ============================================================

/**
 * The schema of one entry in the `phases.json` file passed to
 * `sugar generate --phases <file>`. One PhaseDefinition per Phase-2 workspace
 * (created beforehand via `sugar workspace create <id>`).
 */
export interface PhaseDefinition {
  /** Must match the workspace/branch name created in Phase 2. */
  id: string;
  /** Human-readable name used in execution.md and CLAUDE.md. */
  name: string;
  /** One or two sentences describing this phase's scope — becomes prd.json's description. */
  scope: string;
  /** Implementer model for this phase. Defaults to config.models.default. */
  model?: string;
  /** Artifacts/files/APIs/types this phase produces, for the dependency graph. */
  produces: string[];
  /** What this phase needs from other phases, for the dependency graph. */
  consumes: string[];
  /** IDs of other phases in this same phases.json that must complete first (hard dependencies). */
  dependencies: string[];
  /** Right-sized user stories, ordered by internal dependency. */
  stories: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string[];
  }>;
}

// ============================================================
// Workspace
// ============================================================

export interface WorkspaceConfig {
  repoRoot: string;
  basePath: string;         // e.g. /tmp/<repo>-phases
  repoName: string;
}

export interface PhaseWorkspace {
  phase: string;            // e.g. "phase-a-types"
  branch: string;           // e.g. "phase-a-types"
  path: string;             // absolute path to worktree
  model: string;            // default model for this phase
}

// ============================================================
// Template contexts
// ============================================================

export interface ClaudeMdContext {
  phaseName: string;
  branchName: string;
  phaseScope: string;
  taskDescription: string;
  workspacePath: string;
  dependenciesSatisfied: string[];
  knownPatterns: Pattern[];
  qualityChecks: string[];
}

export interface VerifyMdContext {
  phaseName: string;
}

export interface RalphLoopContext {
  phaseName: string;
  maxIterations: number;
  defaultModel: string;
  sugarBin: string;         // path to sugar CLI for state management
}

// ============================================================
// Patterns
// ============================================================

export interface Pattern {
  id: string;
  learned_in: string;
  description: string;
  applies_to: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface PatternsJson {
  patterns: Pattern[];
}

// ============================================================
// Failure log
// ============================================================

export interface FailureReport {
  storyId: string;
  attempt: number;
  filesModified: string[];
  failureType: string;
  lastError?: string;
  timestamp?: string;
}

// ============================================================
// Model tiering
// ============================================================

export interface ModelTierState {
  currentModel: string;
  defaultModel: string;
  escalationModel: string;
  consecutiveFailures: number;
  escalationThreshold: number;
}
