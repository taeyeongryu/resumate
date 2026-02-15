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
