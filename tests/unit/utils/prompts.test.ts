import { describe, it, expect } from 'vitest';
import {
  getAnsweredFields,
  getNextUnansweredQuestion,
  formatQASection,
  buildInitialQASection,
} from '../../../src/cli/utils/prompts.js';
import { questionTemplates } from '../../../src/templates/ai-prompts.js';
import type { QAPair } from '../../../src/services/markdown-processor.js';

describe('getAnsweredFields', () => {
  it('should return field names for answered Q&A pairs', () => {
    const pairs: QAPair[] = [
      { question: questionTemplates[0].korean, answer: '2024-01-01 to 2024-06-30' },
      { question: questionTemplates[1].korean, answer: undefined },
    ];
    const fields = getAnsweredFields(pairs);
    expect(fields).toContain('duration');
    expect(fields).not.toContain('achievements');
  });

  it('should return empty array when nothing is answered', () => {
    const pairs: QAPair[] = [
      { question: questionTemplates[0].korean, answer: undefined },
    ];
    expect(getAnsweredFields(pairs)).toEqual([]);
  });
});

describe('getNextUnansweredQuestion', () => {
  it('should return the first unanswered question', () => {
    const pairs: QAPair[] = [
      { question: questionTemplates[0].korean, answer: 'some answer' },
    ];
    const next = getNextUnansweredQuestion(pairs);
    expect(next).not.toBeNull();
    expect(next!.field).toBe('achievements');
  });

  it('should return null when all questions are answered', () => {
    const pairs: QAPair[] = questionTemplates.map((t) => ({
      question: t.korean,
      answer: 'some answer',
    }));
    const next = getNextUnansweredQuestion(pairs);
    expect(next).toBeNull();
  });
});

describe('formatQASection', () => {
  it('should format Q&A pairs into markdown', () => {
    const pairs: QAPair[] = [
      { question: 'What timeframe?', answer: 'Jan to Jun 2024' },
    ];
    const result = formatQASection(pairs);
    expect(result).toContain('## AI Refinement Questions');
    expect(result).toContain('### Q: What timeframe?');
    expect(result).toContain('**A**: Jan to Jun 2024');
  });

  it('should show placeholder for unanswered questions', () => {
    const pairs: QAPair[] = [
      { question: 'What timeframe?', answer: undefined },
    ];
    const result = formatQASection(pairs);
    expect(result).toContain('**A**: _[Please provide your answer]_');
  });

  it('should append next question when provided', () => {
    const pairs: QAPair[] = [];
    const result = formatQASection(pairs, questionTemplates[0]);
    expect(result).toContain(`### Q: ${questionTemplates[0].korean}`);
  });
});

describe('buildInitialQASection', () => {
  it('should generate first question section with separator', () => {
    const result = buildInitialQASection(questionTemplates[0]);
    expect(result).toContain('\n---\n');
    expect(result).toContain('## AI Refinement Questions');
    expect(result).toContain(`### Q: ${questionTemplates[0].korean}`);
    expect(result).toContain('**A**: _[Please provide your answer]_');
  });
});
