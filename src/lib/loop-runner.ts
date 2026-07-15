import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { PrdJson, UserStory, SugarConfig, ModelTierState } from '../types';
import { RalphLoop } from './ralph-loop';
import { ModelTier } from './model-tier';
import { ConsensusEngine } from './consensus';
import { Verifier } from './verifier';
import { AgentRunner } from './agent-runner';

const STATE_FILE = '.sugar-state.json';
const RESULT_FILE = '.sugar-result.json';

interface SugarState {
  modelTier: ModelTierState;
  /** Per-story attempt counters, persisted across loop restarts/resumes. */
  attempts: Record<string, number>;
}

export interface LoopResult {
  status: 'complete' | 'stuck' | 'max_iterations';
  passed: number;
  total: number;
  /** Story IDs currently status: "blocked" — only populated for 'stuck'. */
  blocked: string[];
  iterations: number;
}

export interface StructuredResult {
  storyId?: string;
  outcome: 'implemented' | 'failed' | 'phase_complete';
  notes?: string;
}

/**
 * Owns the entire Ralph iteration loop in one tested place, replacing logic
 * that used to be split (and duplicated) between ralph-loop.sh's bash escalation
 * counter, CLAUDE.md's prose-described story picking, and free-text stdout
 * grepping for STORY_IMPLEMENTED/STORY_FAILED/PHASE_COMPLETE.
 *
 * Every iteration resolves the claimed story to passed/rejected/blocked before
 * returning — a story is never left stranded in "implementing", even if the
 * agent throws, times out, or returns an unrecognizable result.
 */
export class LoopRunner {
  private workspacePath: string;
  private prdPath: string;
  private statePath: string;
  private ralphLoop: RalphLoop;
  private consensus: ConsensusEngine;
  private modelTier: ModelTier;
  private verifier: Verifier;
  private agentRunnerFn: AgentRunner;
  private attempts: Record<string, number>;

  constructor(workspacePath: string, config: SugarConfig, agentRunner: AgentRunner, modelOverride?: string) {
    this.workspacePath = workspacePath;
    this.prdPath = path.join(workspacePath, 'prd.json');
    this.statePath = path.join(workspacePath, STATE_FILE);

    const prd = this.readPrd();
    const state = this.loadState();

    this.modelTier = state
      ? ModelTier.fromState(state.modelTier)
      : new ModelTier(modelOverride || prd.consensus.implementModel, prd.consensus.escalationModel, config.escalation.threshold);
    this.attempts = state?.attempts || {};

    this.consensus = new ConsensusEngine(prd.consensus.quorumSize, prd.consensus.requiredMajority);
    this.ralphLoop = new RalphLoop(workspacePath, this.modelTier, this.consensus);
    this.verifier = new Verifier(workspacePath, agentRunner);
    this.agentRunnerFn = agentRunner;
  }

  run(maxIterations: number): LoopResult {
    let iterations = 0;

    for (let i = 1; i <= maxIterations; i++) {
      iterations = i;
      const story = this.ralphLoop.pickNextStory();
      if (!story) break;

      this.runIteration(story);
      this.saveState();
    }

    const picked = this.ralphLoop.pickNextStory();
    if (picked) {
      return { ...this.progress(), status: 'max_iterations', iterations };
    }
    return { ...this.deriveTerminalStatus(), iterations };
  }

  private runIteration(story: UserStory): void {
    this.ralphLoop.setStoryStatus(story.id, 'implementing');
    const attempt = this.nextAttempt(story.id);
    this.ralphLoop.createSnapshot(story.id, attempt);

    // Everything below — spawning the agent, parsing its result, running the
    // verifier quorum — is wrapped in one catch so that ANY failure (spawn
    // error, malformed result, verifier throwing on a missing VERIFY.md,
    // etc.) still resolves the story to rejected/blocked. It must never be
    // left stranded in "implementing".
    try {
      const claudeMd = fs.readFileSync(path.join(this.workspacePath, 'CLAUDE.md'), 'utf-8');
      const output = this.agentRunnerFn(claudeMd, this.modelTier.currentModel);
      const outcome = this.readResult(output);
      this.handleOutcome(story, outcome);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.ralphLoop.resetUnstagedChanges();
      this.ralphLoop.recordFailure(story.id, attempt, message);
      this.handleUnverifiedFailure(story.id, message);
      this.modelTier.recordResult(false);
    }
  }

