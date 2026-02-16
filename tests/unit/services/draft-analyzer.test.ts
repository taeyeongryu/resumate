import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  detectField,
  detectExperienceType,
  analyzeDraft,
} from '../../../src/services/draft-analyzer.js';
import { ExperienceType, Language } from '../../../src/models/experience.js';

describe('detectLanguage', () => {
  it('should detect Korean-heavy text as KOREAN', () => {
    const text = '2024년 2월부터 6월까지 React 성능 최적화 프로젝트를 진행했습니다';
    expect(detectLanguage(text)).toBe(Language.KOREAN);
  });

  it('should detect English-heavy text as ENGLISH', () => {
    const text = 'I worked on a React performance optimization project from February to June 2024';
    expect(detectLanguage(text)).toBe(Language.ENGLISH);
  });

  it('should detect mixed content as MIXED', () => {
    const text = 'React 성능 최적화 프로젝트 with significant improvements 진행';
    expect(detectLanguage(text)).toBe(Language.MIXED);
  });

  it('should handle empty text as ENGLISH', () => {
    expect(detectLanguage('')).toBe(Language.ENGLISH);
  });

  it('should handle text with only numbers and symbols', () => {
    const text = '2024-02-01 → 2024-06-30 (100%)';
    expect(detectLanguage(text)).toBe(Language.ENGLISH);
  });

  it('should detect purely Korean text', () => {
    const text = '프론트엔드 개발자로서 팀을 이끌며 프로젝트를 성공적으로 완료했습니다';
    expect(detectLanguage(text)).toBe(Language.KOREAN);
  });
});

describe('detectField', () => {
  describe('duration', () => {
    it('should detect date ranges in Korean', () => {
      const result = detectField('duration', '2024년 2월부터 6월까지 진행했습니다', {});
      expect(result).not.toBeNull();
      expect(result!.field).toBe('duration');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect date ranges in English', () => {
      const result = detectField('duration', 'From February 2024 to June 2024', {});
      expect(result).not.toBeNull();
      expect(result!.field).toBe('duration');
    });

    it('should detect duration from frontmatter', () => {
      const result = detectField('duration', '', { date: '2024-06-15', duration: { start: '2024-02', end: '2024-06' } });
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should return null when no duration info exists', () => {
      const result = detectField('duration', 'I worked on a great project', {});
      expect(result).toBeNull();
    });
  });

  describe('achievements', () => {
    it('should detect quantitative achievements', () => {
      const result = detectField('achievements', '로딩 시간을 50% 감소시켰습니다', {});
      expect(result).not.toBeNull();
      expect(result!.field).toBe('achievements');
    });

    it('should detect achievements with percentage or metrics', () => {
      const result = detectField('achievements', 'Reduced bundle size by 40%, improved load time by 2 seconds', {});
      expect(result).not.toBeNull();
    });

    it('should return null when no achievements mentioned', () => {
      const result = detectField('achievements', '프로젝트를 진행했습니다', {});
      expect(result).toBeNull();
    });
  });

  describe('learnings', () => {
    it('should detect learning keywords in Korean', () => {
      const result = detectField('learnings', '이 경험을 통해 배운 점은 코드 리뷰의 중요성입니다', {});
      expect(result).not.toBeNull();
      expect(result!.field).toBe('learnings');
    });

    it('should detect learning keywords in English', () => {
      const result = detectField('learnings', 'I learned the importance of code review through this experience', {});
      expect(result).not.toBeNull();
    });

    it('should return null when no learnings mentioned', () => {
      const result = detectField('learnings', 'React and TypeScript project', {});
      expect(result).toBeNull();
    });
  });

  describe('project', () => {
    it('should detect project from frontmatter', () => {
      const result = detectField('project', '', { company: 'TechCorp', project: 'Dashboard' });
      expect(result).not.toBeNull();
      expect(result!.field).toBe('project');
    });

    it('should detect company keywords in content', () => {
      const result = detectField('project', 'TechCorp에서 대시보드 프로젝트를 진행했습니다', {});
      expect(result).not.toBeNull();
    });

    it('should return null when no project mentioned', () => {
      const result = detectField('project', '코딩을 연습했습니다', {});
      expect(result).toBeNull();
    });
  });

  describe('technologies', () => {
    it('should detect technologies from frontmatter', () => {
      const result = detectField('technologies', '', { technologies: ['React', 'TypeScript'] });
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect technology keywords in content', () => {
      const result = detectField('technologies', 'React, TypeScript, Redis를 사용하여 개발했습니다', {});
      expect(result).not.toBeNull();
    });

    it('should return null when no technologies mentioned', () => {
      const result = detectField('technologies', '팀 리딩 역할을 수행했습니다', {});
      expect(result).toBeNull();
    });
  });

  describe('reflections', () => {
    it('should detect reflection keywords in Korean', () => {
      const result = detectField('reflections', '이 경험은 저에게 매우 의미있었습니다. 앞으로도 이런 도전을 하고 싶습니다', {});
      expect(result).not.toBeNull();
      expect(result!.field).toBe('reflections');
    });

    it('should detect reflection keywords in English', () => {
      const result = detectField('reflections', 'I felt proud of our accomplishments and plan to continue this work', {});
      expect(result).not.toBeNull();
    });

    it('should return null when no reflections present', () => {
      const result = detectField('reflections', 'React 프로젝트를 진행했습니다', {});
      expect(result).toBeNull();
    });
  });
});

