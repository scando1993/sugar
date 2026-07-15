import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { deepMerge, findRepoRoot, loadConfig, resolveSugarBin, resolveWorkspaceBasePath } from '../src/lib/config';
import { DEFAULT_CONFIG } from '../src/types';

describe('deepMerge', () => {
  it('overrides a leaf value without touching siblings', () => {
    const merged = deepMerge(DEFAULT_CONFIG, { models: { default: 'haiku' } as any });
    assert.equal(merged.models.default, 'haiku');
    assert.equal(merged.models.escalation, DEFAULT_CONFIG.models.escalation);
    assert.equal(merged.models.verify, DEFAULT_CONFIG.models.verify);
  });

  it('overrides a nested consensus field without dropping siblings', () => {
    const merged = deepMerge(DEFAULT_CONFIG, { consensus: { maxTerms: 5 } as any });
    assert.equal(merged.consensus.maxTerms, 5);
    assert.equal(merged.consensus.quorumSize, DEFAULT_CONFIG.consensus.quorumSize);
    assert.equal(merged.consensus.requiredMajority, DEFAULT_CONFIG.consensus.requiredMajority);
  });

  it('replaces arrays wholesale rather than merging elements', () => {
    const merged = deepMerge(DEFAULT_CONFIG, { qualityChecks: ['go build'] });
    assert.deepEqual(merged.qualityChecks, ['go build']);
  });

  it('returns base unchanged when override is undefined', () => {
    const merged = deepMerge(DEFAULT_CONFIG, undefined);
    assert.deepEqual(merged, DEFAULT_CONFIG);
  });
});

describe('findRepoRoot', () => {
  let tmpDir: string;
  let mainRepo: string;
  let worktreeDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-reporoot-'));
    mainRepo = path.join(tmpDir, 'main-repo');
    fs.mkdirSync(mainRepo);
    execSync('git init -q', { cwd: mainRepo });
    execSync('git config user.email test@test.com', { cwd: mainRepo });
    execSync('git config user.name test', { cwd: mainRepo });
    fs.writeFileSync(path.join(mainRepo, 'README.md'), 'hi\n');
    execSync('git add . && git commit -q -m init', { cwd: mainRepo });
    worktreeDir = path.join(tmpDir, 'feature-x');
    execSync(`git worktree add -q -b feature-x "${worktreeDir}"`, { cwd: mainRepo });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves the main repo root when run from the main repo', () => {
    assert.equal(fs.realpathSync(findRepoRoot(mainRepo)), fs.realpathSync(mainRepo));
  });

  it('resolves the main repo root when run from inside a worktree', () => {
    // This is the crux of the fix: git worktrees report their own directory as
    // --show-toplevel, which would point sugar.config.json lookups at the wrong
    // place. findRepoRoot must resolve back to the main repo via --git-common-dir.
    assert.equal(fs.realpathSync(findRepoRoot(worktreeDir)), fs.realpathSync(mainRepo));
  });

  it('falls back to walking up for package.json outside a git repo', () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-nogit-'));
    fs.writeFileSync(path.join(nonGitDir, 'package.json'), '{}');
    const nested = path.join(nonGitDir, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });
    assert.equal(fs.realpathSync(findRepoRoot(nested)), fs.realpathSync(nonGitDir));
    fs.rmSync(nonGitDir, { recursive: true, force: true });
  });
});

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when no sugar.config.json exists', () => {
    const config = loadConfig(tmpDir);
    assert.deepEqual(config, DEFAULT_CONFIG);
  });

  it('deep-merges a partial sugar.config.json onto defaults', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'sugar.config.json'),
      JSON.stringify({ models: { default: 'haiku' }, maxIterations: 5 }),
    );
    const config = loadConfig(tmpDir);
    assert.equal(config.models.default, 'haiku');
    assert.equal(config.models.escalation, DEFAULT_CONFIG.models.escalation);
    assert.equal(config.maxIterations, 5);
    assert.equal(config.consensus.quorumSize, DEFAULT_CONFIG.consensus.quorumSize);
  });
});

describe('resolveSugarBin', () => {
  it('prefers an explicit config override', () => {
    assert.equal(resolveSugarBin('/custom/sugar'), '/custom/sugar');
  });

  it('falls back to this package own compiled entrypoint', () => {
    // Resolved relative to config.js's own compiled location, so it's correct
    // under both the flat production build (dist/index.js) and the nested
    // test build (dist/src/index.js) — just assert the shape, not the exact path.
    const bin = resolveSugarBin(undefined);
    assert.match(bin, /^node ".*index\.js"$/);
  });
});

describe('resolveWorkspaceBasePath', () => {
  it('uses the configured base path when set', () => {
    const config = { ...DEFAULT_CONFIG, workspaceBasePath: '/custom/base' };
    assert.equal(resolveWorkspaceBasePath(config, '/repo/myapp'), '/custom/base');
  });

  it('defaults to /tmp/<repo>-phases when unset', () => {
    assert.equal(resolveWorkspaceBasePath(DEFAULT_CONFIG, '/repo/myapp'), path.join('/tmp', 'myapp-phases'));
  });
});