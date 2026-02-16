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

export type VersionType = 'draft' | 'refined' | 'archived';

export interface ExperienceDirectory {
  path: string;
  name: string;
  date: Date;
  slug: string;
  versions: {
    draft: boolean;
    refined: boolean;
    archived: boolean;
  };
  timestamps: {
    draft?: Date;
    refined?: Date;
    archived?: Date;
  };
}

export interface ExperienceVersion {
  type: VersionType;
  filepath: string;
  experienceDir: string;
  metadata: {
    createdAt: Date;
    modifiedAt: Date;
    sizeBytes: number;
  };
  frontmatter: Record<string, unknown>;
  content: string;
}

export interface ExperienceContent {
  title: string;
  company: string;
  role: string;
  description?: string;
  date?: string;
}

export interface MigrationManifest {
  migrationId: string;
  startedAt: string;
  completedAt?: string;
  phase: 'scanning' | 'grouping' | 'validating' | 'converting' | 'verifying' | 'cleanup' | 'completed' | 'failed';
  progress: {
    filesScanned: number;
    filesTotal: number;
    experiencesCreated: number;
    experiencesTotal: number;
  };
  experiences: MigrationExperienceMapping[];
  errors: MigrationError[];
  config: {
    rootDir: string;
    backupDir: string;
    dryRun: boolean;
  };
}

export interface MigrationExperienceMapping {
  experienceDir: string;
  sourceFiles: {
    draft?: string;
    refined?: string;
    archived?: string;
  };
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error?: string;
  checksums?: {
    draft?: string;
    refined?: string;
    archived?: string;
  };
}

export interface MigrationError {
  phase: string;
  filepath?: string;
  message: string;
  timestamp: string;
}

export interface ExperienceQuery {
  query: string;
  type: 'exact-date' | 'partial-date' | 'slug-keyword' | 'text-match';
  components: {
    year?: number;
    month?: number;
    day?: number;
    keywords?: string[];
  };
}

export interface ExperienceSearchResult {
  experience: ExperienceDirectory;
  score: number;
  matchReason: string;
}

// --- Dynamic Question Generation Types ---

export enum ExperienceType {
  TECHNICAL_PROJECT = 'technical-project',
  LEADERSHIP = 'leadership',
  LEARNING = 'learning',
  JOB = 'job',
  GENERAL = 'general',
}

export enum Language {
  KOREAN = 'korean',
  ENGLISH = 'english',
  MIXED = 'mixed',
}

export interface FieldDetection {
  field: string;
  confidence: number;
  evidence: string;
}

export interface DraftAnalysis {
  presentFields: FieldDetection[];
  missingFields: string[];
  experienceType: ExperienceType;
  language: Language;
  draftContent: string;
  frontmatter: Record<string, unknown>;
  isSufficient: boolean;
}

export interface DynamicQuestion {
  field: string;
  question: string;
  reason: string;
}

export interface PromptMetadata {
  experienceDir: string;
  maxQuestions: number;
  outputFormat: string;
  fieldIdentifiers: string[];
}

export interface PromptOutput {
  status: 'needs-questions' | 'sufficient';
  analysis: DraftAnalysis;
  prompt: string;
  metadata: PromptMetadata;
}
