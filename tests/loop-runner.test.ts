import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { LoopRunner } from '../src/lib/loop-runner';
import { AgentRunner } from '../src/lib/agent-runner';
import { PrdJson, DEFAULT_CONFIG, SugarConfig } from '../src/types';

function makeConfig(overrides: Partial<SugarConfig> = {}): SugarConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

function makePrd(stories: Partial<PrdJson['userStories'][number]>[], consensusOverrides: Partial<PrdJson['consensus']> = {}): PrdJson {
  return {
    project: 'test',
    branchName: 'phase-a',
    description: 'test phase',
    consensus: {
      quorumSize: 1,
      requiredMajority: 1,
      implementModel: 'sonnet',
      verifyModel: 'sonnet',
      escalationModel: 'opus',
      maxTerms: 3,
      ...consensusOverrides,
    },
    userStories: stories.map((s, i) => ({
      id: s.id || `US-00${i + 1}`,
      title: s.title || `Story ${i + 1}`,
      description: s.description || 'As a dev, I need this',
      acceptanceCriteria: s.acceptanceCriteria || ['Works', 'Typecheck passes'],
      priority: s.priority ?? i + 1,
      status: s.status || 'pending',
      term: s.term ?? 0,
      votes: s.votes || [],
      notes: s.notes || '',
    })),
  };
}

/**
 * A stub AgentRunner that plays both roles LoopRunner spawns against:
 * - implementer (CLAUDE.md content): finds the "implementing" story, writes a
 *   real file change + .sugar-result.json, mirroring what a real agent does.
 * - verifier (VERIFY.md + "## Target Story" marker added by Verifier.runQuorum):
 *   votes PASS unless the story id is in `rejectFor`.
 */
function makeStubAgentRunner(
  workspacePath: string,
  opts: { failImplementFor?: Set<string>; rejectVerifyFor?: Set<string>; modelsSeen?: string[] } = {},
): AgentRunner {
  return (prompt: string, model: string): string => {
    opts.modelsSeen?.push(model);

    if (prompt.includes('## Target Story')) {
      const match = prompt.match(/Verify story: ([A-Za-z]+-\d+)/);
      const storyId = match ? match[1] : '';
      if (opts.rejectVerifyFor?.has(storyId)) {
        return 'VOTE:FAIL:Typecheck passes:stubbed rejection';
      }
      return 'VOTE:PASS';
    }

    const prd: PrdJson = JSON.parse(fs.readFileSync(path.join(workspacePath, 'prd.json'), 'utf-8'));
    const story = prd.userStories.find(s => s.status === 'implementing');
    if (!story) return 'PHASE_COMPLETE';

    if (opts.failImplementFor?.has(story.id)) {
      fs.writeFileSync(
        path.join(workspacePath, '.sugar-result.json'),
        JSON.stringify({ outcome: 'failed', notes: 'stubbed implementer failure' }),
      );
      return 'STORY_FAILED';
    }

    fs.writeFileSync(path.join(workspacePath, `${story.id}.txt`), `implemented ${story.id}\n`);
    fs.writeFileSync(
      path.join(workspacePath, '.sugar-result.json'),
      JSON.stringify({ storyId: story.id, outcome: 'implemented' }),
    );
    return `STORY_IMPLEMENTED:${story.id}`;
  };
}

