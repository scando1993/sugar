import * as fs from 'fs';
import * as path from 'path';
import { PrdJson, Vote, UserStory, VoteCastEvent, StoryPassedEvent } from '../types';

export class ConsensusEngine {
  private quorumSize: number;
  private requiredMajority: number;

  constructor(quorumSize: number, requiredMajority: number) {
    this.quorumSize = quorumSize;
    this.requiredMajority = requiredMajority;
  }

  tallyVotes(votes: Vote[]): { passed: boolean; passCount: number; failCount: number } {
    const passCount = votes.filter(v => v.result === 'pass').length;
    const failCount = votes.filter(v => v.result === 'fail').length;
    return {
      passed: passCount >= this.requiredMajority,
      passCount,
      failCount,
    };
  }

  recordVote(prdPath: string, storyId: string, vote: Vote): VoteCastEvent {
    const prd = this.readPrd(prdPath);
    const story = prd.userStories.find(s => s.id === storyId);
    if (!story) throw new Error(`Story ${storyId} not found in ${prdPath}`);

    if (!story.votes) story.votes = [];
    story.votes.push(vote);
    this.writePrd(prdPath, prd);

    return {
      type: 'vote_cast',
      storyId,
      verifier: vote.verifier,
      result: vote.result,
      reason: vote.reason,
      timestamp: vote.timestamp || new Date().toISOString(),
    };
  }

  updateStoryStatus(prdPath: string, storyId: string, status: 'passed' | 'rejected'): void {
    const prd = this.readPrd(prdPath);
    const story = prd.userStories.find(s => s.id === storyId);
    if (!story) throw new Error(`Story ${storyId} not found in ${prdPath}`);
    story.status = status;
    this.writePrd(prdPath, prd);
  }

  incrementTerm(prdPath: string, storyId: string): number {
    const prd = this.readPrd(prdPath);
    const story = prd.userStories.find(s => s.id === storyId);
    if (!story) throw new Error(`Story ${storyId} not found in ${prdPath}`);
    story.term = (story.term || 0) + 1;
    this.writePrd(prdPath, prd);
    return story.term;
  }

  logRejection(workspacePath: string, storyId: string, reason: string): void {
    const logPath = path.join(workspacePath, 'rejection_log.txt');
    const entry = `[${new Date().toISOString()}] REJECTED ${storyId}: ${reason}\n`;
    fs.appendFileSync(logPath, entry);
  }

  runConsensusRound(
    prdPath: string,
    storyId: string,
    voteResults: Array<{ result: 'pass' | 'fail'; reason?: string }>
  ): StoryPassedEvent | null {
    const prd = this.readPrd(prdPath);
    const story = prd.userStories.find(s => s.id === storyId);
    if (!story) throw new Error(`Story ${storyId} not found`);

    const term = story.term || 0;
    const votes: Vote[] = voteResults.map((v, i) => ({
      term,
      verifier: i + 1,
      result: v.result,
      reason: v.reason,
      timestamp: new Date().toISOString(),
    }));

    // Record all votes
    if (!story.votes) story.votes = [];
    story.votes.push(...votes);

    const tally = this.tallyVotes(votes);

    if (tally.passed) {
      story.status = 'passed';
      this.writePrd(prdPath, prd);
      return {
        type: 'story_passed',
        storyId,
        timestamp: new Date().toISOString(),
        term,
        passVotes: tally.passCount,
        totalVotes: votes.length,
      };
    }

    // Rejected — increment term
    story.status = 'rejected';
    story.term = term + 1;
    this.writePrd(prdPath, prd);
    return null;
  }

  private readPrd(prdPath: string): PrdJson {
    return JSON.parse(fs.readFileSync(prdPath, 'utf-8'));
  }

  private writePrd(prdPath: string, prd: PrdJson): void {
    fs.writeFileSync(prdPath, JSON.stringify(prd, null, 2));
  }
}
