import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { findRepoRoot } from '../src/lib/config';

describe('skill platform copies stay in sync with the canonical SKILL.md', () => {
  it('reports no drift via `node scripts/sync-skills.ts --check`', () => {
    const repoRoot = findRepoRoot(__dirname);
    const scriptPath = path.join(repoRoot, 'scripts', 'sync-skills.ts');

    // Throws (non-zero exit) with a list of stale files if any of the 6
    // generated platform copies (.agents, .opencode, .gemini, .github/agents,
    // .github/prompts, .cursor) have drifted from .claude/skills/orchestrate/SKILL.md.
    // Fix by running `npm run sync-skills` after editing the canonical file.
    assert.doesNotThrow(() => {
      execFileSync('node', [scriptPath, '--check'], { cwd: repoRoot, encoding: 'utf-8' });
    });
  });
});