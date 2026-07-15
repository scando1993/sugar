import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, execFileSync } from 'child_process';
import { PrdJson } from '../src/types';

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

const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require('fs');
let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  const cwd = process.cwd();
  if (input.includes('## Target Story')) {
    process.stdout.write('VOTE:PASS\\n');
    return;
  }
  const prd = JSON.parse(fs.readFileSync(cwd + '/prd.json', 'utf-8'));
  const story = prd.userStories.find(s => s.status === 'implementing');
  if (!story) { process.stdout.write('PHASE_COMPLETE\\n'); return; }
  fs.writeFileSync(cwd + '/' + story.id + '.txt', 'implemented ' + story.id + '\\n');
  fs.writeFileSync(cwd + '/.sugar-result.json', JSON.stringify({ storyId: story.id, outcome: 'implemented' }));
  process.stdout.write('STORY_IMPLEMENTED:' + story.id + '\\n');
});
`;

describe('end-to-end smoke test: generate -> real spawn -> verify -> commit', () => {
  let tmpDir: string;
  let repoRoot: string;
  let phasesDir: string;
  let fakeClaudePath: string;
  let cli: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-e2e-'));
    repoRoot = path.join(tmpDir, 'main-repo');
    fs.mkdirSync(repoRoot);
    execSync('git init -q', { cwd: repoRoot });
    execSync('git config user.email t@t.com', { cwd: repoRoot });
    execSync('git config user.name t', { cwd: repoRoot });
    fs.writeFileSync(path.join(repoRoot, 'README.md'), 'hi\n');
    execSync('git add . && git commit -q -m init', { cwd: repoRoot });

    fakeClaudePath = path.join(tmpDir, 'fake-claude.js');
    fs.writeFileSync(fakeClaudePath, FAKE_CLAUDE);
    fs.chmodSync(fakeClaudePath, 0o755);

    phasesDir = path.join(tmpDir, 'phases');
    fs.writeFileSync(
      path.join(repoRoot, 'sugar.config.json'),
      JSON.stringify({
        runnerBin: fakeClaudePath,
        permissionMode: 'skip',
        workspaceBasePath: phasesDir,
      }, null, 2),
    );

    cli = findCliEntry();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('drives a 2-story phase from generate through a real spawned agent to completion', () => {
    execFileSync('node', [cli, 'workspace', 'create', 'phase-a'], { cwd: repoRoot, encoding: 'utf-8' });

    const phasesFile = path.join(tmpDir, 'phases.json');
    fs.writeFileSync(phasesFile, JSON.stringify([
      {
        id: 'phase-a',
        name: 'Phase A',
        scope: 'Smoke test phase',
        produces: [],
        consumes: [],
        dependencies: [],
        stories: [
          { title: 'Story one', description: 'As a dev, I need story one', acceptanceCriteria: ['Works'] },
          { title: 'Story two', description: 'As a dev, I need story two', acceptanceCriteria: ['Works'] },
        ],
      },
    ]));

    execFileSync('node', [cli, 'generate', '--phases', phasesFile, '--task', 'Smoke test the run loop'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });

    const workspacePath = path.join(phasesDir, 'phase-a');
    for (const file of ['prd.json', 'CLAUDE.md', 'VERIFY.md', 'ralph-loop.sh']) {
      assert.ok(fs.existsSync(path.join(workspacePath, file)), `expected ${file} to exist`);
    }

    let runOutput = '';
    let exitCode = 0;
    try {
      runOutput = execFileSync('node', [cli, 'run', workspacePath, '--max-iterations', '5'], {
        cwd: repoRoot,
        encoding: 'utf-8',
      });
    } catch (err: any) {
      runOutput = err.stdout || '';
      exitCode = err.status ?? 1;
    }

    assert.equal(exitCode, 0, `expected sugar run to exit 0 (complete); output:\n${runOutput}`);
    assert.match(runOutput, /COMPLETE — 2\/2 stories passed/);

    const prd: PrdJson = JSON.parse(fs.readFileSync(path.join(workspacePath, 'prd.json'), 'utf-8'));
    assert.ok(prd.userStories.every(s => s.status === 'passed'));

    const log = execSync('git log --oneline', { cwd: workspacePath, encoding: 'utf-8' });
    assert.ok(log.includes(prd.userStories[0].id));
    assert.ok(log.includes(prd.userStories[1].id));

    const tags = execSync('git tag', { cwd: workspacePath, encoding: 'utf-8' }).trim().split('\n');
    assert.ok(tags.some(t => t.startsWith(`sugar/phase-a/${prd.userStories[0].id}/attempt-`)));
    assert.ok(tags.some(t => t.startsWith(`sugar/phase-a/${prd.userStories[1].id}/attempt-`)));
  });
});