describe('analyzeDraft', () => {
  it('should detect present and missing fields from partial draft', () => {
    const content = '2024년 2월부터 6월까지 React, TypeScript를 사용하여 성능 최적화 프로젝트를 진행했습니다';
    const frontmatter = { title: 'React Optimization', company: 'TechCorp' };
    const result = analyzeDraft(content, frontmatter);

    // Duration should be detected (dates in content)
    expect(result.presentFields.some(f => f.field === 'duration')).toBe(true);
    // Technologies should be detected (React, TypeScript in content)
    expect(result.presentFields.some(f => f.field === 'technologies')).toBe(true);
    // Project should be detected (company in frontmatter)
    expect(result.presentFields.some(f => f.field === 'project')).toBe(true);
    // Achievements should be missing
    expect(result.missingFields).toContain('achievements');
    // Learnings should be missing
    expect(result.missingFields).toContain('learnings');
    // Should not be sufficient (not all fields present)
    expect(result.isSufficient).toBe(false);
  });

  it('should mark as sufficient when all core fields present', () => {
    const content = [
      '2024년 2월부터 6월까지 React 프로젝트를 진행했습니다.',
      '로딩 시간을 50% 줄이는 성과를 달성했습니다.',
      '이 경험을 통해 배운 점은 성능 최적화의 중요성입니다.',
      'TechCorp의 대시보드 프로젝트였습니다.',
      'React, TypeScript, Redis를 사용했습니다.',
      '이 경험은 저에게 매우 의미있었고, 앞으로도 이런 도전을 하고 싶습니다.',
    ].join('\n');

    const result = analyzeDraft(content, {});
    expect(result.isSufficient).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('should detect language correctly', () => {
    const koreanDraft = '프론트엔드 개발을 진행하면서 많은 것을 배웠습니다';
    const result = analyzeDraft(koreanDraft, {});
    expect(result.language).toBe(Language.KOREAN);
  });

  it('should handle empty draft', () => {
    const result = analyzeDraft('', {});
    expect(result.missingFields).toHaveLength(6);
    expect(result.isSufficient).toBe(false);
  });

  it('should preserve draft content and frontmatter in result', () => {
    const content = 'some content';
    const frontmatter = { title: 'Test' };
    const result = analyzeDraft(content, frontmatter);
    expect(result.draftContent).toBe(content);
    expect(result.frontmatter).toEqual(frontmatter);
  });
});

describe('detectExperienceType', () => {
  it('should detect technical project', () => {
    const content = 'Implemented a new API endpoint and deployed the microservice architecture with Docker and Kubernetes';
    expect(detectExperienceType(content)).toBe(ExperienceType.TECHNICAL_PROJECT);
  });

  it('should detect technical project with Korean keywords', () => {
    const content = 'React 성능 최적화를 위해 아키텍처를 재설계하고 배포 파이프라인을 구축했습니다';
    expect(detectExperienceType(content)).toBe(ExperienceType.TECHNICAL_PROJECT);
  });

  it('should detect leadership role', () => {
    const content = 'Managed a team of 8 engineers, conducted stakeholder meetings and set quarterly OKRs for the department';
    expect(detectExperienceType(content)).toBe(ExperienceType.LEADERSHIP);
  });

  it('should detect leadership with Korean keywords', () => {
    const content = '팀을 이끌며 부서의 목표를 설정하고 이해관계자와 협력하여 프로젝트를 관리했습니다';
    expect(detectExperienceType(content)).toBe(ExperienceType.LEADERSHIP);
  });

  it('should detect learning experience', () => {
    const content = 'Completed an online course on machine learning and earned a certificate from Coursera';
    expect(detectExperienceType(content)).toBe(ExperienceType.LEARNING);
  });

  it('should detect learning with Korean keywords', () => {
    const content = '온라인 강좌를 수강하고 자격증을 취득했습니다. 새로운 기술을 학습했습니다';
    expect(detectExperienceType(content)).toBe(ExperienceType.LEARNING);
  });

  it('should detect job experience', () => {
    const content = 'Joined the company as a senior developer in the product department with responsibilities for the main application';
    expect(detectExperienceType(content)).toBe(ExperienceType.JOB);
  });

  it('should default to GENERAL when no strong signal', () => {
    const content = '좋은 경험이었습니다';
    expect(detectExperienceType(content)).toBe(ExperienceType.GENERAL);
  });
});
