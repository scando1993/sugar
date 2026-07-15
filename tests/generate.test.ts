import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, execFileSync } from 'child_process';
import { Orchestrator } from '../src/lib/orchestrator';
import { WorkspaceManager } from '../src/lib/workspace';
import { PrdJson, PhaseDefinition } from '../src/types';

/**
 * The repo builds via two different tsconfigs (flat dist/index.js for
 * `npm run build`, nested dist/src/index.js for `npm test`'s own compile
 * pass) — resolve whichever is actually on disk rather than assuming one.
 */
function findCliEntry(): string {
  const candidates = [
    path.join(__dirname, '..', 'index.js'),
    path.join(__dirname, '..', 'src', 'index.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Could not locate compiled CLI entry. Run `npm run build` (or `npm test`) first.');
}

describe('sugar generate (Orchestrator.resolveWorkspaces + generateWorkspaceFiles)', () => {
  let tmpDir: string;
  let repoRoot: string;
  let basePath: string;

  const phases: PhaseDefinition[] = [
    {
      id: 'phase-a-types',
      name: 'Types',
      scope: 'Define shared types',
      produces: ['types'],
      consumes: [],
      dependencies: [],
      stories: [
        { title: 'Add User type', description: 'As a dev, I need a User type', acceptanceCriteria: ['Type compiles'] },
      ],
    },
  ];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-generate-'));
    repoRoot = path.join(tmpDir, 'main-repo');
    fs.mkdirSync(repoRoot);
    execSync('git init -q', { cwd: repoRoot });
    execSync('git config user.email t@t.com', { cwd: repoRoot });
    execSync('git config user.name t', { cwd: repoRoot });
    fs.writeFileSync(path.join(repoRoot, 'README.md'), 'hi\n');
    execSync('git add . && git commit -q -m init', { cwd: repoRoot });
    basePath = path.join(tmpDir, 'phases');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws listing missing workspaces instead of silently creating them', () => {
    const orchestrator = new Orchestrator(repoRoot, { workspaceBasePath: basePath });
    assert.throws(
      () => orchestrator.resolveWorkspaces(phases),
      /Missing workspace\(s\) for phase\(s\): phase-a-types/,
    );
  });

  it('generates all workspace files + execution.md, and the prd.json validates via the real CLI', () => {
    // Phase 2 equivalent: the workspace already exists before generate runs.
    const repoName = path.basename(repoRoot);
    const wsMgr = new WorkspaceManager({ repoRoot, basePath, repoName });
    const ws = wsMgr.createWorkspace('phase-a-types');
    wsMgr.initProgress(ws);

    const orchestrator = new Orchestrator(repoRoot, { workspaceBasePath: basePath });
    const resolved = orchestrator.resolveWorkspaces(phases);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].phase, 'phase-a-types');

    const graph = orchestrator.analyze(phases);
    orchestrator.generateWorkspaceFiles(resolved, phases, 'Add shared types', graph);

    const wsPath = resolved[0].path;
    for (const file of ['prd.json', 'CLAUDE.md', 'VERIFY.md', 'ralph-loop.sh']) {
      assert.ok(fs.existsSync(path.join(wsPath, file)), `expected ${file} to be generated`);
    }
    assert.ok(fs.existsSync(path.join(repoRoot, 'execution.md')));

    const prd: PrdJson = JSON.parse(fs.readFileSync(path.join(wsPath, 'prd.json'), 'utf-8'));
    assert.equal(prd.userStories.length, 1);
    assert.ok(prd.userStories[0].acceptanceCriteria.some(c => /typecheck/i.test(c)));

    const cli = findCliEntry();
    const output = execFileSync('node', [cli, 'validate', path.join(wsPath, 'prd.json')], { encoding: 'utf-8' });
    assert.ok(output.includes('prd.json is valid.'));
  });
});

describe('sugar propagate-patterns --inject', () => {
  let tmpDir: string;
  let repoRoot: string;
  let basePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-propagate-'));
    repoRoot = path.join(tmpDir, 'main-repo');
    fs.mkdirSync(repoRoot, { recursive: true });
    execSync('git init -q', { cwd: repoRoot });
    execSync('git config user.email t@t.com', { cwd: repoRoot });
    execSync('git config user.name t', { cwd: repoRoot });
    fs.writeFileSync(path.join(repoRoot, 'README.md'), 'hi\n');
    execSync('git add . && git commit -q -m init', { cwd: repoRoot });

    basePath = path.join(tmpDir, 'phases');
    const phaseADir = path.join(basePath, 'phase-a');
    const phaseBDir = path.join(basePath, 'phase-b');
    fs.mkdirSync(phaseADir, { recursive: true });
    fs.mkdirSync(phaseBDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseADir, 'progress.txt'),
      '## Codebase Patterns\n\n- **Repo pattern**: all data access goes through repositories\n\n---\n',
    );
    fs.writeFileSync(path.join(phaseADir, 'CLAUDE.md'), '# Ralph Agent\n\n## Known Patterns\n\n_(none yet)_\n');
    fs.writeFileSync(path.join(phaseBDir, 'CLAUDE.md'), '# Ralph Agent\n\n## Known Patterns\n\n_(none yet)_\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts patterns without touching CLAUDE.md when --inject is omitted', () => {
    const cli = findCliEntry();
    execFileSync('node', [cli, 'propagate-patterns', '--base', basePath], { cwd: repoRoot, encoding: 'utf-8' });

    const patternsPath = path.join(repoRoot, 'patterns.json');
    assert.ok(fs.existsSync(patternsPath));
    const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
    assert.equal(patterns.patterns.length, 1);

    const claudeMd = fs.readFileSync(path.join(basePath, 'phase-b', 'CLAUDE.md'), 'utf-8');
    assert.ok(claudeMd.includes('_(none yet)_'));
  });

  it('injects extracted patterns into every workspace CLAUDE.md with --inject', () => {
    const cli = findCliEntry();
    execFileSync('node', [cli, 'propagate-patterns', '--base', basePath, '--inject'], { cwd: repoRoot, encoding: 'utf-8' });

    const claudeMdB = fs.readFileSync(path.join(basePath, 'phase-b', 'CLAUDE.md'), 'utf-8');
    assert.ok(claudeMdB.includes('Repo pattern'));
  });

  it('honors --only to inject into a subset of workspaces', () => {
    const cli = findCliEntry();
    execFileSync(
      'node',
      [cli, 'propagate-patterns', '--base', basePath, '--inject', '--only', 'phase-b'],
      { cwd: repoRoot, encoding: 'utf-8' },
    );

    const claudeMdA = fs.readFileSync(path.join(basePath, 'phase-a', 'CLAUDE.md'), 'utf-8');
    const claudeMdB = fs.readFileSync(path.join(basePath, 'phase-b', 'CLAUDE.md'), 'utf-8');
    assert.ok(claudeMdA.includes('_(none yet)_')); // phase-a excluded, untouched
    assert.ok(claudeMdB.includes('Repo pattern'));
  });
});