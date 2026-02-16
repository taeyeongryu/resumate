export interface QuestionTemplate {
  field: string;
  korean: string;
  english: string;
  required: boolean;
}

export const questionTemplates: QuestionTemplate[] = [
  {
    field: 'duration',
    korean: '이 작업의 구체적인 기간이 어떻게 되나요? (시작일과 종료일)',
    english: 'What was the specific timeframe for this work? (start and end dates)',
    required: true,
  },
  {
    field: 'achievements',
    korean: '어떤 성과가 있었나요? 정량적인 지표가 있다면 알려주세요',
    english:
      'What were the achievements? Please include quantitative metrics if available',
    required: false,
  },
  {
    field: 'learnings',
    korean: '이 경험에서 가장 중요하게 배운 점은 무엇인가요?',
    english: 'What were the most important learnings from this experience?',
    required: false,
  },
  {
    field: 'project',
    korean: '관련된 프로젝트나 회사가 있나요?',
    english: 'Is there a related project or company?',
    required: false,
  },
  {
    field: 'technologies',
    korean: '어떤 기술이나 도구를 사용했나요?',
    english: 'What technologies or tools did you use?',
    required: false,
  },
  {
    field: 'reflections',
    korean: '이 경험에 대해 어떻게 느끼셨나요? 개인적인 소감이나 향후 계획이 있다면?',
    english:
      'How did you feel about this experience? Any personal reflections or future plans?',
    required: false,
  },
];

export const COMPLETION_SIGNALS = [
  '충분해',
  '완료',
  '끝',
  'sufficient',
  'done',
  'enough',
  'finished',
];

export function isCompletionSignal(input: string): boolean {
  const lower = input.trim().toLowerCase();
  return COMPLETION_SIGNALS.some((signal) => lower.includes(signal.toLowerCase()));
}

export function getNextQuestion(
  answeredFields: string[],
): QuestionTemplate | null {
  for (const template of questionTemplates) {
    if (!answeredFields.includes(template.field)) {
      return template;
    }
  }
  return null;
}

import type { DraftAnalysis, PromptOutput, ArchiveAnalysis, ArchivePromptOutput } from '../models/experience.js';
import { ExperienceType } from '../models/experience.js';

const TYPE_GUIDANCE: Record<string, string> = {
  [ExperienceType.TECHNICAL_PROJECT]: `
## Experience Type: Technical Project
Focus questions on:
- Architecture decisions and technical challenges
- Performance metrics and measurable outcomes
- Technical stack choices and trade-offs
- Scalability considerations`,
  [ExperienceType.LEADERSHIP]: `
## Experience Type: Leadership/Management
Focus questions on:
- Team size, structure, and management approach
- Business outcomes and organizational impact
- People management and mentoring experiences
- Stakeholder communication and decision-making`,
  [ExperienceType.LEARNING]: `
## Experience Type: Learning/Education
Focus questions on:
- What was learned and key skill development
- Practical application of new knowledge
- How the learning changed their approach or methodology
- Certification or completion details`,
  [ExperienceType.JOB]: `
## Experience Type: Job/Position
Focus questions on:
- Scope of role and key responsibilities
- Career progression and growth within the role
- Impact on the team or organization
- Key projects or initiatives led`,
};

export function generateQuestionPrompt(analysis: DraftAnalysis): string {
  const presentList = analysis.presentFields
    .map((f) => `- ${f.field}: "${f.evidence}"`)
    .join('\n');
  const missingList = analysis.missingFields.join(', ');
  const maxQuestions = Math.min(analysis.missingFields.length, 6);

  const languageInstruction =
    analysis.language === 'korean'
      ? 'Generate all questions in Korean.'
      : analysis.language === 'english'
        ? 'Generate all questions in English.'
        : 'Generate questions in both Korean and English.';

  const typeGuidance = TYPE_GUIDANCE[analysis.experienceType] ?? '';

  return `Analyze the following experience draft and generate ${maxQuestions} clarifying questions about the missing information.

## Draft Content
${analysis.draftContent}

## Already Present Information (DO NOT ask about these)
${presentList || '(none detected)'}

## Missing Information (generate questions for these)
${missingList}
${typeGuidance}

## Instructions
- ${languageInstruction}
- Only ask about information that is NOT already present in the draft.
- Make questions specific to the draft content, not generic.
- Each question should help the user provide concrete, detailed information.
- Output your response as a JSON array with exactly this format:
  [{"field": "<field_id>", "question": "<question_text>", "reason": "<why_this_is_needed>"}]
- Valid field identifiers: ${analysis.missingFields.join(', ')}
- Maximum ${maxQuestions} questions.`;
}

