import * as fs from 'fs';
import * as path from 'path';
import { PrdJson, StoryStatus } from '../types';
import { ConsensusEngine } from './consensus';
import { AgentRunner } from './agent-runner';

export interface VerifyResult {
  storyId: string;
  passed: boolean;
  status: StoryStatus;
  passVotes: number;
  failVotes: number;
  reasons: string[];
}

/** Parses a verifier agent's raw stdout into a pass/fail vote. */
export function parseVote(output: string): { result: 'pass' | 'fail'; reason?: string } {
  if (/VOTE:PASS/.test(output)) return { result: 'pass' };

  const failMatch = output.match(/VOTE:FAIL:([^:\n]+):(.+)/);
  if (failMatch) {
    return { result: 'fail', reason: `${failMatch[1].trim()}: ${failMatch[2].trim()}` };
  }
  if (/VOTE:FAIL/.test(output)) {
    return { result: 'fail', reason: 'verifier did not specify a criterion/reason' };
  }
  return { result: 'fail', reason: 'no VOTE:PASS or VOTE:FAIL found in verifier output' };
}

/**
 * Runs the verifier quorum for a single story: spawns `quorumSize` independent
 * verifier agents against VERIFY.md, tallies their votes via ConsensusEngine,
 * and enforces maxTerms so a story that keeps failing consensus is parked as
 * "blocked" instead of looping forever between "rejected" and "implementing".
 *
 * All consensus parameters (quorumSize, requiredMajority, verifyModel, maxTerms)
 * are read from the workspace's own prd.json — it is the self-contained source
 * of truth for a given phase, not the repo-wide sugar.config.json.
 */
export class Verifier {
  constructor(private workspacePath: string, private agentRunner: AgentRunner) {}

  runQuorum(storyId: string, modelOverride?: string): VerifyResult {
    const prdPath = path.join(this.workspacePath, 'prd.json');
    const verifyMdPath = path.join(this.workspacePath, 'VERIFY.md');

    if (!fs.existsSync(prdPath)) throw new Error(`prd.json not found in ${this.workspacePath}`);
    if (!fs.existsSync(verifyMdPath)) throw new Error(`VERIFY.md not found in ${this.workspacePath}`);

    const prd: PrdJson = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
    const story = prd.userStories.find(s => s.id === storyId);
    if (!story) throw new Error(`Story ${storyId} not found in ${prdPath}`);

    const { quorumSize, requiredMajority, verifyModel, maxTerms } = prd.consensus;
    const consensus = new ConsensusEngine(quorumSize, requiredMajority);
    const model = modelOverride || verifyModel;

    const verifyMd = fs.readFileSync(verifyMdPath, 'utf-8');
    const prompt = `${verifyMd}\n\n## Target Story\n\nVerify story: ${storyId}\n`;

    const voteResults: Array<{ result: 'pass' | 'fail'; reason?: string }> = [];
    for (let i = 0; i < quorumSize; i++) {
      voteResults.push(parseVote(this.agentRunner(prompt, model)));
    }

    const tally = consensus.tallyVotes(
      voteResults.map((v, i) => ({ term: story.term, verifier: i + 1, result: v.result, reason: v.reason })),
    );
    const reasons = voteResults.filter(v => v.result === 'fail' && v.reason).map(v => v.reason as string);

    const passedEvent = consensus.runConsensusRound(prdPath, storyId, voteResults);
    if (passedEvent) {
      return { storyId, passed: true, status: 'passed', passVotes: tally.passCount, failVotes: tally.failCount, reasons };
    }

    // Rejected — runConsensusRound already incremented term and set status "rejected".
    for (const reason of reasons) {
      consensus.logRejection(this.workspacePath, storyId, reason);
    }

    const updated: PrdJson = JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
    const updatedStory = updated.userStories.find(s => s.id === storyId)!;

    if (updatedStory.term >= maxTerms) {
      updatedStory.status = 'blocked';
      updatedStory.notes = `Blocked after ${updatedStory.term} rejected term(s), reaching maxTerms (${maxTerms}). Last vote reasons: ${reasons.join('; ') || 'none recorded'}.`;
      fs.writeFileSync(prdPath, JSON.stringify(updated, null, 2));
      return { storyId, passed: false, status: 'blocked', passVotes: tally.passCount, failVotes: tally.failCount, reasons };
    }

    return { storyId, passed: false, status: 'rejected', passVotes: tally.passCount, failVotes: tally.failCount, reasons };
  }
}