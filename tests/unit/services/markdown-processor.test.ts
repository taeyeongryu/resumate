import { describe, it, expect } from 'vitest';
import {
  parseMarkdown,
  stringifyMarkdown,
  extractTitle,
  extractQASection,
  parseQAPairs,
} from '../../../src/services/markdown-processor.js';

describe('parseMarkdown', () => {
  it('should extract frontmatter and content', () => {
    const raw = `---
title: Hello
date: 2024-01-01
---
# Hello World

Some content here.`;
    const result = parseMarkdown(raw);
    expect(result.data.title).toBe('Hello');
    expect(result.data.date).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    expect(result.content).toContain('# Hello World');
  });

  it('should handle markdown without frontmatter', () => {
    const raw = '# Just a heading\n\nSome content.';
    const result = parseMarkdown(raw);
    expect(result.data).toEqual({});
    expect(result.content).toContain('# Just a heading');
  });
});

describe('stringifyMarkdown', () => {
  it('should generate valid frontmatter markdown', () => {
    const content = '# My Document\n\nContent here.';
    const frontmatter = { title: 'My Document', date: '2024-01-01' };
    const result = stringifyMarkdown(content, frontmatter);
    expect(result).toContain('---');
    expect(result).toContain('title: My Document');
    expect(result).toContain('date: \'2024-01-01\'');
    expect(result).toContain('# My Document');
  });
});

describe('extractTitle', () => {
  it('should extract title from H1 header', () => {
    const content = '# My Great Title\n\nSome content.';
    expect(extractTitle(content)).toBe('My Great Title');
  });

  it('should fall back to first line when no H1', () => {
    const content = 'Just some text\nMore text';
    expect(extractTitle(content)).toBe('Just some text');
  });

  it('should truncate long first lines to 50 chars', () => {
    const longLine = 'A'.repeat(80);
    expect(extractTitle(longLine)).toBe('A'.repeat(50));
  });

  it('should skip non-H1 headers', () => {
    const content = '## Not H1\n# Actual Title';
    expect(extractTitle(content)).toBe('Actual Title');
  });
});

describe('extractQASection', () => {
  it('should extract Q&A section after separator', () => {
    const content = `# My Draft

Some content here.

---

## AI Refinement Questions

### Q: What was the timeframe?
**A**: 2024-01 to 2024-06`;
    const result = extractQASection(content);
    expect(result).not.toBeNull();
    expect(result!.originalContent).toBe('# My Draft\n\nSome content here.');
    expect(result!.qaSection).toContain('## AI Refinement Questions');
    expect(result!.qaSection).toContain('### Q: What was the timeframe?');
  });

  it('should return null without separator', () => {
    const content = '# My Draft\n\nNo Q&A here.';
    expect(extractQASection(content)).toBeNull();
  });

  it('should return null when separator exists but no Q&A header', () => {
    const content = '# My Draft\n\n---\n\nJust some other content.';
    expect(extractQASection(content)).toBeNull();
  });
});

describe('parseQAPairs', () => {
  it('should parse multiple Q&A pairs', () => {
    const qaSection = `## AI Refinement Questions

### Q: What was the timeframe?
**A**: January 2024 to June 2024

### Q: What were the achievements?
**A**: Increased performance by 30%`;
    const pairs = parseQAPairs(qaSection);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].question).toBe('What was the timeframe?');
    expect(pairs[0].answer).toBe('January 2024 to June 2024');
    expect(pairs[1].question).toBe('What were the achievements?');
    expect(pairs[1].answer).toBe('Increased performance by 30%');
  });

  it('should recognize unanswered questions', () => {
    const qaSection = `## AI Refinement Questions

### Q: What was the timeframe?
**A**: _[Please provide your answer]_`;
    const pairs = parseQAPairs(qaSection);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].question).toBe('What was the timeframe?');
    expect(pairs[0].answer).toBeUndefined();
  });

  it('should handle placeholder answers as unanswered', () => {
    const qaSection = `## AI Refinement Questions

### Q: Some question?
**A**: _[Please provide your answer]_

### Q: Another question?
**A**: Real answer here`;
    const pairs = parseQAPairs(qaSection);
    expect(pairs[0].answer).toBeUndefined();
    expect(pairs[1].answer).toBe('Real answer here');
  });
});
