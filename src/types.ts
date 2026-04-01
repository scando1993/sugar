export interface Vote {
  term: number;
  verifier: number;
  result: 'pass' | 'fail';
  reason?: string;
  timestamp?: string;
}

export interface ConsensusConfig {
  quorumSize: number;
  requiredMajority: number;
  implementModel: string;
  verifyModel: string;
  escalationModel: string;
  maxTerms: number;
}

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  status: 'pending' | 'implementing' | 'verifying' | 'passed' | 'rejected' | 'blocked';
  term: number;
  votes: Vote[];
  notes: string;
}

export interface PrdJson {
  project: string;
  branchName: string;
  description: string;
  consensus: ConsensusConfig;
  userStories: UserStory[];
}

export interface ValidationError {
  field: string;
  message: string;
  storyId?: string;
}
