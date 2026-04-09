import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { WorkspaceConfig, PhaseWorkspace } from '../types';

export class WorkspaceManager {
  private config: WorkspaceConfig;

  constructor(config: WorkspaceConfig) {
    this.config = config;
  }

  createWorkspace(phase: string, branch?: string): PhaseWorkspace {
    const branchName = branch || phase;
    const wsPath = path.join(this.config.basePath, phase);

    fs.mkdirSync(this.config.basePath, { recursive: true });

    execSync(
      `git worktree add "${wsPath}" -b "${branchName}"`,
      { cwd: this.config.repoRoot, stdio: 'pipe' }
    );

    return {
      phase,
      branch: branchName,
      path: wsPath,
      model: 'sonnet',
    };
  }

  initProgress(workspace: PhaseWorkspace): void {
    const progressPath = path.join(workspace.path, 'progress.txt');
    const content = [
      '# Phase Progress Log',
      `Phase: ${workspace.phase}`,
      `Branch: ${workspace.branch}`,
      `Started: ${new Date().toISOString()}`,
      '',
      '## Codebase Patterns',
      '',
      '_(Add reusable patterns here as you discover them)_',
      '',
      '---',
      '',
    ].join('\n');
    fs.writeFileSync(progressPath, content);
  }

  destroyWorkspace(workspace: PhaseWorkspace): void {
    try {
      execSync(
        `git worktree remove "${workspace.path}" --force`,
        { cwd: this.config.repoRoot, stdio: 'pipe' }
      );
    } catch {
      // Worktree may not exist
    }

    try {
      execSync(
        `git branch -D "${workspace.branch}"`,
        { cwd: this.config.repoRoot, stdio: 'pipe' }
      );
    } catch {
      // Branch may not exist
    }
  }

  listWorkspaces(): PhaseWorkspace[] {
    if (!fs.existsSync(this.config.basePath)) return [];

    const entries = fs.readdirSync(this.config.basePath, { withFileTypes: true });
    const workspaces: PhaseWorkspace[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const wsPath = path.join(this.config.basePath, entry.name);
      const prdPath = path.join(wsPath, 'prd.json');

      // Try to get branch from git
      let branch = entry.name;
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: wsPath,
          stdio: 'pipe',
        }).toString().trim();
      } catch {
        // Use directory name as fallback
      }

      workspaces.push({
        phase: entry.name,
        branch,
        path: wsPath,
        model: 'sonnet',
      });
    }

    return workspaces;
  }

  cleanupAll(): void {
    const workspaces = this.listWorkspaces();
    for (const ws of workspaces) {
      this.destroyWorkspace(ws);
    }

    try {
      execSync('git worktree prune', { cwd: this.config.repoRoot, stdio: 'pipe' });
    } catch {
      // Ignore
    }
  }

  writeFile(workspace: PhaseWorkspace, filename: string, content: string): void {
    const filePath = path.join(workspace.path, filename);
    fs.writeFileSync(filePath, content);
    if (filename.endsWith('.sh')) {
      fs.chmodSync(filePath, '755');
    }
  }
}
