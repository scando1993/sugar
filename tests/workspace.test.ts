import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { WorkspaceManager } from '../src/lib/workspace';

describe('WorkspaceManager', () => {
  let tmpDir: string;
  let repoRoot: string;
  let basePath: string;
  let mgr: WorkspaceManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-workspace-'));
    repoRoot = path.join(tmpDir, 'main-repo');
    fs.mkdirSync(repoRoot);
    execSync('git init -q', { cwd: repoRoot });
    execSync('git config user.email t@t.com', { cwd: repoRoot });
    execSync('git config user.name t', { cwd: repoRoot });
    fs.writeFileSync(path.join(repoRoot, 'README.md'), 'hi\n');
    execSync('git add . && git commit -q -m init', { cwd: repoRoot });

    basePath = path.join(tmpDir, 'phases');
    mgr = new WorkspaceManager({ repoRoot, basePath, repoName: 'main-repo' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function branchExists(branch: string): boolean {
    const branches = execSync('git branch', { cwd: repoRoot, encoding: 'utf-8' });
    return branches.split('\n').some(l => l.replace(/^\*?\s*/, '').trim() === branch);
  }

  it('removes the branch when it has no unmerged commits', () => {
    const ws = mgr.createWorkspace('phase-a');
    const result = mgr.destroyWorkspace(ws);
    assert.equal(result.removed, true);
    assert.equal(branchExists('phase-a'), false);
  });

  it('keeps an unmerged branch by default, and reports why', () => {
    const ws = mgr.createWorkspace('phase-a');
    fs.writeFileSync(path.join(ws.path, 'work.txt'), 'unmerged work\n');
    execSync('git add . && git commit -q -m "phase a work"', { cwd: ws.path });

    const result = mgr.destroyWorkspace(ws);
    assert.equal(result.removed, false);
    assert.match(result.reason || '', /not merged/);
    assert.equal(branchExists('phase-a'), true);
  });

  it('deletes an unmerged branch when force is passed', () => {
    const ws = mgr.createWorkspace('phase-a');
    fs.writeFileSync(path.join(ws.path, 'work.txt'), 'unmerged work\n');
    execSync('git add . && git commit -q -m "phase a work"', { cwd: ws.path });

    const result = mgr.destroyWorkspace(ws, { force: true });
    assert.equal(result.removed, true);
    assert.equal(branchExists('phase-a'), false);
  });

  it('cleanupAll separates removed (merged) from kept (unmerged) workspaces', () => {
    const mergedWs = mgr.createWorkspace('phase-merged');
    const unmergedWs = mgr.createWorkspace('phase-unmerged');
    fs.writeFileSync(path.join(unmergedWs.path, 'work.txt'), 'unmerged work\n');
    execSync('git add . && git commit -q -m "unmerged work"', { cwd: unmergedWs.path });

    const { removed, kept } = mgr.cleanupAll();
    assert.deepEqual(removed, ['phase-merged']);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].phase, 'phase-unmerged');
    assert.equal(branchExists('phase-unmerged'), true);
    assert.equal(branchExists('phase-merged'), false);
  });
});
