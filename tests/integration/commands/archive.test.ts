import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { createConfig } from '../../../src/models/config.js';
import { ExperienceManager } from '../../../src/services/experience-manager.js';
import { analyzeRefined } from '../../../src/services/archive-analyzer.js';
import { buildArchivePromptOutput } from '../../../src/templates/ai-prompts.js';
import { validateStructuredArchiveContent } from '../../../src/cli/utils/validation.js';
import { stringifyMarkdown, extractQASection, parseQAPairs } from '../../../src/services/markdown-processor.js';
import { calculateCompleteness } from '../../../src/services/archive-analyzer.js';
import { generateTags } from '../../../src/cli/utils/validation.js';
import type { StructuredArchiveContent, TechEntry } from '../../../src/models/experience.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-archive-integration');

let manager: ExperienceManager;

beforeEach(async () => {
  await fs.remove(TEST_DIR);
  const config = createConfig(TEST_DIR);
  await fs.ensureDir(config.experiencesDir);
  await fs.ensureDir(config.resumateDir);
  manager = new ExperienceManager(config);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

// Helper: create an experience with refined.md containing Q&A
async function createRefinedExperience(
  dirName: string,
  slug: string,
  refinedContent: string,
): Promise<void> {
  const dateStr = dirName.substring(0, 10);
  await manager.createExperience(
    new Date(dateStr),
    slug,
    { title: 'Test Experience', company: 'TestCo', role: 'Dev' },
  );
  await manager.addRefinedVersion(dirName, refinedContent);
}

const REFINED_WITH_NATURAL_LANGUAGE = `---
title: "React 성능 최적화"
date: "2024-06-15"
company: "TechCorp"
role: "Senior Engineer"
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

describe('archive command integration', () => {
  // --- Existing tests preserved ---

  it('should create archived.md while preserving all version files', async () => {
    const experience = await manager.createExperience(
      new Date('2024-06-15'),
      'react-optimization',
      {
        title: 'React Performance Optimization',
        company: 'TechCorp',
        role: 'Senior Engineer',
        description: 'Led team initiative.',
      },
    );

    await manager.addRefinedVersion('2024-06-15-react-optimization', 'Refined content');

    const archivedContent = [
      '---',
      'experience:',
      '  title: React Performance Optimization',
      '  company: TechCorp',
      '  achievements:',
      '    - description: Reduced bundle size by 40%',
      '---',
      '',
      'Archived structured content.',
    ].join('\n');

    await manager.addArchivedVersion('2024-06-15-react-optimization', archivedContent);

    expect(await fs.pathExists(path.join(experience.path, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(experience.path, 'refined.md'))).toBe(true);
    expect(await fs.pathExists(path.join(experience.path, 'archived.md'))).toBe(true);

    const archived = await fs.readFile(path.join(experience.path, 'archived.md'), 'utf-8');
    expect(archived).toContain('Reduced bundle size by 40%');
  });

  it('should reject archiving without refined version', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', {
      title: 'Test',
      company: 'Corp',
      role: 'Dev',
    });
    await expect(manager.addArchivedVersion('2024-06-15-test', 'archived')).rejects.toThrow(
      /refined/i,
    );
  });

  it('should reject duplicate archiving', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', {
      title: 'Test',
      company: 'Corp',
      role: 'Dev',
    });
    await manager.addRefinedVersion('2024-06-15-test', 'refined');
    await manager.addArchivedVersion('2024-06-15-test', 'archived');
    await expect(
      manager.addArchivedVersion('2024-06-15-test', 'archived again'),
    ).rejects.toThrow(/already has.*archived/i);
  });

  it('should complete full lifecycle: draft → refined → archived', async () => {
    const dirName = '2024-06-15-full-lifecycle';
    await manager.createExperience(new Date('2024-06-15'), 'full-lifecycle', {
      title: 'Full Lifecycle Test',
      company: 'TestCo',
      role: 'Engineer',
    });

    let versions = await manager.getAvailableVersions(dirName);
    expect(versions).toEqual({ draft: true, refined: false, archived: false });

    await manager.addRefinedVersion(dirName, 'refined content');
    versions = await manager.getAvailableVersions(dirName);
    expect(versions).toEqual({ draft: true, refined: true, archived: false });

    await manager.addArchivedVersion(dirName, 'archived content');
    versions = await manager.getAvailableVersions(dirName);
    expect(versions).toEqual({ draft: true, refined: true, archived: true });

    const draft = await manager.getVersion(dirName, 'draft');
    const refined = await manager.getVersion(dirName, 'refined');
    const archived = await manager.getVersion(dirName, 'archived');
    expect(draft).toContain('Full Lifecycle Test');
    expect(refined).toBe('refined content');
    expect(archived).toBe('archived content');
  });
});

// --- T007: --prompt mode integration tests ---
describe('archive --prompt mode', () => {
  it('should output valid ArchivePromptOutput JSON', async () => {
    await createRefinedExperience(
      '2024-06-15-react-optimization',
      'react-optimization',
      REFINED_WITH_NATURAL_LANGUAGE,
    );

    const refinedContent = await manager.getVersion('2024-06-15-react-optimization', 'refined');
    const analysis = analyzeRefined(refinedContent, '2024-06-15');
    const output = buildArchivePromptOutput(analysis, '2024-06-15-react-optimization');

    expect(output.status).toBe('ready');
    expect(output.analysis.qaPairs).toHaveLength(3);
    expect(output.analysis.title).toBe('React 성능 최적화');
    expect(output.prompt).toContain('JSON');
    expect(output.prompt).toContain('3월 말부터 상반기까지');
    expect(output.metadata.experienceName).toBe('2024-06-15-react-optimization');
    expect(output.metadata.outputFormat).toBe('json');
  });

  it('should include Q&A pairs in the prompt output', async () => {
    await createRefinedExperience(
      '2024-06-15-react-optimization',
      'react-optimization',
      REFINED_WITH_NATURAL_LANGUAGE,
    );

    const refinedContent = await manager.getVersion('2024-06-15-react-optimization', 'refined');
    const analysis = analyzeRefined(refinedContent, '2024-06-15');
    const output = buildArchivePromptOutput(analysis, '2024-06-15-react-optimization');

    expect(output.analysis.qaPairs[0].answer).toBe('3월 말부터 상반기까지');
    expect(output.analysis.qaPairs[1].answer).toBe('로딩 시간 반으로 줄임');
    expect(output.analysis.qaPairs[2].answer).toBe('react, ts, 레디스');
  });
});

// --- T008: --content mode integration tests ---
describe('archive --content mode', () => {
  it('should create archived.md from StructuredArchiveContent JSON', async () => {
    const dirName = '2024-06-15-react-optimization';
    await createRefinedExperience(dirName, 'react-optimization', REFINED_WITH_NATURAL_LANGUAGE);

    const structuredContent: StructuredArchiveContent = {
      title: 'React 성능 최적화',
      duration: {
        original: '3월 말부터 상반기까지',
        start: '2024-03-31',
        end: '2024-06-30',
        interpretation: '2024년 3월 말 ~ 6월 말 (약 3개월)',
      },
      project: 'TechCorp Dashboard',
      technologies: [
        { original: 'react', normalized: 'React' },
        { original: 'ts', normalized: 'TypeScript' },
        { original: '레디스', normalized: 'Redis' },
      ],
      achievements: [
        { original: '로딩 시간 반으로 줄임', resumeReady: '페이지 로딩 시간 50% 개선' },
      ],
      learnings: '성능 최적화의 중요성을 깨달았습니다',
      reflections: null,
      qaSummary: [
        {
          question: '이 작업의 구체적인 기간이 어떻게 되나요?',
          answer: '3월 말부터 상반기까지',
          interpretation: '2024년 3월 말 ~ 6월 말경으로 추정',
        },
      ],
      completeness: {
        score: 85,
        breakdown: {
          title: { present: true, weight: 10, qualityScore: 1 },
          duration: { present: true, weight: 20, qualityScore: 1 },
          achievements: { present: true, weight: 25, qualityScore: 1 },
          technologies: { present: true, weight: 15, qualityScore: 1 },
          learnings: { present: true, weight: 15, qualityScore: 0.7 },
          project: { present: true, weight: 10, qualityScore: 1 },
          reflections: { present: false, weight: 5, qualityScore: 0 },
        },
        suggestions: ['개인적인 소감을 추가하면 경험의 의미를 더 잘 전달할 수 있습니다'],
      },
      aiComments: '기술적 성과가 명확하고 정량적입니다.',
    };

    const contentJson = JSON.stringify(structuredContent);
    const validated = validateStructuredArchiveContent(contentJson);

    // Simulate what handleContentMode does
    const refinedContent = await manager.getVersion(dirName, 'refined');
    const frontmatter: Record<string, unknown> = {
      title: validated.title,
      date: '2024-06-15',
      duration: validated.duration,
      project: validated.project,
      technologies: validated.technologies,
      achievements: validated.achievements,
      learnings: validated.learnings,
      tags: generateTags(validated.technologies.map((t: TechEntry) => t.normalized)),
      completeness: { score: validated.completeness.score, suggestions: validated.completeness.suggestions },
    };

    const qaResult = extractQASection(refinedContent);
    const originalContent = qaResult
      ? qaResult.originalContent.replace(/^---[\s\S]*?---\s*/, '').replace(/^#.*\n\n?/, '').trim()
      : '';

    let body = `\n# Detailed Context\n\n${originalContent}`;
    body += '\n\n## Achievements\n\n';
    for (const a of validated.achievements) {
      body += `- ${a.original}\n`;
      body += `  → 이력서 작성 시: "${a.resumeReady}"\n`;
    }
    body += `\n## Key Learnings\n\n${validated.learnings}\n`;
    body += '\n## Q&A Summary\n\n';
    for (const qa of validated.qaSummary) {
      body += `### Q: ${qa.question}\n**A**: ${qa.answer}\n**해석**: ${qa.interpretation}\n\n`;
    }
    body += `## AI Comments\n\n${validated.aiComments}\n`;

    const archiveContent = stringifyMarkdown(body + '\n', frontmatter);
    await manager.addArchivedVersion(dirName, archiveContent);

    // Verify
    const archived = await manager.getVersion(dirName, 'archived');
    expect(archived).toContain('React 성능 최적화');
    expect(archived).toContain('3월 말부터 상반기까지');
    expect(archived).toContain('로딩 시간 반으로 줄임');
    expect(archived).toContain('이력서 작성 시');
    expect(archived).toContain('TypeScript');
    expect(archived).toContain('Redis');
    expect(archived).toContain('Q&A Summary');
    expect(archived).toContain('AI Comments');

    const parsed = matter(archived);
    expect(parsed.data.title).toBe('React 성능 최적화');
    expect(parsed.data.completeness.score).toBe(85);
    expect(parsed.data.technologies).toHaveLength(3);
  });

  it('should preserve original user answers verbatim', async () => {
    const dirName = '2024-06-15-react-optimization';
    await createRefinedExperience(dirName, 'react-optimization', REFINED_WITH_NATURAL_LANGUAGE);

    const structuredContent: StructuredArchiveContent = {
      title: 'React 성능 최적화',
      duration: {
        original: '3월 말부터 상반기까지',
        start: '2024-03-31',
        end: '2024-06-30',
        interpretation: '2024년 3월 말 ~ 6월',
      },
      project: null,
      technologies: [{ original: 'react', normalized: 'React' }],
      achievements: [{ original: '로딩 시간 반으로 줄임', resumeReady: '로딩 시간 50% 개선' }],
      learnings: null,
      reflections: null,
      qaSummary: [],
      completeness: { score: 50, breakdown: {}, suggestions: [] },
      aiComments: '',
    };

    const validated = validateStructuredArchiveContent(JSON.stringify(structuredContent));
    expect(validated.duration!.original).toBe('3월 말부터 상반기까지');
    expect(validated.achievements[0].original).toBe('로딩 시간 반으로 줄임');
  });
});

