import { describe, it, expect } from 'vitest';
import {
  validateFilename,
  normalizeFilename,
  isValidISODate,
  parseKoreanDate,
  parseDateFlexible,
  parseDurationFromText,
  parseList,
  generateTags,
} from '../../../src/cli/utils/validation.js';

describe('validateFilename', () => {
  it('should accept valid filename pattern', () => {
    expect(validateFilename('2024-01-15-my-draft.md')).toBe(true);
  });

  it('should reject filename without date prefix', () => {
    expect(validateFilename('my-draft.md')).toBe(false);
  });

  it('should reject filename without .md extension', () => {
    expect(validateFilename('2024-01-15-my-draft.txt')).toBe(false);
  });

  it('should reject filename with only date', () => {
    expect(validateFilename('2024-01-15.md')).toBe(false);
  });
});

describe('normalizeFilename', () => {
  it('should remove @ prefix', () => {
    expect(normalizeFilename('@myfile.md')).toBe('myfile.md');
  });

  it('should append .md if missing', () => {
    expect(normalizeFilename('myfile')).toBe('myfile.md');
  });

  it('should handle both @ and missing .md', () => {
    expect(normalizeFilename('@myfile')).toBe('myfile.md');
  });

  it('should trim whitespace', () => {
    expect(normalizeFilename('  file.md  ')).toBe('file.md');
  });
});

describe('isValidISODate', () => {
  it('should accept valid ISO date', () => {
    expect(isValidISODate('2024-01-15')).toBe(true);
  });

  it('should reject invalid date string', () => {
    expect(isValidISODate('not-a-date')).toBe(false);
  });

  it('should reject partial date', () => {
    expect(isValidISODate('2024-01')).toBe(false);
  });

  it('should reject invalid month', () => {
    expect(isValidISODate('2024-13-01')).toBe(false);
  });
});

describe('parseKoreanDate', () => {
  it('should parse Korean date format', () => {
    expect(parseKoreanDate('2024년 2월 1일')).toBe('2024-02-01');
  });

  it('should pad single-digit month and day', () => {
    expect(parseKoreanDate('2024년 3월 5일')).toBe('2024-03-05');
  });

  it('should return null for non-Korean text', () => {
    expect(parseKoreanDate('January 15, 2024')).toBeNull();
  });
});

describe('parseDateFlexible', () => {
  it('should parse ISO dates', () => {
    expect(parseDateFlexible('2024-01-15')).toBe('2024-01-15');
  });

  it('should parse Korean dates', () => {
    expect(parseDateFlexible('2024년 6월 15일')).toBe('2024-06-15');
  });

  it('should parse English month format', () => {
    expect(parseDateFlexible('January 15, 2024')).toBe('2024-01-15');
  });

  it('should return null for unparseable text', () => {
    expect(parseDateFlexible('not a date')).toBeNull();
  });
});

describe('parseDurationFromText', () => {
  it('should parse two Korean dates', () => {
    const result = parseDurationFromText('2024년 1월 1일부터 2024년 6월 30일까지');
    expect(result).toEqual({ start: '2024-01-01', end: '2024-06-30' });
  });

  it('should parse two ISO dates', () => {
    const result = parseDurationFromText('2024-01-01 to 2024-06-30');
    expect(result).toEqual({ start: '2024-01-01', end: '2024-06-30' });
  });

  it('should parse dates separated by ~', () => {
    const result = parseDurationFromText('2024-01-01 ~ 2024-06-30');
    expect(result).toEqual({ start: '2024-01-01', end: '2024-06-30' });
  });

  it('should return null for text without dates', () => {
    expect(parseDurationFromText('no dates here')).toBeNull();
  });
});

describe('parseList', () => {
  it('should parse bullet points with -', () => {
    const text = '- React\n- Node.js\n- Docker';
    expect(parseList(text)).toEqual(['React', 'Node.js', 'Docker']);
  });

  it('should parse bullet points with *', () => {
    const text = '* React\n* Node.js';
    expect(parseList(text)).toEqual(['React', 'Node.js']);
  });

  it('should fall back to comma-separated', () => {
    const text = 'React, Node.js, Docker';
    expect(parseList(text)).toEqual(['React', 'Node.js', 'Docker']);
  });

  it('should handle Chinese comma', () => {
    const text = 'React，Node.js，Docker';
    expect(parseList(text)).toEqual(['React', 'Node.js', 'Docker']);
  });
});

describe('generateTags', () => {
  it('should map React to frontend', () => {
    expect(generateTags(['React'])).toContain('frontend');
  });

  it('should map Redis to database and caching', () => {
    const tags = generateTags(['Redis']);
    expect(tags).toContain('database');
    expect(tags).toContain('caching');
  });

  it('should return empty for unknown tech', () => {
    expect(generateTags(['SomeObscureTech'])).toEqual([]);
  });

  it('should deduplicate tags', () => {
    const tags = generateTags(['React', 'Vue', 'Angular']);
    const frontendCount = tags.filter((t) => t === 'frontend').length;
    expect(frontendCount).toBe(1);
  });
});
