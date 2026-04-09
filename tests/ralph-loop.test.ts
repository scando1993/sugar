import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RalphLoop } from '../src/lib/ralph-loop';
import { ModelTier } from '../src/lib/model-tier';
import { ConsensusEngine } from '../src/lib/consensus';
import { PrdJson } from '../src/types';

describe('RalphLoop', () => {
  let tmpDir: string;
  let loop: RalphLoop;
  const testPrd: PrdJson = {
    project: 'test',
    branchName: 'test-branch',
    description: 'test',
    consensus: {
      quorumSize: 3,
      requiredMajority: 2,
      implementModel: 'sonnet',
      verifyModel: 'sonnet',
      escalationModel: 'opus',
      maxTerms: 3,
    },
    userStories: [
      { id: 'US-001', title: 'First', description: 'First story', acceptanceCriteria: ['Works', 'Typecheck passes'], priority: 1, status: 'passed', term: 0, votes: [], notes: '' },
      { id: 'US-002', title: 'Second', description: 'Second story', acceptanceCriteria: ['Works', 'Typecheck passes'], priority: 2, status: 'pending', term: 0, votes: [], notes: '' },
      { id: 'US-003', title: 'Third', description: 'Third story', acceptanceCriteria: ['Works', 'Typecheck passes'], priority: 3, status: 'rejected', term: 1, votes: [], notes: '' },
    ],
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-ralph-'));
    fs.writeFileSync(path.join(tmpDir, 'prd.json'), JSON.stringify(testPrd, null, 2));
    fs.writeFileSync(path.join(tmpDir, 'progress.txt'), '# Progress\n');
    const modelTier = new ModelTier('sonnet', 'opus', 2);
    const consensus = new ConsensusEngine(3, 2);
    loop = new RalphLoop(tmpDir, modelTier, consensus);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('pickNextStory', () => {
    it('picks highest priority pending/rejected story', () => {
      const story = loop.pickNextStory();
      assert.notEqual(story, null);
      assert.equal(story!.id, 'US-002'); // pending, priority 2
    });

    it('returns null when all passed', () => {
      const prd = JSON.parse(fs.readFileSync(path.join(tmpDir, 'prd.json'), 'utf-8'));
      prd.userStories.forEach((s: any) => { s.status = 'passed'; });
      fs.writeFileSync(path.join(tmpDir, 'prd.json'), JSON.stringify(prd));
      const story = loop.pickNextStory();
      assert.equal(story, null);
    });

    it('picks rejected story when no pending', () => {
      const prd = JSON.parse(fs.readFileSync(path.join(tmpDir, 'prd.json'), 'utf-8'));
      prd.userStories[1].status = 'passed'; // US-002
      fs.writeFileSync(path.join(tmpDir, 'prd.json'), JSON.stringify(prd));
      const story = loop.pickNextStory();
      assert.notEqual(story, null);
      assert.equal(story!.id, 'US-003'); // rejected
    });
  });

  describe('isPhaseComplete', () => {
    it('returns false when stories remain', () => {
      assert.equal(loop.isPhaseComplete(), false);
    });

    it('returns true when all passed', () => {
      const prd = JSON.parse(fs.readFileSync(path.join(tmpDir, 'prd.json'), 'utf-8'));
      prd.userStories.forEach((s: any) => { s.status = 'passed'; });
      fs.writeFileSync(path.join(tmpDir, 'prd.json'), JSON.stringify(prd));
      assert.equal(loop.isPhaseComplete(), true);
    });
  });

  describe('getProgress', () => {
    it('reports correct counts', () => {
      const p = loop.getProgress();
      assert.equal(p.passed, 1);
      assert.equal(p.total, 3);
      assert.equal(p.pending, 2); // pending + rejected
      assert.equal(p.blocked, 0);
    });
  });

  describe('setStoryStatus', () => {
    it('updates status in prd.json', () => {
      loop.setStoryStatus('US-002', 'implementing');
      const prd: PrdJson = JSON.parse(fs.readFileSync(path.join(tmpDir, 'prd.json'), 'utf-8'));
      assert.equal(prd.userStories[1].status, 'implementing');
    });

    it('throws for unknown story', () => {
      assert.throws(() => loop.setStoryStatus('US-999', 'passed'));
    });
  });

  describe('recordProgress', () => {
    it('appends to progress.txt', () => {
      loop.recordProgress('US-002', 'passed', '  - Learned something');
      const content = fs.readFileSync(path.join(tmpDir, 'progress.txt'), 'utf-8');
      assert.ok(content.includes('US-002'));
      assert.ok(content.includes('Learned something'));
    });
  });

  describe('recordFailure', () => {
    it('writes failure_log.json', () => {
      loop.recordFailure('US-002', 1, 'typecheck failed', ['src/foo.ts']);
      const logPath = path.join(tmpDir, 'failure_log.json');
      assert.ok(fs.existsSync(logPath));
      const reports = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      assert.equal(reports.length, 1);
      assert.equal(reports[0].storyId, 'US-002');
      assert.equal(reports[0].failureType, 'typecheck');
    });

    it('appends to existing failure log', () => {
      loop.recordFailure('US-002', 1, 'typecheck error');
      loop.recordFailure('US-002', 2, 'lint error');
      const reports = JSON.parse(fs.readFileSync(path.join(tmpDir, 'failure_log.json'), 'utf-8'));
      assert.equal(reports.length, 2);
    });
  });
});
