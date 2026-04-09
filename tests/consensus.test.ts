import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConsensusEngine } from '../src/lib/consensus';
import { PrdJson } from '../src/types';

describe('ConsensusEngine', () => {
  let tmpDir: string;
  let prdPath: string;
  const testPrd: PrdJson = {
    project: 'test',
    branchName: 'test-branch',
    description: 'test phase',
    consensus: {
      quorumSize: 3,
      requiredMajority: 2,
      implementModel: 'sonnet',
      verifyModel: 'sonnet',
      escalationModel: 'opus',
      maxTerms: 3,
    },
    userStories: [
      {
        id: 'US-001',
        title: 'Test story',
        description: 'As a dev, I need tests',
        acceptanceCriteria: ['Tests pass', 'Typecheck passes'],
        priority: 1,
        status: 'implementing',
        term: 0,
        votes: [],
        notes: '',
      },
    ],
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-test-'));
    prdPath = path.join(tmpDir, 'prd.json');
    fs.writeFileSync(prdPath, JSON.stringify(testPrd, null, 2));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('tallyVotes', () => {
    it('passes when majority reached', () => {
      const engine = new ConsensusEngine(3, 2);
      const result = engine.tallyVotes([
        { term: 0, verifier: 1, result: 'pass' },
        { term: 0, verifier: 2, result: 'pass' },
        { term: 0, verifier: 3, result: 'fail', reason: 'bad' },
      ]);
      assert.equal(result.passed, true);
      assert.equal(result.passCount, 2);
      assert.equal(result.failCount, 1);
    });

    it('fails when majority not reached', () => {
      const engine = new ConsensusEngine(3, 2);
      const result = engine.tallyVotes([
        { term: 0, verifier: 1, result: 'pass' },
        { term: 0, verifier: 2, result: 'fail', reason: 'bad' },
        { term: 0, verifier: 3, result: 'fail', reason: 'worse' },
      ]);
      assert.equal(result.passed, false);
      assert.equal(result.passCount, 1);
      assert.equal(result.failCount, 2);
    });

    it('handles unanimous pass', () => {
      const engine = new ConsensusEngine(3, 2);
      const result = engine.tallyVotes([
        { term: 0, verifier: 1, result: 'pass' },
        { term: 0, verifier: 2, result: 'pass' },
        { term: 0, verifier: 3, result: 'pass' },
      ]);
      assert.equal(result.passed, true);
      assert.equal(result.passCount, 3);
    });
  });

  describe('runConsensusRound', () => {
    it('marks story as passed on majority pass', () => {
      const engine = new ConsensusEngine(3, 2);
      const event = engine.runConsensusRound(prdPath, 'US-001', [
        { result: 'pass' },
        { result: 'pass' },
        { result: 'fail', reason: 'nit' },
      ]);
      assert.notEqual(event, null);
      assert.equal(event!.type, 'story_passed');
      assert.equal(event!.storyId, 'US-001');

      const prd: PrdJson = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
      assert.equal(prd.userStories[0].status, 'passed');
      assert.equal(prd.userStories[0].votes.length, 3);
    });

    it('marks story as rejected and increments term on majority fail', () => {
      const engine = new ConsensusEngine(3, 2);
      const event = engine.runConsensusRound(prdPath, 'US-001', [
        { result: 'fail', reason: 'bad' },
        { result: 'fail', reason: 'worse' },
        { result: 'pass' },
      ]);
      assert.equal(event, null);

      const prd: PrdJson = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
      assert.equal(prd.userStories[0].status, 'rejected');
      assert.equal(prd.userStories[0].term, 1);
    });
  });

  describe('updateStoryStatus', () => {
    it('updates status in prd.json', () => {
      const engine = new ConsensusEngine(3, 2);
      engine.updateStoryStatus(prdPath, 'US-001', 'passed');
      const prd: PrdJson = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
      assert.equal(prd.userStories[0].status, 'passed');
    });

    it('throws for unknown story', () => {
      const engine = new ConsensusEngine(3, 2);
      assert.throws(() => engine.updateStoryStatus(prdPath, 'US-999', 'passed'));
    });
  });

  describe('logRejection', () => {
    it('appends to rejection_log.txt', () => {
      const engine = new ConsensusEngine(3, 2);
      engine.logRejection(tmpDir, 'US-001', 'Tests failed');
      const log = fs.readFileSync(path.join(tmpDir, 'rejection_log.txt'), 'utf-8');
      assert.ok(log.includes('REJECTED US-001'));
      assert.ok(log.includes('Tests failed'));
    });
  });
});
