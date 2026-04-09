import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PatternManager } from '../src/lib/patterns';

describe('PatternManager', () => {
  let tmpDir: string;
  let mgr: PatternManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-pattern-'));
    mgr = new PatternManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('extractPatterns', () => {
    it('extracts patterns from progress.txt format', () => {
      const content = `# Phase Progress Log

## Codebase Patterns

- **Use barrel exports**: All modules export via index.ts
- **Error types**: Use typed errors extending BaseError

## 2024-01-01 - US-001
- Implemented types
`;
      const patterns = mgr.extractPatterns(content);
      assert.equal(patterns.length, 2);
      assert.ok(patterns[0].description.includes('barrel exports'));
      assert.ok(patterns[1].description.includes('Error types'));
    });

    it('returns empty for no patterns section', () => {
      const content = `# Phase Progress Log\n\n## 2024-01-01 - US-001\n- Done`;
      const patterns = mgr.extractPatterns(content);
      assert.equal(patterns.length, 0);
    });
  });

  describe('mergePatterns', () => {
    it('deduplicates by description', () => {
      const existing = [{ id: 'P1', learned_in: 'a', description: 'Use barrel exports', applies_to: [], confidence: 'high' as const }];
      const discovered = [
        { id: 'P2', learned_in: 'b', description: 'Use barrel exports', applies_to: [], confidence: 'medium' as const },
        { id: 'P3', learned_in: 'b', description: 'New pattern', applies_to: [], confidence: 'medium' as const },
      ];
      const merged = mgr.mergePatterns(existing, discovered);
      assert.equal(merged.length, 2);
    });

    it('merges all when no overlap', () => {
      const existing = [{ id: 'P1', learned_in: 'a', description: 'Pattern A', applies_to: [], confidence: 'high' as const }];
      const discovered = [{ id: 'P2', learned_in: 'b', description: 'Pattern B', applies_to: [], confidence: 'high' as const }];
      const merged = mgr.mergePatterns(existing, discovered);
      assert.equal(merged.length, 2);
    });
  });

  describe('injectPatterns', () => {
    it('injects into Known Patterns section', () => {
      const claudeMd = `# Agent\n\n## Known Patterns\n\n_(empty)_\n\n## Rules\n- Follow patterns`;
      const patterns = [{ id: 'P1', learned_in: 'phase-a', description: 'Use barrel exports', applies_to: [], confidence: 'high' as const }];
      const result = mgr.injectPatterns(claudeMd, patterns);
      assert.ok(result.includes('**P1** (from phase-a)'));
      assert.ok(result.includes('## Rules'));
    });

    it('appends if no Known Patterns marker', () => {
      const claudeMd = `# Agent\n\n## Rules\n- Do stuff`;
      const patterns = [{ id: 'P1', learned_in: 'a', description: 'Test', applies_to: [], confidence: 'high' as const }];
      const result = mgr.injectPatterns(claudeMd, patterns);
      assert.ok(result.includes('## Known Patterns'));
      assert.ok(result.includes('**P1**'));
    });

    it('returns unchanged if no patterns', () => {
      const claudeMd = '# Agent';
      const result = mgr.injectPatterns(claudeMd, []);
      assert.equal(result, claudeMd);
    });
  });

  describe('readPatterns / writePatterns', () => {
    it('round-trips patterns.json', () => {
      const data = { patterns: [{ id: 'P1', learned_in: 'a', description: 'Test', applies_to: ['b'], confidence: 'high' as const }] };
      mgr.writePatterns(data);
      const read = mgr.readPatterns();
      assert.deepEqual(read, data);
    });

    it('returns empty when file missing', () => {
      const read = mgr.readPatterns();
      assert.deepEqual(read, { patterns: [] });
    });
  });
});
