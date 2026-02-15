import { describe, it, expect } from 'vitest';
import {
  isCompletionSignal,
  getNextQuestion,
  questionTemplates,
} from '../../../src/templates/ai-prompts.js';

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