// --- T009: Relaxed fallback mode integration tests ---
describe('archive fallback mode (relaxed)', () => {
  it('should create archived.md even with natural language dates that fail parsing', async () => {
    const dirName = '2024-06-15-react-optimization';
    await createRefinedExperience(dirName, 'react-optimization', REFINED_WITH_NATURAL_LANGUAGE);

    const refinedContent = await manager.getVersion(dirName, 'refined');
    const parsed = matter(refinedContent);
    const contentWithoutFrontmatter = parsed.content;
    const qaResult = extractQASection(contentWithoutFrontmatter);
    const originalContent = qaResult ? qaResult.originalContent : contentWithoutFrontmatter;
    const qaPairs = qaResult ? parseQAPairs(qaResult.qaSection) : [];

    // "3월 말부터 상반기까지" cannot be parsed to ISO dates by parseDurationFromText
    // Fallback should still succeed — no process.exit(1)
    const title = 'React 성능 최적화';
    const frontmatter: Record<string, unknown> = {
      title,
      date: '2024-06-15',
    };

    const completeness = calculateCompleteness({ title });
    frontmatter.completeness = { score: completeness.score, suggestions: completeness.suggestions };

    const contentBody = originalContent.replace(/^#.*\n\n?/, '').trim();
    const body = `\n# Detailed Context\n\n${contentBody}\n`;
    const archiveContent = stringifyMarkdown(body, frontmatter);

    await manager.addArchivedVersion(dirName, archiveContent);

    const archived = await manager.getVersion(dirName, 'archived');
    expect(archived).toContain('React 성능 최적화');
    // Should succeed without errors — this is the key assertion
    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences', dirName, 'archived.md'))).toBe(true);
  });

  it('should produce completeness score in fallback mode', async () => {
    const dirName = '2024-06-15-react-optimization';
    await createRefinedExperience(dirName, 'react-optimization', REFINED_WITH_NATURAL_LANGUAGE);

    const completeness = calculateCompleteness({
      title: 'React 성능 최적화',
      // Natural language dates → no structured duration in fallback
    });

    expect(completeness.score).toBeGreaterThan(0);
    expect(completeness.score).toBeLessThan(50);
    expect(completeness.suggestions.length).toBeGreaterThan(0);
  });
});

// --- T010: Edge case — no Q&A section ---
describe('archive edge case: no Q&A section', () => {
  it('should archive content-only refined.md without Q&A', async () => {
    const dirName = '2024-01-10-simple-experience';
    await createRefinedExperience(dirName, 'simple-experience', REFINED_WITHOUT_QA);

    const refinedContent = await manager.getVersion(dirName, 'refined');
    const parsed = matter(refinedContent);
    const contentWithoutFrontmatter = parsed.content;
    const qaResult = extractQASection(contentWithoutFrontmatter);

    // Should have no Q&A section
    expect(qaResult).toBeNull();

    const title = (parsed.data.title as string) || 'Simple Experience';
    const frontmatter: Record<string, unknown> = {
      title,
      date: '2024-01-10',
    };

    const completeness = calculateCompleteness({ title });
    frontmatter.completeness = { score: completeness.score, suggestions: completeness.suggestions };

    const contentBody = contentWithoutFrontmatter.replace(/^#.*\n\n?/, '').trim();
    const body = `\n# Detailed Context\n\n${contentBody}\n`;
    const archiveContent = stringifyMarkdown(body, frontmatter);

    await manager.addArchivedVersion(dirName, archiveContent);

    const archived = await manager.getVersion(dirName, 'archived');
    expect(archived).toContain('Simple Experience');
    expect(archived).toContain('Just some content');

    const archivedParsed = matter(archived);
    expect(archivedParsed.data.completeness.score).toBeLessThan(40);
  });
});

// --- T026 (Phase 5): Edge case tests ---
describe('archive edge cases', () => {
  it('should reject re-archive attempt (FR-010)', async () => {
    const dirName = '2024-06-15-test';
    await manager.createExperience(new Date('2024-06-15'), 'test', {
      title: 'Test', company: 'Corp', role: 'Dev',
    });
    await manager.addRefinedVersion(dirName, 'refined');
    await manager.addArchivedVersion(dirName, 'archived');
    await expect(
      manager.addArchivedVersion(dirName, 'archived again'),
    ).rejects.toThrow(/already has.*archived/i);
  });

  it('should handle completion signal answers gracefully', async () => {
    const refinedWithDone = `---
title: "Minimal Experience"
date: "2024-06-15"
---

# Minimal Experience

Some basic work.

---

## AI Refinement Questions

### Q: 이 작업의 구체적인 기간이 어떻게 되나요?
**A**: 충분해

### Q: 어떤 성과가 있었나요?
**A**: done
`;
    const dirName = '2024-06-15-minimal';
    await createRefinedExperience(dirName, 'minimal', refinedWithDone);

    const refinedContent = await manager.getVersion(dirName, 'refined');
    const parsed = matter(refinedContent);
    const qaResult = extractQASection(parsed.content);
    const qaPairs = qaResult ? parseQAPairs(qaResult.qaSection) : [];

    // Completion signal answers should be treated as content (not crash)
    expect(qaPairs).toHaveLength(2);
    expect(qaPairs[0].answer).toBe('충분해');
    expect(qaPairs[1].answer).toBe('done');

    // Fallback extraction won't match keywords but should still archive
    const completeness = calculateCompleteness({ title: 'Minimal Experience' });
    expect(completeness.score).toBeLessThan(40);
  });

  it('should produce same or better quality for well-formatted ISO dates (FR-009)', async () => {
    const refinedWithISO = `---
title: "Well Formatted Experience"
date: "2024-06-15"
---

# Well Formatted Experience

Developed a new feature at TechCorp.

---

## AI Refinement Questions

### Q: 이 작업의 구체적인 기간이 어떻게 되나요?
**A**: 2024년 2월 1일부터 2024년 6월 15일까지

### Q: 어떤 성과가 있었나요?
**A**: 로딩 시간 50% 감소

### Q: 어떤 기술이나 도구를 사용했나요?
**A**: React, TypeScript, Redis
`;
    const dirName = '2024-06-15-well-formatted';
    await createRefinedExperience(dirName, 'well-formatted', refinedWithISO);

    const refinedContent = await manager.getVersion(dirName, 'refined');
    const analysis = analyzeRefined(refinedContent, '2024-06-15');

    expect(analysis.title).toBe('Well Formatted Experience');
    expect(analysis.qaPairs).toHaveLength(3);
    expect(analysis.qaPairs[0].answer).toContain('2024년 2월 1일');

    // The prompt output should be ready and include all data
    const output = buildArchivePromptOutput(analysis, dirName);
    expect(output.status).toBe('ready');
    expect(output.prompt).toContain('2024년 2월 1일');
  });
});

// --- Validation tests ---
describe('validateStructuredArchiveContent', () => {
  it('should reject invalid JSON', () => {
    expect(() => validateStructuredArchiveContent('not json')).toThrow(/Invalid JSON/);
  });

  it('should reject missing title', () => {
    expect(() => validateStructuredArchiveContent(JSON.stringify({ project: 'test' }))).toThrow(/title/);
  });

  it('should reject empty title', () => {
    expect(() => validateStructuredArchiveContent(JSON.stringify({ title: '' }))).toThrow(/title/);
  });

  it('should reject completeness score out of range', () => {
    expect(() =>
      validateStructuredArchiveContent(
        JSON.stringify({ title: 'Test', completeness: { score: 150 } }),
      ),
    ).toThrow(/completeness.score/);
  });

  it('should provide defaults for optional fields', () => {
    const result = validateStructuredArchiveContent(JSON.stringify({ title: 'Test' }));
    expect(result.title).toBe('Test');
    expect(result.duration).toBeNull();
    expect(result.project).toBeNull();
    expect(result.technologies).toEqual([]);
    expect(result.achievements).toEqual([]);
    expect(result.qaSummary).toEqual([]);
    expect(result.aiComments).toBe('');
  });
});
