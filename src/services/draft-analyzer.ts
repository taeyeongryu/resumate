import {
  type DraftAnalysis,
  type FieldDetection,
  ExperienceType,
  Language,
} from '../models/experience.js';

export const CORE_FIELDS = ['duration', 'achievements', 'learnings', 'project', 'technologies', 'reflections'];

const CONFIDENCE_THRESHOLD = 0.5;

// Korean Unicode ranges: Hangul Syllables (AC00-D7AF) and Jamo (1100-11FF, 3130-318F)
function isKoreanChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0xAC00 && code <= 0xD7AF) ||
    (code >= 0x1100 && code <= 0x11FF) ||
    (code >= 0x3130 && code <= 0x318F)
  );
}

function isLatinChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A);
}

export function detectLanguage(text: string): Language {
  let koreanCount = 0;
  let latinCount = 0;

  for (const char of text) {
    if (isKoreanChar(char)) koreanCount++;
    else if (isLatinChar(char)) latinCount++;
  }

  const total = koreanCount + latinCount;
  if (total === 0) return Language.ENGLISH;

  const koreanRatio = koreanCount / total;
  if (koreanRatio > 0.5) return Language.KOREAN;
  if (koreanRatio < 0.2) return Language.ENGLISH;
  return Language.MIXED;
}

// Field detection keyword sets
const DURATION_PATTERNS = [
  /\d{4}년\s*\d{1,2}월/,           // 2024년 2월
  /\d{4}\s*[-~]\s*\d{4}/,          // 2024-2025
  /\d{1,2}월\s*부터/,               // 2월부터
  /부터\s*.*까지/,                   // 부터...까지
  /from\s+\w+\s+\d{4}/i,           // From February 2024
  /\d{4}-\d{2}(-\d{2})?/,          // 2024-02 or 2024-02-01
  /january|february|march|april|may|june|july|august|september|october|november|december/i,
  /\d+\s*(months?|years?|weeks?)/i, // 6 months
  /\d+개월/,                         // 6개월
];

const ACHIEVEMENTS_PATTERNS = [
  /\d+\s*%/,                        // 50%
  /감소|증가|향상|개선|달성|절감/,
  /reduced?\s.*\d|improved?\s.*\d|increased?\s.*\d|achieved?\s.*\d|decreased?\s.*\d/i,
  /성과|결과|매출|수익|효율/,
  /\d+\s*(배|times|x)\s/i,         // 3배, 3 times
  /\d+\s*(만|억|천)/,               // 1만, 1억
];

const LEARNINGS_PATTERNS = [
  /배운|배웠|깨달|교훈|학습/,
  /learn|lesson|realiz|understand|insight/i,
  /중요성|필요성/,
  /통해\s*.*(알게|깨닫)/,
];

const PROJECT_PATTERNS = [
  /프로젝트|회사|기업|팀|부서/,
  /project|company|team|organization|department|corp|inc\b/i,
  /에서\s*(근무|일|개발|진행)/,
];

const TECHNOLOGIES_PATTERNS = [
  /react|vue|angular|node|python|java|typescript|javascript|go|rust|swift|kotlin/i,
  /docker|kubernetes|aws|gcp|azure|redis|mongodb|postgresql|mysql/i,
  /html|css|sass|webpack|vite|next|nuxt|express|fastapi|django|spring/i,
  /git|jenkins|ci\/cd|terraform|graphql|rest\s*api/i,
];

const REFLECTIONS_PATTERNS = [
  /느꼈|느낌|소감|의미있|보람|뿌듯|자부심/,
  /앞으로|향후|계획|다음에|도전/,
  /feel|felt|proud|meaningful|rewarding|plan\s+to|future|going\s+forward/i,
  /reflect|looking\s+back/i,
];

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  duration: DURATION_PATTERNS,
  achievements: ACHIEVEMENTS_PATTERNS,
  learnings: LEARNINGS_PATTERNS,
  project: PROJECT_PATTERNS,
  technologies: TECHNOLOGIES_PATTERNS,
  reflections: REFLECTIONS_PATTERNS,
};

// Frontmatter fields that map to core fields
const FRONTMATTER_FIELD_MAP: Record<string, string[]> = {
  duration: ['duration', 'date', 'start_date', 'end_date', 'period'],
  achievements: ['achievements', 'results', 'outcomes'],
  learnings: ['learnings', 'lessons'],
  project: ['project', 'company', 'organization', 'team'],
  technologies: ['technologies', 'tech', 'tools', 'stack'],
  reflections: ['reflections', 'notes', 'thoughts'],
};