describe('LoopRunner', () => {
  let tmpDir: string;
  let workspace: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-looprunner-'));
    workspace = path.join(tmpDir, 'phase-a');
    fs.mkdirSync(workspace);
    execSync('git init -q', { cwd: workspace });
    execSync('git config user.email t@t.com', { cwd: workspace });
    execSync('git config user.name t', { cwd: workspace });
    fs.writeFileSync(path.join(workspace, 'CLAUDE.md'), '# Ralph Agent\n\nImplement your story.\n');
    fs.writeFileSync(path.join(workspace, 'VERIFY.md'), '# Verifier Agent\n\nVote VOTE:PASS or VOTE:FAIL.\n');
    execSync('git add . && git commit -q -m init', { cwd: workspace });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writePrd(prd: PrdJson): void {
    fs.writeFileSync(path.join(workspace, 'prd.json'), JSON.stringify(prd, null, 2));
  }

  function readPrd(): PrdJson {
    return JSON.parse(fs.readFileSync(path.join(workspace, 'prd.json'), 'utf-8'));
  }

  it('completes a multi-story fixture, committing each story once verified', () => {
    writePrd(makePrd([{ id: 'US-001' }, { id: 'US-002' }]));
    const runner = new LoopRunner(workspace, makeConfig(), makeStubAgentRunner(workspace));
    const result = runner.run(10);

    assert.equal(result.status, 'complete');
    assert.equal(result.passed, 2);
    assert.equal(result.total, 2);

    const log = execSync('git log --oneline', { cwd: workspace, encoding: 'utf-8' });
    assert.ok(log.includes('US-001'));
    assert.ok(log.includes('US-002'));

    const prd = readPrd();
    assert.ok(prd.userStories.every(s => s.status === 'passed'));
  });

  it('never leaves a story stuck in "implementing" when the agent throws (simulated crash/timeout)', () => {
    writePrd(makePrd([{ id: 'US-001' }], { maxTerms: 5 }));
    const throwingRunner: AgentRunner = () => { throw new Error('simulated spawn timeout'); };
    const runner = new LoopRunner(workspace, makeConfig(), throwingRunner);
    runner.run(1);

    const prd = readPrd();
    assert.notEqual(prd.userStories[0].status, 'implementing');
    assert.equal(prd.userStories[0].status, 'rejected');
  });

  it('blocks a story once verifier rejections reach maxTerms, instead of looping forever', () => {
    writePrd(makePrd([{ id: 'US-001' }], { maxTerms: 2 }));
    const stub = makeStubAgentRunner(workspace, { rejectVerifyFor: new Set(['US-001']) });
    const runner = new LoopRunner(workspace, makeConfig(), stub);
    const result = runner.run(10);

    assert.equal(result.status, 'stuck');
    assert.deepEqual(result.blocked, ['US-001']);
    const prd = readPrd();
    assert.equal(prd.userStories[0].status, 'blocked');
    assert.ok(prd.userStories[0].notes.includes('Blocked after'));
  });

  it('reports max_iterations when rejected work remains but maxTerms has not been reached', () => {
    writePrd(makePrd([{ id: 'US-001' }], { maxTerms: 100 }));
    const stub = makeStubAgentRunner(workspace, { rejectVerifyFor: new Set(['US-001']) });
    const runner = new LoopRunner(workspace, makeConfig(), stub);
    const result = runner.run(3);

    assert.equal(result.status, 'max_iterations');
    assert.equal(result.iterations, 3);
    const prd = readPrd();
    assert.equal(prd.userStories[0].status, 'rejected');
    assert.equal(prd.userStories[0].term, 3);
  });

  it('namespaces snapshot tags per phase with a real, persisted per-story attempt counter', () => {
    writePrd(makePrd([{ id: 'US-001' }], { maxTerms: 100 }));
    const stub = makeStubAgentRunner(workspace, { rejectVerifyFor: new Set(['US-001']) });
    new LoopRunner(workspace, makeConfig(), stub).run(3);

    const tags = execSync('git tag', { cwd: workspace, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    const phaseName = path.basename(workspace);
    assert.deepEqual(
      tags.sort(),
      [
        `sugar/${phaseName}/US-001/attempt-1`,
        `sugar/${phaseName}/US-001/attempt-2`,
        `sugar/${phaseName}/US-001/attempt-3`,
      ].sort(),
    );
  });

  it('persists model tier and attempt state across separate LoopRunner instances (resume)', () => {
    writePrd(makePrd([{ id: 'US-001' }], { maxTerms: 100 }));
    const stub = makeStubAgentRunner(workspace, { rejectVerifyFor: new Set(['US-001']) });

    new LoopRunner(workspace, makeConfig(), stub).run(1);
    assert.equal(readPrd().userStories[0].term, 1);

    // A fresh LoopRunner instance (simulating a resumed/re-launched loop) must
    // continue the attempt counter rather than restarting it at 1.
    new LoopRunner(workspace, makeConfig(), stub).run(1);
    assert.equal(readPrd().userStories[0].term, 2);

    const tags = execSync('git tag', { cwd: workspace, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    const phaseName = path.basename(workspace);
    assert.ok(tags.includes(`sugar/${phaseName}/US-001/attempt-1`));
    assert.ok(tags.includes(`sugar/${phaseName}/US-001/attempt-2`));

    const state = JSON.parse(fs.readFileSync(path.join(workspace, '.sugar-state.json'), 'utf-8'));
    assert.equal(state.attempts['US-001'], 2);
  });

  it('escalates the model after consecutive unverified implementer failures and persists it', () => {
    writePrd(makePrd([{ id: 'US-001' }], { maxTerms: 100 }));
    const modelsSeen: string[] = [];
    const stub = makeStubAgentRunner(workspace, { failImplementFor: new Set(['US-001']), modelsSeen });
    const config = makeConfig({ escalation: { threshold: 2 } });

    new LoopRunner(workspace, config, stub).run(3);

    // First two attempts on the default model, third escalated to opus.
    assert.deepEqual(modelsSeen, ['sonnet', 'sonnet', 'opus']);
    const state = JSON.parse(fs.readFileSync(path.join(workspace, '.sugar-state.json'), 'utf-8'));
    assert.equal(state.modelTier.currentModel, 'opus');
  });

  it('falls back to stdout markers when the agent does not write .sugar-result.json', () => {
    writePrd(makePrd([{ id: 'US-001' }]));
    const legacyRunner: AgentRunner = (prompt) => {
      if (prompt.includes('## Target Story')) return 'VOTE:PASS';
      fs.writeFileSync(path.join(workspace, 'US-001.txt'), 'done\n');
      return 'Some narration...\nSTORY_IMPLEMENTED:US-001';
    };
    const runner = new LoopRunner(workspace, makeConfig(), legacyRunner);
    const result = runner.run(5);

    assert.equal(result.status, 'complete');
    assert.equal(readPrd().userStories[0].status, 'passed');
  });
});