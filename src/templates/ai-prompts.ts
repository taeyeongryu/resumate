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

import type { DraftAnalysis, PromptOutput } from '../models/experience.js';
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
