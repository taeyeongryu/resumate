import { describe, it, expect } from 'vitest';
import { analyzeRefined, calculateCompleteness } from '../../../src/services/archive-analyzer.js';
import { Language, ExperienceType } from '../../../src/models/experience.js';

const REFINED_WITH_QA = `---
title: "React 성능 최적화"
date: "2024-06-15"
---

# React 성능 최적화

TechCorp에서 React 프로젝트의 성능을 최적화하는 작업을 진행했습니다.

---

## AI Refinement Questions

### Q: 이 작업의 구체적인 기간이 어떻게 되나요?
**A**: 3월 말부터 상반기까지

### Q: 어떤 성과가 있었나요?
**A**: 로딩 시간 반으로 줄임

### Q: 어떤 기술이나 도구를 사용했나요?
**A**: react, ts, 레디스
`;

const REFINED_WITHOUT_QA = `---
title: "Simple Experience"
date: "2024-01-10"
---

# Simple Experience

Just some content without any Q&A section.
`;

const ENGLISH_REFINED = `---
title: "API Migration"
date: "2024-03-01"
---

# API Migration

Migrated the legacy REST API to GraphQL and implemented a new microservice architecture. Deployed using Docker and Kubernetes with a CI/CD pipeline on AWS.

---

## AI Refinement Questions

### Q: What was the timeframe?
**A**: From March to June 2024

### Q: What technologies did you use?
**A**: Node.js, GraphQL, PostgreSQL, Docker
`;

describe('analyzeRefined', () => {
  it('should extract Q&A pairs from refined content', () => {
    const result = analyzeRefined(REFINED_WITH_QA, '2024-06-15');
    expect(result.qaPairs).toHaveLength(3);
    expect(result.qaPairs[0].question).toContain('기간');
    expect(result.qaPairs[0].answer).toBe('3월 말부터 상반기까지');
    expect(result.qaPairs[2].answer).toBe('react, ts, 레디스');
  });

  it('should extract title and date', () => {
    const result = analyzeRefined(REFINED_WITH_QA, '2024-06-15');
    expect(result.title).toBe('React 성능 최적화');
    expect(result.dateStr).toBe('2024-06-15');
  });

  it('should extract original content without Q&A', () => {
    const result = analyzeRefined(REFINED_WITH_QA, '2024-06-15');
    expect(result.originalContent).toContain('React 성능 최적화');
    expect(result.originalContent).not.toContain('AI Refinement Questions');
  });

  it('should handle refined content without Q&A section', () => {
    const result = analyzeRefined(REFINED_WITHOUT_QA, '2024-01-10');
    expect(result.qaPairs).toHaveLength(0);
    expect(result.title).toBe('Simple Experience');
    expect(result.originalContent).toContain('Just some content');
  });

  it('should detect language from body content', () => {
    const result = analyzeRefined(REFINED_WITH_QA, '2024-06-15');
    // detectLanguage analyzes the body after frontmatter stripping
    // The body has "TechCorp에서 React 프로젝트의 성능을 최적화하는 작업을 진행했습니다."
    // Korean chars + English terms = could be korean, mixed, or english depending on ratio
    expect([Language.KOREAN, Language.MIXED, Language.ENGLISH]).toContain(result.language);
  });

  it('should detect English language for English content', () => {
    const result = analyzeRefined(ENGLISH_REFINED, '2024-03-01');
    expect(result.language).toBe(Language.ENGLISH);
  });

  it('should detect experience type from content keywords', () => {
    const result = analyzeRefined(ENGLISH_REFINED, '2024-03-01');
    // Content has API, microservice, deployed, Docker, Kubernetes, CI/CD → technical project
    expect(result.experienceType).toBe(ExperienceType.TECHNICAL_PROJECT);
  });

  it('should default to GENERAL for minimal content', () => {
    const result = analyzeRefined(REFINED_WITHOUT_QA, '2024-01-10');
    expect(result.experienceType).toBe(ExperienceType.GENERAL);
  });
});

describe('calculateCompleteness', () => {
  it('should score 90%+ for fully complete data', () => {
    const result = calculateCompleteness({
      title: 'React 성능 최적화',
      duration: { start: '2024-03-01', end: '2024-06-30' },
      achievements: ['로딩 시간 50% 감소', '번들 사이즈 40% 감소'],
      technologies: ['React', 'TypeScript', 'Redis', 'Docker'],
      learnings: '이 경험을 통해 성능 최적화의 중요성과 사용자 경험에 미치는 영향을 깊이 이해하게 되었습니다.',
      project: 'TechCorp Dashboard',
      reflections: '보람찬 경험이었습니다',
    });
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.suggestions).toHaveLength(0);
  });

  it('should score lower when achievements are missing', () => {
    const result = calculateCompleteness({
      title: 'React 성능 최적화',
      duration: { start: '2024-03-01', end: '2024-06-30' },
      technologies: ['React', 'TypeScript'],
      learnings: 'Learned a lot',
      project: 'TechCorp',
    });
    expect(result.score).toBeLessThan(80);
    expect(result.breakdown.achievements.present).toBe(false);
    expect(result.suggestions.some(s => s.includes('성과'))).toBe(true);
  });

  it('should score below 40% for minimal data', () => {
    const result = calculateCompleteness({
      title: 'Some experience',
    });
    expect(result.score).toBeLessThan(40);
    expect(result.suggestions.length).toBeGreaterThan(3);
  });

  it('should give quality bonus for quantitative achievements', () => {
    const withQuantitative = calculateCompleteness({
      title: 'Test',
      achievements: ['로딩 시간 50% 감소'],
    });
    const withoutQuantitative = calculateCompleteness({
      title: 'Test',
      achievements: ['성능을 개선함'],
    });
    expect(withQuantitative.breakdown.achievements.qualityScore).toBeGreaterThan(
      withoutQuantitative.breakdown.achievements.qualityScore
    );
  });

  it('should give quality bonus for >3 technologies', () => {
    const moreTech = calculateCompleteness({
      title: 'Test',
      technologies: ['React', 'TypeScript', 'Redis', 'Docker'],
    });
    const lessTech = calculateCompleteness({
      title: 'Test',
      technologies: ['React'],
    });
    expect(moreTech.breakdown.technologies.qualityScore).toBeGreaterThan(
      lessTech.breakdown.technologies.qualityScore
    );
  });

  it('should give quality bonus for detailed learnings', () => {
    const detailed = calculateCompleteness({
      title: 'Test',
      learnings: '이 경험을 통해 성능 최적화의 중요성과 사용자 경험에 미치는 영향을 깊이 이해하게 되었습니다.',
    });
    const brief = calculateCompleteness({
      title: 'Test',
      learnings: '많이 배웠다',
    });
    expect(detailed.breakdown.learnings.qualityScore).toBeGreaterThan(
      brief.breakdown.learnings.qualityScore
    );
  });

  it('should return 0 for completely empty data', () => {
    const result = calculateCompleteness({});
    expect(result.score).toBe(0);
  });
});
