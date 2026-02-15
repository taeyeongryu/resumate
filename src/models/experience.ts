export interface DraftEntry {
  filepath: string;
  filename: string;
  content: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface QuestionAnswer {
  question: string;
  answer?: string;
  askedAt: Date;
}

export interface InProgressEntry {
  filepath: string;
  filename: string;
  originalContent: string;
  qaHistory: QuestionAnswer[];
  createdAt: Date;
  modifiedAt: Date;
  refinementStartedAt: Date;
}

export interface Duration {
  start: string;
  end: string;
}

export interface ArchivedExperience {
  title: string;
  date: string;
  duration: Duration;
  content: string;

  learnings?: string;
  reflections?: string;
  achievements?: string[];
  project?: string;
  technologies?: string[];
  tags?: string[];

  filepath: string;
  filename: string;
  createdAt: Date;
  archivedAt: Date;
}
