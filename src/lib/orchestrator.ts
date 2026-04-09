import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  SugarConfig,
  DEFAULT_CONFIG,
  PrdJson,
  PhaseWorkspace,
  DependencyGraph,
  Pattern,
} from '../types';
import { WorkspaceManager } from './workspace';
import { DependencyAnalyzer } from './dependency';
import { PatternManager } from './patterns';
import { generateClaudeMd } from './templates/claude-md';
import { generateVerifyMd } from './templates/verify-md';
import { generateRalphLoop } from './templates/ralph-loop-sh';

export interface PhaseDefinition {
  id: string;
  name: string;
  scope: string;
  model?: string;
  produces: string[];
  consumes: string[];
  dependencies: string[];
  stories: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string[];
  }>;
}

export class Orchestrator {
  private config: SugarConfig;
  private repoRoot: string;
  private workspaceManager: WorkspaceManager;
  private patternManager: PatternManager;

  constructor(repoRoot: string, config?: Partial<SugarConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.repoRoot = repoRoot;
    const repoName = path.basename(repoRoot);
    this.workspaceManager = new WorkspaceManager({
      repoRoot,
      basePath: path.join('/tmp', `${repoName}-phases`),
      repoName,
    });
    this.patternManager = new PatternManager(repoRoot);
  }

  /**
   * Phase 2: Create workspaces for each phase
   */
  setup(phases: PhaseDefinition[]): PhaseWorkspace[] {
    const workspaces: PhaseWorkspace[] = [];
    for (const phase of phases) {
      const ws = this.workspaceManager.createWorkspace(phase.id, phase.id);
      ws.model = phase.model || this.config.models.default;
      this.workspaceManager.initProgress(ws);
      workspaces.push(ws);
    }
    return workspaces;
  }

  /**
   * Phase 3a: Analyze dependencies
   */
  analyze(phases: PhaseDefinition[]): DependencyGraph {
    const analyzer = new DependencyAnalyzer();

    for (const phase of phases) {
      analyzer.addPhase({
        id: phase.id,
        name: phase.name,
        produces: phase.produces,
        consumes: phase.consumes,
        dependencies: phase.dependencies,
      });

      for (const dep of phase.dependencies) {
        analyzer.addEdge(dep, phase.id, 'hard');
      }
    }

    return analyzer.buildGraph();
  }

  /**
   * Phase 3b: Generate workspace files (prd.json, CLAUDE.md, VERIFY.md, ralph-loop.sh)
   */
  generateWorkspaceFiles(
    workspaces: PhaseWorkspace[],
    phases: PhaseDefinition[],
    taskDescription: string,
    graph: DependencyGraph,
  ): void {
    // Write execution.md
    const analyzer = new DependencyAnalyzer();
    for (const phase of phases) {
      analyzer.addPhase({
        id: phase.id,
        name: phase.name,
        produces: phase.produces,
        consumes: phase.consumes,
        dependencies: phase.dependencies,
      });
      for (const dep of phase.dependencies) {
        analyzer.addEdge(dep, phase.id, 'hard');
      }
    }
    const asciiGraph = analyzer.toAscii();
    const executionMd = this.buildExecutionMd(graph, phases, asciiGraph);
    fs.writeFileSync(path.join(this.repoRoot, 'execution.md'), executionMd);

    // Generate per-workspace files
    for (const ws of workspaces) {
      const phase = phases.find(p => p.id === ws.phase);
      if (!phase) continue;

      // prd.json
      const prd: PrdJson = {
        project: path.basename(this.repoRoot),
        branchName: ws.branch,
        description: phase.scope,
        consensus: {
          quorumSize: this.config.consensus.quorumSize,
          requiredMajority: this.config.consensus.requiredMajority,
          implementModel: ws.model,
          verifyModel: this.config.models.verify || this.config.models.default,
          escalationModel: this.config.models.escalation,
          maxTerms: 3,
        },
        userStories: phase.stories.map((s, i) => ({
          id: `US-${String(i + 1).padStart(3, '0')}`,
          title: s.title,
          description: s.description,
          acceptanceCriteria: [
            ...s.acceptanceCriteria,
            ...(s.acceptanceCriteria.some(c => /typecheck/i.test(c)) ? [] : ['Typecheck passes']),
          ],
          priority: i + 1,
          status: 'pending' as const,
          term: 0,
          votes: [],
          notes: '',
        })),
      };
      this.workspaceManager.writeFile(ws, 'prd.json', JSON.stringify(prd, null, 2));

      // CLAUDE.md
      const claudeMd = generateClaudeMd({
        phaseName: phase.name,
        branchName: ws.branch,
        phaseScope: phase.scope,
        taskDescription,
        workspacePath: ws.path,
        dependenciesSatisfied: phase.dependencies,
        knownPatterns: [],
        qualityChecks: this.config.qualityChecks,
      });
      this.workspaceManager.writeFile(ws, 'CLAUDE.md', claudeMd);

      // VERIFY.md
      const verifyMd = generateVerifyMd({ phaseName: phase.name });
      this.workspaceManager.writeFile(ws, 'VERIFY.md', verifyMd);

      // ralph-loop.sh
      const ralphLoop = generateRalphLoop({
        phaseName: phase.name,
        maxIterations: this.config.maxIterations,
        defaultModel: ws.model,
        escalationModel: this.config.models.escalation,
        escalationThreshold: this.config.escalation.threshold,
        sugarBin: 'npx sugar',
      });
      this.workspaceManager.writeFile(ws, 'ralph-loop.sh', ralphLoop);
    }
  }

