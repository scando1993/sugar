import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { PrdJson, UserStory, FailureReport, StoryStatus } from '../types';
import { ModelTier } from './model-tier';
import { ConsensusEngine } from './consensus';

export class RalphLoop {
  private workspacePath: string;
  private prdPath: string;
  private modelTier: ModelTier;
  private consensus: ConsensusEngine;

  constructor(
    workspacePath: string,
    modelTier: ModelTier,
    consensus: ConsensusEngine,
  ) {
    this.workspacePath = workspacePath;
    this.prdPath = path.join(workspacePath, 'prd.json');
    this.modelTier = modelTier;
    this.consensus = consensus;
  }

  pickNextStory(): UserStory | null {
    const prd = this.readPrd();
    const candidates = prd.userStories
      .filter(s => s.status === 'pending' || s.status === 'rejected')
      .sort((a, b) => a.priority - b.priority);
    return candidates.length > 0 ? candidates[0] : null;
  }

  createSnapshot(storyId: string, attempt: number): string {
    const tag = `attempt-${storyId}-v${attempt}`;
    try {
      execSync(`git tag "${tag}"`, { cwd: this.workspacePath, stdio: 'pipe' });
    } catch {
      // Tag may already exist
    }
    return tag;
  }

  setStoryStatus(storyId: string, status: StoryStatus): void {
    const prd = this.readPrd();
    const story = prd.userStories.find(s => s.id === storyId);
    if (!story) throw new Error(`Story ${storyId} not found`);
    story.status = status;
    this.writePrd(prd);
  }

  recordProgress(storyId: string, result: string, learnings: string): void {
    const progressPath = path.join(this.workspacePath, 'progress.txt');
    const entry = [
      '',
      `## ${new Date().toISOString()} - ${storyId}`,
      `- Result: ${result}`,
      `- Model: ${this.modelTier.currentModel}`,
      learnings ? `- **Learnings:**\n${learnings}` : '',
      '---',
      '',
    ].filter(Boolean).join('\n');
    fs.appendFileSync(progressPath, entry);
  }

  recordFailure(storyId: string, attempt: number, error: string, filesModified: string[] = []): void {
    const logPath = path.join(this.workspacePath, 'failure_log.json');
    const report: FailureReport = {
      storyId,
      attempt,
      filesModified,
      failureType: this.classifyError(error),
      lastError: error,
      timestamp: new Date().toISOString(),
    };

    let reports: FailureReport[] = [];
    if (fs.existsSync(logPath)) {
      try {
        reports = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
        if (!Array.isArray(reports)) reports = [reports];
      } catch {
        reports = [];
      }
    }
    reports.push(report);
    fs.writeFileSync(logPath, JSON.stringify(reports, null, 2));
  }

  isPhaseComplete(): boolean {
    const prd = this.readPrd();
    return prd.userStories.every(s => s.status === 'passed');
  }

  getProgress(): { passed: number; total: number; blocked: number; pending: number } {
    const prd = this.readPrd();
    return {
      passed: prd.userStories.filter(s => s.status === 'passed').length,
      total: prd.userStories.length,
      blocked: prd.userStories.filter(s => s.status === 'blocked').length,
      pending: prd.userStories.filter(s => s.status === 'pending' || s.status === 'rejected').length,
    };
  }

  resetUnstagedChanges(): void {
    try {
      execSync('git checkout -- .', { cwd: this.workspacePath, stdio: 'pipe' });
    } catch {
      // Ignore errors
    }
  }

  get currentModel(): string {
    return this.modelTier.currentModel;
  }

  handleIterationResult(success: boolean): void {
    this.modelTier.recordResult(success);
  }

  private classifyError(error: string): string {
    const lower = error.toLowerCase();
    if (lower.includes('typecheck') || lower.includes('type error') || lower.includes('ts(')) return 'typecheck';
    if (lower.includes('lint')) return 'lint';
    if (lower.includes('test') || lower.includes('assert')) return 'test';
    if (lower.includes('timeout')) return 'timeout';
    return 'unknown';
  }

  private readPrd(): PrdJson {
    return JSON.parse(fs.readFileSync(this.prdPath, 'utf-8'));
  }

  private writePrd(prd: PrdJson): void {
    fs.writeFileSync(this.prdPath, JSON.stringify(prd, null, 2));
  }
}
