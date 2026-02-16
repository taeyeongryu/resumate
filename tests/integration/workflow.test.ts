import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { writeFile, readFile, fileExists } from '../../src/services/file-manager.js';
import { ensureDirectory } from '../../src/services/file-manager.js';
import { extractTitle, extractQASection, parseQAPairs, parseMarkdown, stringifyMarkdown } from '../../src/services/markdown-processor.js';
import { locateFile, moveToInProgress, moveToArchive } from '../../src/services/workflow-manager.js';
import { buildInitialQASection, formatQASection, getAnsweredFields, getNextUnansweredQuestion } from '../../src/cli/utils/prompts.js';
import { questionTemplates } from '../../src/templates/ai-prompts.js';
import { parseDurationFromText, generateTags, parseList } from '../../src/cli/utils/validation.js';
import { generateUniqueFilename } from '../../src/services/slug-generator.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-integration');

// Legacy directory paths for old workflow tests
const DRAFTS_DIR = path.join(TEST_DIR, 'drafts');
const IN_PROGRESS_DIR = path.join(TEST_DIR, 'in-progress');
const ARCHIVE_DIR = path.join(TEST_DIR, 'archive');

const legacyConfig = {
  rootDir: TEST_DIR,
  resumateDir: path.join(TEST_DIR, '.resumate'),
  draftsDir: DRAFTS_DIR,
  inProgressDir: IN_PROGRESS_DIR,
  archiveDir: ARCHIVE_DIR,
  claudeCommandsDir: path.join(TEST_DIR, '.claude', 'commands'),
};

beforeEach(async () => {
  await fs.remove(TEST_DIR);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('Full workflow: add → refine → archive (legacy)', () => {
  it('should complete the full experience structuring pipeline', async () => {
    // 1. Init: create directory structure (legacy layout)
    await ensureDirectory(legacyConfig.resumateDir);
    await ensureDirectory(DRAFTS_DIR);
    await ensureDirectory(IN_PROGRESS_DIR);
    await ensureDirectory(ARCHIVE_DIR);

    // 2. Add: create file in drafts/
    const dateFilename = await generateUniqueFilename('test-experience', DRAFTS_DIR, new Date('2024-06-15'));
    expect(dateFilename).toBe('2024-06-15-test-experience.md');
    const draftPath = path.join(DRAFTS_DIR, dateFilename);
    await writeFile(draftPath, '');

    // User edits the file with content
    const draftContent = '# Built a REST API with Node.js\n\nCreated a high-performance API using Express and TypeScript.';
    await writeFile(draftPath, draftContent);

    const title = extractTitle(draftContent);
    expect(title).toBe('Built a REST API with Node.js');

    // Verify draft exists
    const located = await locateFile(dateFilename, legacyConfig);
    expect(located.location).toBe('drafts');

    // 3. Refine: move to in-progress and add Q&A
    const inProgressPath = await moveToInProgress(draftPath, dateFilename, legacyConfig);
    let content = await readFile(inProgressPath);

    const initialQA = buildInitialQASection(questionTemplates[0]);
    content += initialQA;
    await writeFile(inProgressPath, content);

    const qa1 = extractQASection(content);
    expect(qa1).not.toBeNull();
    expect(qa1!.qaSection).toContain('## AI Refinement Questions');

    // Simulate user answering duration question
    content = content.replace(
      '_[Please provide your answer]_',
      '2024년 1월 1일부터 2024년 6월 30일까지',
    );
    await writeFile(inProgressPath, content);

    const qa2 = extractQASection(content)!;
    const pairs = parseQAPairs(qa2.qaSection);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].answer).toContain('2024년 1월 1일');

    const answeredFields = getAnsweredFields(pairs);
    expect(answeredFields).toContain('duration');

    const nextQ = getNextUnansweredQuestion(pairs);
    expect(nextQ).not.toBeNull();
    expect(nextQ!.field).toBe('achievements');

    const updatedQA = formatQASection(pairs, nextQ!);
    content = qa2.originalContent + '\n\n---\n\n' + updatedQA;
    content = content.replace(
      /(\*\*A\*\*: _\[Please provide your answer\]_)(?![\s\S]*\*\*A\*\*)/,
      '**A**: - API 응답 시간 50% 개선\n- 일일 요청 100만 건 처리',
    );
    await writeFile(inProgressPath, content);

    // 4. Archive: extract structured data and create final document
    const durationAnswer = pairs[0].answer!;
    const duration = parseDurationFromText(durationAnswer);
    expect(duration).toEqual({ start: '2024-01-01', end: '2024-06-30' });

    const techText = 'Express, TypeScript, Redis, PostgreSQL';
    const technologies = parseList(techText);
    expect(technologies).toEqual(['Express', 'TypeScript', 'Redis', 'PostgreSQL']);

    const tags = generateTags(technologies);
    expect(tags).toContain('backend');
    expect(tags).toContain('typescript');
    expect(tags).toContain('database');

    const frontmatter = {
      title,
      date: '2024-06-15',
      duration: { start: duration!.start, end: duration!.end },
      technologies,
      tags,
      achievements: ['API 응답 시간 50% 개선', '일일 요청 100만 건 처리'],
    };

    const qa3 = extractQASection(content)!;
    const body = `## Detailed Context\n\n${qa3.originalContent.replace(/^#\s+.+\n/, '').trim()}`;
    const archiveContent = stringifyMarkdown(body, frontmatter);

    const parsed = parseMarkdown(archiveContent);
    expect(parsed.data.title).toBe('Built a REST API with Node.js');
    expect(parsed.data.date).toBe('2024-06-15');
    expect(parsed.data.duration).toEqual({ start: '2024-01-01', end: '2024-06-30' });
    expect(parsed.data.technologies).toEqual(['Express', 'TypeScript', 'Redis', 'PostgreSQL']);
    expect(parsed.data.tags).toContain('backend');

    // Move to archive
    const archivePath = await moveToArchive(inProgressPath, dateFilename, legacyConfig);
    await writeFile(archivePath, archiveContent);

    // Verify final state
    expect(await fileExists(path.join(IN_PROGRESS_DIR, dateFilename))).toBe(false);
    expect(await fileExists(archivePath)).toBe(true);

    const finalContent = await readFile(archivePath);
    expect(finalContent).toContain('title: Built a REST API with Node.js');
    expect(finalContent).toContain('## Detailed Context');
  });

  it('should handle filename collisions in legacy workflow', async () => {
    await ensureDirectory(DRAFTS_DIR);

    // Create first file
    const filename1 = await generateUniqueFilename('test', DRAFTS_DIR, new Date('2024-06-15'));
    expect(filename1).toBe('2024-06-15-test.md');
    await writeFile(path.join(DRAFTS_DIR, filename1), '');

    // Create second file — should get -1 suffix
    const filename2 = await generateUniqueFilename('test', DRAFTS_DIR, new Date('2024-06-15'));
    expect(filename2).toBe('2024-06-15-test-1.md');
    await writeFile(path.join(DRAFTS_DIR, filename2), '');

    // Both files should be locatable
    const result1 = await locateFile(filename1, legacyConfig);
    expect(result1.location).toBe('drafts');
    const result2 = await locateFile(filename2, legacyConfig);
    expect(result2.location).toBe('drafts');
  });
});