export function buildPromptOutput(
  analysis: DraftAnalysis,
  experienceDir: string,
): PromptOutput {
  if (analysis.isSufficient) {
    return {
      status: 'sufficient',
      analysis,
      prompt: '',
      metadata: {
        experienceDir,
        maxQuestions: 0,
        outputFormat: 'json',
        fieldIdentifiers: [],
      },
    };
  }

  const maxQuestions = Math.min(analysis.missingFields.length, 6);
  const prompt = generateQuestionPrompt(analysis);

  return {
    status: 'needs-questions',
    analysis,
    prompt,
    metadata: {
      experienceDir,
      maxQuestions,
      outputFormat: 'json',
      fieldIdentifiers: analysis.missingFields.slice(0, 6),
    },
  };
}

// --- Archive Structuring Prompt ---

export function generateArchivePrompt(analysis: ArchiveAnalysis): string {
  const qaPairsText = analysis.qaPairs.length > 0
    ? analysis.qaPairs.map((qa, i) =>
        `### Q${i + 1}: ${qa.question}\n**A**: ${qa.answer ?? '(no answer)'}`
      ).join('\n\n')
    : '(No Q&A section found)';

  const languageInstruction =
    analysis.language === 'korean'
      ? 'Generate all interpretations, suggestions, and comments in Korean.'
      : analysis.language === 'english'
        ? 'Generate all interpretations, suggestions, and comments in English.'
        : 'Generate interpretations in both Korean and English as appropriate.';

  return `You are structuring a career experience for resume writing. Analyze the following refined experience content and produce a structured JSON output.

## Original Content
${analysis.originalContent}

## Q&A Section
${qaPairsText}

## Experience Metadata
- Title: ${analysis.title}
- Date: ${analysis.dateStr}
- Detected Type: ${analysis.experienceType}

## Instructions

${languageInstruction}

### Technology Normalization
- Normalize all technology names to their canonical English forms
- Common mappings: "ts" → "TypeScript", "js" → "JavaScript", "레디스" → "Redis", "리액트" → "React", "노드" → "Node.js", "파이썬" → "Python", "도커" → "Docker", "쿠버네티스" → "Kubernetes", "몽고" → "MongoDB", "포스트그레스" → "PostgreSQL"
- Preserve the original user input alongside the normalized name

### Achievement Formatting
- For each achievement, create a resume-ready version that:
  - Quantifies vague claims (e.g., "반으로 줄임" → "50% 개선")
  - Uses action verbs and measurable outcomes
  - Preserves the original text verbatim alongside the resume-ready version

### Duration Interpretation
- Interpret natural language dates (e.g., "3월 말부터 상반기까지" → start: "2024-03-31", end: "2024-06-30", interpretation: "2024년 3월 말 ~ 6월 말 (약 3개월)")
- If dates are ambiguous, provide your best interpretation and note the ambiguity
- Preserve the original text in the "original" field

### Q&A Summary
- For each Q&A pair, add an "interpretation" field that enriches or clarifies the answer
- Note any ambiguities or missing context

### Completeness Assessment
- Score from 0-100 based on these weighted fields:
  - title (10), duration (20), achievements (25), technologies (15), learnings (15), project (10), reflections (5)
  - Quality bonuses: specific dates (+5), quantitative achievements (+5), >3 technologies (+3), detailed learnings (+3)
- Provide actionable suggestions for improvement, framed as resume-writing advice

### AI Comments
- Add any observations about the experience that could help with resume writing
- Note patterns, strengths, or areas that stand out

## Output Format

Return ONLY a valid JSON object with this exact structure (no markdown code fences, no extra text):

{
  "title": "string",
  "duration": {
    "original": "string (verbatim user answer)",
    "start": "string (ISO date or descriptive) or null",
    "end": "string (ISO date or descriptive) or null",
    "interpretation": "string (AI explanation)"
  },
  "project": "string or null",
  "technologies": [{"original": "string", "normalized": "string"}],
  "achievements": [{"original": "string", "resumeReady": "string"}],
  "learnings": "string or null",
  "reflections": "string or null",
  "qaSummary": [{"question": "string", "answer": "string", "interpretation": "string"}],
  "completeness": {
    "score": 0-100,
    "breakdown": {
      "title": {"present": true, "weight": 10, "qualityScore": 0-1},
      "duration": {"present": true, "weight": 20, "qualityScore": 0-1},
      "achievements": {"present": true, "weight": 25, "qualityScore": 0-1},
      "technologies": {"present": true, "weight": 15, "qualityScore": 0-1},
      "learnings": {"present": true, "weight": 15, "qualityScore": 0-1},
      "project": {"present": true, "weight": 10, "qualityScore": 0-1},
      "reflections": {"present": true, "weight": 5, "qualityScore": 0-1}
    },
    "suggestions": ["string"]
  },
  "aiComments": "string"
}`;
}

export function buildArchivePromptOutput(
  analysis: ArchiveAnalysis,
  experienceName: string,
): ArchivePromptOutput {
  const prompt = generateArchivePrompt(analysis);

  return {
    status: 'ready',
    analysis,
    prompt,
    metadata: {
      experienceDir: experienceName,
      experienceName,
      outputFormat: 'json',
    },
  };
}