function extractEvidence(content: string, pattern: RegExp): string {
  const match = content.match(pattern);
  if (!match) return '';
  const idx = match.index ?? 0;
  const start = Math.max(0, idx - 10);
  const end = Math.min(content.length, idx + match[0].length + 10);
  return content.substring(start, end).trim();
}

export function detectField(
  field: string,
  content: string,
  frontmatter: Record<string, unknown>,
): FieldDetection | null {
  // Check frontmatter first (high confidence)
  const fmKeys = FRONTMATTER_FIELD_MAP[field] ?? [];
  for (const key of fmKeys) {
    const value = frontmatter[key];
    if (value !== undefined && value !== null && value !== '') {
      const evidence = typeof value === 'string' ? value : JSON.stringify(value);
      return { field, confidence: 0.9, evidence: evidence.substring(0, 50) };
    }
  }

  // Check body content with patterns
  const patterns = FIELD_PATTERNS[field];
  if (!patterns) return null;

  let bestConfidence = 0;
  let bestEvidence = '';

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      const confidence = 0.7;
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestEvidence = extractEvidence(content, pattern);
      }
    }
  }

  if (bestConfidence >= CONFIDENCE_THRESHOLD) {
    return { field, confidence: bestConfidence, evidence: bestEvidence };
  }

  return null;
}

const EXPERIENCE_TYPE_KEYWORDS: Record<string, RegExp[]> = {
  [ExperienceType.TECHNICAL_PROJECT]: [
    /architect|deploy|api|microservice|database|backend|frontend|fullstack|devops|ci\/cd/i,
    /아키텍처|배포|마이크로서비스|데이터베이스|파이프라인/,
    /implement|develop|build|code|debug|refactor|optimize/i,
    /구현|개발|빌드|코딩|리팩토링|최적화/,
    /docker|kubernetes|aws|gcp|terraform/i,
  ],
  [ExperienceType.LEADERSHIP]: [
    /manag|lead|mentor|hire|stakeholder|okr|kpi|budget/i,
    /관리|이끌|멘토|채용|이해관계자|목표/,
    /team\s*(of|size|member)|direct\s*report|department|division/i,
    /팀.*이끌|부서|조직|리더/,
  ],
  [ExperienceType.LEARNING]: [
    /course|certificate|certif|bootcamp|tutorial|workshop|study|training/i,
    /강좌|자격증|수강|부트캠프|튜토리얼|워크숍|학습|교육/,
    /learn|complet.*course|earn.*certif/i,
  ],
  [ExperienceType.JOB]: [
    /join.*company|position|role\s*as|responsibilit|department|senior|junior|intern/i,
    /입사|직무|역할|담당|부서|시니어|주니어|인턴/,
  ],
};

const EXPERIENCE_TYPE_THRESHOLD = 2;

export function detectExperienceType(content: string): ExperienceType {
  const scores: Record<string, number> = {};

  for (const [type, patterns] of Object.entries(EXPERIENCE_TYPE_KEYWORDS)) {
    let score = 0;
    for (const pattern of patterns) {
      const matches = content.match(new RegExp(pattern.source, pattern.flags + 'g'));
      if (matches) {
        score += matches.length;
      }
    }
    scores[type] = score;
  }

  let bestType = ExperienceType.GENERAL;
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore && score >= EXPERIENCE_TYPE_THRESHOLD) {
      bestScore = score;
      bestType = type as ExperienceType;
    }
  }

  return bestType;
}

export function analyzeDraft(
  content: string,
  frontmatter: Record<string, unknown>,
): DraftAnalysis {
  const presentFields: FieldDetection[] = [];
  const missingFields: string[] = [];

  for (const field of CORE_FIELDS) {
    const detection = detectField(field, content, frontmatter);
    if (detection && detection.confidence >= CONFIDENCE_THRESHOLD) {
      presentFields.push(detection);
    } else {
      missingFields.push(field);
    }
  }

  const language = detectLanguage(content);
  const experienceType = detectExperienceType(content);
  const isSufficient = missingFields.length === 0;

  return {
    presentFields,
    missingFields,
    experienceType,
    language,
    draftContent: content,
    frontmatter,
    isSufficient,
  };
}
