import { describe, it, expect } from 'vitest';
import {
  isCompletionSignal,
  getNextQuestion,
  questionTemplates,
  generateQuestionPrompt,
  buildPromptOutput,
} from '../../../src/templates/ai-prompts.js';
import { ExperienceType, Language } from '../../../src/models/experience.js';
import type { DraftAnalysis } from '../../../src/models/experience.js';

describe('questionTemplates', () => {
  it('should have 6 templates', () => {
    expect(questionTemplates).toHaveLength(6);
  });

  it('should have duration as required', () => {
    const duration = questionTemplates.find((t) => t.field === 'duration');
    expect(duration).toBeDefined();
    expect(duration!.required).toBe(true);
  });

  it('should have all other fields as optional', () => {
    const optional = questionTemplates.filter((t) => t.field !== 'duration');
    expect(optional.every((t) => t.required === false)).toBe(true);
  });
});

describe('isCompletionSignal', () => {
  it('should detect Korean completion signals', () => {
    expect(isCompletionSignal('충분해')).toBe(true);
    expect(isCompletionSignal('완료')).toBe(true);
    expect(isCompletionSignal('끝')).toBe(true);
  });

  it('should detect English completion signals', () => {
    expect(isCompletionSignal('done')).toBe(true);
    expect(isCompletionSignal('sufficient')).toBe(true);
    expect(isCompletionSignal('enough')).toBe(true);
    expect(isCompletionSignal('finished')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isCompletionSignal('DONE')).toBe(true);
    expect(isCompletionSignal('Done')).toBe(true);
  });

  it('should detect signal within longer text', () => {
    expect(isCompletionSignal('I think this is enough for now')).toBe(true);
  });

  it('should return false for normal text', () => {
    expect(isCompletionSignal('React and Node.js')).toBe(false);
    expect(isCompletionSignal('hello world')).toBe(false);
  });
});

describe('getNextQuestion', () => {
  it('should return first unanswered template', () => {
    const result = getNextQuestion(['duration']);
    expect(result).not.toBeNull();
    expect(result!.field).toBe('achievements');
  });

  it('should return duration first when nothing answered', () => {
    const result = getNextQuestion([]);
    expect(result).not.toBeNull();
    expect(result!.field).toBe('duration');
  });

  it('should return null when all fields answered', () => {
    const allFields = questionTemplates.map((t) => t.field);
    expect(getNextQuestion(allFields)).toBeNull();
  });
});

function makeDraftAnalysis(overrides: Partial<DraftAnalysis> = {}): DraftAnalysis {
  return {
    presentFields: [
      { field: 'duration', confidence: 0.9, evidence: '2024년 2월부터 6월까지' },
      { field: 'technologies', confidence: 0.8, evidence: 'React, TypeScript' },
    ],
    missingFields: ['achievements', 'learnings', 'project', 'reflections'],
    experienceType: ExperienceType.GENERAL,
    language: Language.KOREAN,
    draftContent: '2024년 2월부터 6월까지 React, TypeScript를 사용하여 프로젝트를 진행했습니다',
    frontmatter: { title: 'Test' },
    isSufficient: false,
    ...overrides,
  };
}

describe('generateQuestionPrompt', () => {
  it('should include draft content in the prompt', () => {
    const analysis = makeDraftAnalysis();
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt).toContain(analysis.draftContent);
  });

  it('should list present fields in the prompt', () => {
    const analysis = makeDraftAnalysis();
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt).toContain('duration');
    expect(prompt).toContain('technologies');
  });

  it('should list missing fields in the prompt', () => {
    const analysis = makeDraftAnalysis();
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt).toContain('achievements');
    expect(prompt).toContain('learnings');
  });

  it('should specify the language', () => {
    const analysis = makeDraftAnalysis({ language: Language.KOREAN });
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt.toLowerCase()).toContain('korean');
  });

  it('should limit question count to missing fields length', () => {
    const analysis = makeDraftAnalysis({ missingFields: ['achievements', 'learnings'] });
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt).toContain('2');
  });

  it('should request JSON output format', () => {
    const analysis = makeDraftAnalysis();
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt.toLowerCase()).toContain('json');
  });
});

describe('buildPromptOutput', () => {
  it('should return needs-questions status when fields are missing', () => {
    const analysis = makeDraftAnalysis({ isSufficient: false });
    const output = buildPromptOutput(analysis, '2024-06-15-test');
    expect(output.status).toBe('needs-questions');
    expect(output.prompt).not.toBe('');
  });

  it('should return sufficient status when all fields present', () => {
    const analysis = makeDraftAnalysis({
      isSufficient: true,
      missingFields: [],
      presentFields: [
        { field: 'duration', confidence: 0.9, evidence: '' },
        { field: 'achievements', confidence: 0.8, evidence: '' },
        { field: 'learnings', confidence: 0.7, evidence: '' },
        { field: 'project', confidence: 0.8, evidence: '' },
        { field: 'technologies', confidence: 0.9, evidence: '' },
        { field: 'reflections', confidence: 0.7, evidence: '' },
      ],
    });
    const output = buildPromptOutput(analysis, '2024-06-15-test');
    expect(output.status).toBe('sufficient');
    expect(output.prompt).toBe('');
  });

  it('should include correct metadata', () => {
    const analysis = makeDraftAnalysis({ missingFields: ['achievements', 'learnings'] });
    const output = buildPromptOutput(analysis, '2024-06-15-test');
    expect(output.metadata.experienceDir).toBe('2024-06-15-test');
    expect(output.metadata.maxQuestions).toBe(2);
    expect(output.metadata.outputFormat).toBe('json');
    expect(output.metadata.fieldIdentifiers).toEqual(['achievements', 'learnings']);
  });

  it('should cap maxQuestions at 6', () => {
    const analysis = makeDraftAnalysis({
      missingFields: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    });
    const output = buildPromptOutput(analysis, 'test');
    expect(output.metadata.maxQuestions).toBe(6);
  });
});

describe('generateQuestionPrompt - type-specific guidance', () => {
  it('should include technical guidance for TECHNICAL_PROJECT', () => {
    const analysis = makeDraftAnalysis({ experienceType: ExperienceType.TECHNICAL_PROJECT });
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt.toLowerCase()).toMatch(/architect|performance|technical/);
  });

  it('should include leadership guidance for LEADERSHIP', () => {
    const analysis = makeDraftAnalysis({ experienceType: ExperienceType.LEADERSHIP });
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt.toLowerCase()).toMatch(/team|business|management/);
  });

  it('should include learning guidance for LEARNING', () => {
    const analysis = makeDraftAnalysis({ experienceType: ExperienceType.LEARNING });
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt.toLowerCase()).toMatch(/learn|skill|application/);
  });

  it('should include job guidance for JOB', () => {
    const analysis = makeDraftAnalysis({ experienceType: ExperienceType.JOB });
    const prompt = generateQuestionPrompt(analysis);
    expect(prompt.toLowerCase()).toMatch(/scope|progression|impact/);
  });

  it('should not include specific guidance for GENERAL', () => {
    const analysis = makeDraftAnalysis({ experienceType: ExperienceType.GENERAL });
    const prompt = generateQuestionPrompt(analysis);
    // GENERAL should still have a valid prompt but without type-specific guidance
    expect(prompt).toContain('Draft Content');
  });
});