  /**
   * Phase 3c: Execute phases by parallel group
   */
  execute(workspaces: PhaseWorkspace[], graph: DependencyGraph): string {
    const commands: string[] = [];

    for (const group of graph.parallelGroups) {
      const groupWorkspaces = workspaces.filter(ws => group.phases.includes(ws.phase));

      if (groupWorkspaces.length === 0) continue;

      commands.push(`# Group ${group.groupNumber}`);

      // Launch all in parallel
      const pids: string[] = [];
      for (const ws of groupWorkspaces) {
        commands.push(`"${ws.path}/ralph-loop.sh" ${this.config.maxIterations} ${ws.model} &`);
        pids.push(`$!`);
      }

      commands.push('');
      commands.push('# Wait for group to complete');
      commands.push('wait');
      commands.push('');

      // Pattern propagation between groups
      if (group.groupNumber < graph.parallelGroups.length) {
        commands.push('# Propagate patterns to next group');
        commands.push(`npx sugar propagate-patterns --base "${workspaces[0]?.path ? path.dirname(workspaces[0].path) : '/tmp'}"`)
        commands.push('');
      }
    }

    return commands.join('\n');
  }

  /**
   * Phase 4: Generate merge order
   */
  generateMergeOrder(graph: DependencyGraph, workspaces: PhaseWorkspace[]): string {
    const lines: string[] = [
      '# Merge Order',
      '',
      'Generated by Sugar. Merge in this order to minimize conflicts.',
      '',
      '## Order',
      '',
    ];

    let step = 1;
    for (const group of graph.parallelGroups) {
      for (const phaseId of group.phases) {
        const ws = workspaces.find(w => w.phase === phaseId);
        if (!ws) continue;
        lines.push(`${step}. Merge \`${ws.branch}\` into main`);
        lines.push(`   - Run: \`git merge ${ws.branch}\``);
        lines.push(`   - Validate: \`${this.config.qualityChecks.join(' && ')}\``);
        lines.push('');
        step++;
      }
    }

    lines.push('## Post-merge');
    lines.push('');
    lines.push('After all merges:');
    lines.push(`1. Run full validation: \`${this.config.qualityChecks.join(' && ')}\``);
    lines.push('2. Fix any issues before declaring complete');
    lines.push('3. Clean up worktrees: `npx sugar workspace cleanup`');

    return lines.join('\n');
  }

  /**
   * Propagate patterns between groups
   */
  propagatePatterns(workspaces: PhaseWorkspace[], completedPhases: string[], nextPhases: string[]): void {
    for (const phaseId of completedPhases) {
      const ws = workspaces.find(w => w.phase === phaseId);
      if (!ws) continue;
      const progressPath = path.join(ws.path, 'progress.txt');
      if (fs.existsSync(progressPath)) {
        this.patternManager.propagateFromPhase(progressPath, phaseId, nextPhases);
      }
    }

    // Inject into next group's CLAUDE.md
    const patterns = this.patternManager.readPatterns();
    for (const phaseId of nextPhases) {
      const ws = workspaces.find(w => w.phase === phaseId);
      if (!ws) continue;
      const claudePath = path.join(ws.path, 'CLAUDE.md');
      if (fs.existsSync(claudePath)) {
        const content = fs.readFileSync(claudePath, 'utf-8');
        const updated = this.patternManager.injectPatterns(content, patterns.patterns);
        fs.writeFileSync(claudePath, updated);
      }
    }
  }

  loadConfig(): SugarConfig {
    const configPath = path.join(this.repoRoot, 'sugar.config.json');
    if (fs.existsSync(configPath)) {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...userConfig };
    }
    return { ...DEFAULT_CONFIG };
  }

  private buildExecutionMd(
    graph: DependencyGraph,
    phases: PhaseDefinition[],
    asciiGraph: string,
  ): string {
    const lines: string[] = [
      '# Execution Plan',
      '',
      'Generated by Sugar.',
      '',
      '## Dependency Graph',
      '',
      '```',
      asciiGraph,
      '```',
      '',
      '## Parallel Execution Groups',
      '',
    ];

    for (const group of graph.parallelGroups) {
      const deps = group.dependsOnGroups.length > 0
        ? ` (after Group ${group.dependsOnGroups.join(', ')})`
        : ' (no dependencies — starts immediately)';
      lines.push(`### Group ${group.groupNumber}${deps}`);
      lines.push('');
      for (const phaseId of group.phases) {
        const phase = phases.find(p => p.id === phaseId);
        lines.push(`- **${phase?.name || phaseId}**: ${phase?.scope || ''}`);
      }
      lines.push('');
    }

    lines.push('## Critical Path');
    lines.push('');
    const cpNames = graph.criticalPath.phases.map(id => {
      const p = phases.find(ph => ph.id === id);
      return p?.name || id;
    });
    lines.push(`\`${cpNames.join(' → ')}\` (${graph.criticalPath.length} phases)`);
    lines.push('');

    lines.push('## Model Strategy');
    lines.push('');
    for (const phase of phases) {
      lines.push(`- **${phase.name}**: ${phase.model || 'sonnet'} (escalates to opus on 2+ failures)`);
    }

    return lines.join('\n');
  }
}
