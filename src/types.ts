export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  notes: string;
}

export interface PrdJson {
  project: string;
  branchName: string;
  description: string;
  userStories: UserStory[];
}

export interface ValidationError {
  field: string;
  message: string;
  storyId?: string;
}