  private handleOutcome(story: UserStory, outcome: StructuredResult): void {
    if (outcome.outcome === 'phase_complete') {
      // Trust prd.json over the agent's self-report. If it claimed completion
      // without actually resolving the story it picked, don't leave that story
      // stranded in "implementing" — treat it as an unverified failure instead.
      const prd = this.readPrd();
      const current = prd.userStories.find(s => s.id === story.id);
      if (current && current.status === 'implementing') {
        this.handleUnverifiedFailure(story.id, 'agent reported PHASE_COMPLETE without resolving the claimed story');
      }
      return;
    }

    if (outcome.outcome === 'implemented') {
      const verifyResult = this.verifier.runQuorum(story.id);
      this.ralphLoop.recordProgress(story.id, verifyResult.status, outcome.notes || '');
      if (verifyResult.passed) {
        this.commit(story.id);
        this.modelTier.recordResult(true);
        delete this.attempts[story.id];
      } else {
        this.ralphLoop.resetUnstagedChanges();
        this.modelTier.recordResult(false);
      }
      return;
    }

    // outcome.outcome === 'failed' (explicit STORY_FAILED, an exception, or no recognizable signal)
    this.ralphLoop.resetUnstagedChanges();
    this.ralphLoop.recordFailure(story.id, this.attempts[story.id] || 1, outcome.notes || 'implementer reported failure');
    this.handleUnverifiedFailure(story.id, outcome.notes || 'implementer reported failure');
    this.modelTier.recordResult(false);
  }

  /** Resolves a story that failed before reaching the verifier quorum (so ConsensusEngine never ran). */
  private handleUnverifiedFailure(storyId: string, reason: string): void {
    const term = this.consensus.incrementTerm(this.prdPath, storyId);
    const prd = this.readPrd();
    const maxTerms = prd.consensus.maxTerms;

    if (term >= maxTerms) {
      this.consensus.updateStoryStatus(this.prdPath, storyId, 'blocked');
      const updated = this.readPrd();
      const updatedStory = updated.userStories.find(s => s.id === storyId)!;
      updatedStory.notes = `Blocked after ${term} failed attempt(s): ${reason}`;
      this.writePrd(updated);
    } else {
      this.consensus.updateStoryStatus(this.prdPath, storyId, 'rejected');
    }
  }

  private readResult(stdout: string): StructuredResult {
    const resultPath = path.join(this.workspacePath, RESULT_FILE);
    if (fs.existsSync(resultPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
        fs.rmSync(resultPath);
        if (parsed && ['implemented', 'failed', 'phase_complete'].includes(parsed.outcome)) {
          return parsed as StructuredResult;
        }
      } catch {
        // Malformed result file — fall through to stdout parsing.
      }
    }

    if (/PHASE_COMPLETE/.test(stdout)) return { outcome: 'phase_complete' };
    const implementedMatch = stdout.match(/STORY_IMPLEMENTED:([A-Za-z]+-\d+)/);
    if (implementedMatch) return { storyId: implementedMatch[1], outcome: 'implemented' };
    if (/STORY_FAILED/.test(stdout)) return { outcome: 'failed' };
    return { outcome: 'failed', notes: 'agent produced no .sugar-result.json or recognizable stdout marker' };
  }

  private commit(storyId: string): void {
    try {
      execSync('git add -A', { cwd: this.workspacePath, stdio: 'pipe' });
      execSync(`git commit -m "feat: ${storyId} - verified by consensus"`, { cwd: this.workspacePath, stdio: 'pipe' });
    } catch {
      // Nothing to commit, or commit failed — the verifier already recorded
      // the story as passed; don't crash the whole loop over it.
    }
  }

  private nextAttempt(storyId: string): number {
    const n = (this.attempts[storyId] || 0) + 1;
    this.attempts[storyId] = n;
    return n;
  }

  private progress(): { passed: number; total: number; blocked: string[] } {
    const prd = this.readPrd();
    const passed = prd.userStories.filter(s => s.status === 'passed').length;
    const blocked = prd.userStories.filter(s => s.status === 'blocked').map(s => s.id);
    return { passed, total: prd.userStories.length, blocked };
  }

  private deriveTerminalStatus(): { status: 'complete' | 'stuck'; passed: number; total: number; blocked: string[] } {
    const { passed, total, blocked } = this.progress();
    if (passed === total) return { status: 'complete', passed, total, blocked };
    return { status: 'stuck', passed, total, blocked };
  }

  private loadState(): SugarState | null {
    if (!fs.existsSync(this.statePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private saveState(): void {
    const state: SugarState = { modelTier: this.modelTier.getState(), attempts: this.attempts };
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  private readPrd(): PrdJson {
    return JSON.parse(fs.readFileSync(this.prdPath, 'utf-8'));
  }

  private writePrd(prd: PrdJson): void {
    fs.writeFileSync(this.prdPath, JSON.stringify(prd, null, 2));
  }
}