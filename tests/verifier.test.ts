import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Verifier, parseVote } from '../src/lib/verifier';
import { AgentRunner } from '../src/lib/agent-runner';
import { PrdJson } from '../src/types';

describe('parseVote', () => {
  it('parses VOTE:PASS', () => {
    assert.deepEqual(parseVote('some reasoning...\nVOTE:PASS'), { result: 'pass' });
  });

  it('parses VOTE:FAIL with criterion and reason', () => {
    const vote = parseVote('VOTE:FAIL:Typecheck passes:TypeScript error in src/foo.ts');
    assert.equal(vote.result, 'fail');
    assert.equal(vote.reason, 'Typecheck passes: TypeScript error in src/foo.ts');
  });

  it('parses bare VOTE:FAIL without structured reason', () => {
    const vote = parseVote('VOTE:FAIL');
    assert.equal(vote.result, 'fail');
    assert.ok(vote.reason);
  });

  it('treats missing vote markers as a fail', () => {
    const vote = parseVote('I think this looks fine.');
    assert.equal(vote.result, 'fail');
    assert.ok(vote.reason?.includes('no VOTE:PASS or VOTE:FAIL'));
  });
});

describe('Verifier', () => {
  let tmpDir: string;
  let prdPath: string;

  function makePrd(overrides: Partial<PrdJson['consensus']> = {}): PrdJson {
    return {
      project: 'test',
      branchName: 'phase-a',
      description: 'test phase',
      consensus: {
        quorumSize: 3,
        requiredMajority: 2,
        implementModel: 'sonnet',
        verifyModel: 'sonnet',
        escalationModel: 'opus',
        maxTerms: 3,
        ...overrides,
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
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-verifier-'));
    prdPath = path.join(tmpDir, 'prd.json');
    fs.writeFileSync(path.join(tmpDir, 'VERIFY.md'), '# Verifier Agent\n\nVote VOTE:PASS or VOTE:FAIL.\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writePrd(prd: PrdJson): void {
    fs.writeFileSync(prdPath, JSON.stringify(prd, null, 2));
  }

  it('marks story passed when quorum votes pass', () => {
    writePrd(makePrd());
    let calls = 0;
    const stub: AgentRunner = () => { calls++; return 'looks good\nVOTE:PASS'; };
    const verifier = new Verifier(tmpDir, stub);
    const result = verifier.runQuorum('US-001');

    assert.equal(calls, 3); // one call per quorum seat
    assert.equal(result.passed, true);
    assert.equal(result.status, 'passed');
    const prd: PrdJson = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
    assert.equal(prd.userStories[0].status, 'passed');
  });

  it('marks story rejected on majority fail, below maxTerms', () => {
    writePrd(makePrd({ maxTerms: 3 }));
    let calls = 0;
    const stub: AgentRunner = () => {
      calls++;
      return calls === 1 ? 'VOTE:PASS' : 'VOTE:FAIL:Typecheck passes:type error';
    };
    const verifier = new Verifier(tmpDir, stub);
    const result = verifier.runQuorum('US-001');

    assert.equal(result.passed, false);
    assert.equal(result.status, 'rejected');
    const prd: PrdJson = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
    assert.equal(prd.userStories[0].status, 'rejected');
    assert.equal(prd.userStories[0].term, 1);
  });

  it('logs rejection reasons to rejection_log.txt', () => {
    writePrd(makePrd());
    const stub: AgentRunner = () => 'VOTE:FAIL:Tests pass:assertion failed in foo.test.ts';
    const verifier = new Verifier(tmpDir, stub);
    verifier.runQuorum('US-001');

    const log = fs.readFileSync(path.join(tmpDir, 'rejection_log.txt'), 'utf-8');
    assert.ok(log.includes('REJECTED US-001'));
    assert.ok(log.includes('assertion failed in foo.test.ts'));
  });

  it('blocks the story once term reaches maxTerms instead of looping forever', () => {
    const prd = makePrd({ maxTerms: 2 });
    prd.userStories[0].term = 1; // already rejected once
    writePrd(prd);

    const stub: AgentRunner = () => 'VOTE:FAIL:Typecheck passes:still broken';
    const verifier = new Verifier(tmpDir, stub);
    const result = verifier.runQuorum('US-001');

    assert.equal(result.passed, false);
    assert.equal(result.status, 'blocked');
    const updated: PrdJson = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
    assert.equal(updated.userStories[0].status, 'blocked');
    assert.ok(updated.userStories[0].notes.includes('Blocked after'));
  });

  it('throws if VERIFY.md is missing', () => {
    writePrd(makePrd());
    fs.rmSync(path.join(tmpDir, 'VERIFY.md'));
    const verifier = new Verifier(tmpDir, () => 'VOTE:PASS');
    assert.throws(() => verifier.runQuorum('US-001'), /VERIFY\.md not found/);
  });

  it('throws for an unknown story id', () => {
    writePrd(makePrd());
    const verifier = new Verifier(tmpDir, () => 'VOTE:PASS');
    assert.throws(() => verifier.runQuorum('US-999'), /not found/);
  });

  it('honors a model override without changing prd.consensus.verifyModel', () => {
    writePrd(makePrd({ verifyModel: 'sonnet' }));
    const seenModels: string[] = [];
    const stub: AgentRunner = (_prompt, model) => { seenModels.push(model); return 'VOTE:PASS'; };
    const verifier = new Verifier(tmpDir, stub);
    verifier.runQuorum('US-001', 'opus');

    assert.ok(seenModels.every(m => m === 'opus'));
  });
});