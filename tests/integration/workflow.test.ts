import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { createConfig } from '../../src/models/config.js';
import { writeFile, readFile, fileExists } from '../../src/services/file-manager.js';
import { ensureDirectory } from '../../src/services/file-manager.js';
import { generateUniqueFilename } from '../../src/services/slug-generator.js';
import { extractTitle, extractQASection, parseQAPairs, parseMarkdown, stringifyMarkdown } from '../../src/services/markdown-processor.js';
import { locateFile, moveToInProgress, moveToArchive } from '../../src/services/workflow-manager.js';
import { buildInitialQASection, formatQASection, getAnsweredFields, getNextUnansweredQuestion } from '../../src/cli/utils/prompts.js';
import { questionTemplates } from '../../src/templates/ai-prompts.js';
import { parseDurationFromText, generateTags, parseList } from '../../src/cli/utils/validation.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-integration');

beforeEach(async () => {
  await fs.remove(TEST_DIR);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('Full workflow: draft → refine → archive', () => {
  it('should complete the full experience structuring pipeline', async () => {
    // 1. Init: create directory structure
    const config = createConfig(TEST_DIR);
    await ensureDirectory(config.draftsDir);
    await ensureDirectory(config.inProgressDir);
    await ensureDirectory(config.archiveDir);

    // 2. Draft: write initial content
    const draftContent = '# Built a REST API with Node.js\n\nCreated a high-performance API using Express and TypeScript.';
    const title = extractTitle(draftContent);
    expect(title).toBe('Built a REST API with Node.js');

    const filename = await generateUniqueFilename(title, config.draftsDir, new Date(2024, 5, 15));
    expect(filename).toBe('2024-06-15-built-a-rest-api-with-nodejs.md');

    const draftPath = path.join(config.draftsDir, filename);
    await writeFile(draftPath, draftContent);

    // Verify draft exists
    const located = await locateFile(filename, config);
    expect(located.location).toBe('drafts');

    // 3. Refine: move to in-progress and add Q&A
    const inProgressPath = await moveToInProgress(draftPath, filename, config);
    let content = await readFile(inProgressPath);

    // Add initial Q&A section (first question: duration)
    const initialQA = buildInitialQASection(questionTemplates[0]);
    content += initialQA;
    await writeFile(inProgressPath, content);

    // Verify Q&A was added
    const qa1 = extractQASection(content);
    expect(qa1).not.toBeNull();
    expect(qa1!.qaSection).toContain('## AI Refinement Questions');

    // Simulate user answering duration question
    content = content.replace(
      '_[Please provide your answer]_',
      '2024년 1월 1일부터 2024년 6월 30일까지',
    );
    await writeFile(inProgressPath, content);

    // Parse answers and add next question
    const qa2 = extractQASection(content)!;
    const pairs = parseQAPairs(qa2.qaSection);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].answer).toContain('2024년 1월 1일');

    const answeredFields = getAnsweredFields(pairs);
    expect(answeredFields).toContain('duration');

    const nextQ = getNextUnansweredQuestion(pairs);
    expect(nextQ).not.toBeNull();
    expect(nextQ!.field).toBe('achievements');

    // Add the next question and simulate answer
    const updatedQA = formatQASection(pairs, nextQ!);
    content = qa2.originalContent + '\n\n---\n\n' + updatedQA;
    // Answer achievements
    content = content.replace(
      /(\*\*A\*\*: _\[Please provide your answer\]_)(?![\s\S]*\*\*A\*\*)/, // first placeholder
      '**A**: - API 응답 시간 50% 개선\n- 일일 요청 100만 건 처리',
    );
    await writeFile(inProgressPath, content);

    // Add technology answer for tag generation
    const qa3 = extractQASection(content)!;
    const pairs2 = parseQAPairs(qa3.qaSection);

    // 4. Archive: extract structured data and create final document
    // Parse duration from the answer
    const durationAnswer = pairs[0].answer!;
    const duration = parseDurationFromText(durationAnswer);
    expect(duration).toEqual({ start: '2024-01-01', end: '2024-06-30' });

    // Parse technologies
    const techText = 'Express, TypeScript, Redis, PostgreSQL';
    const technologies = parseList(techText);
    expect(technologies).toEqual(['Express', 'TypeScript', 'Redis', 'PostgreSQL']);

    // Generate tags
    const tags = generateTags(technologies);
    expect(tags).toContain('backend');
    expect(tags).toContain('typescript');
    expect(tags).toContain('database');

    // Build frontmatter
    const frontmatter = {
      title,
      date: '2024-06-15',
      duration: { start: duration!.start, end: duration!.end },
      technologies,
      tags,
      achievements: ['API 응답 시간 50% 개선', '일일 요청 100만 건 처리'],
    };

    const body = `## Detailed Context\n\n${qa3.originalContent.replace(/^#\s+.+\n/, '').trim()}`;
    const archiveContent = stringifyMarkdown(body, frontmatter);

    // Verify YAML frontmatter in output
    const parsed = parseMarkdown(archiveContent);
    expect(parsed.data.title).toBe('Built a REST API with Node.js');
    expect(parsed.data.date).toBe('2024-06-15');
    expect(parsed.data.duration).toEqual({ start: '2024-01-01', end: '2024-06-30' });
    expect(parsed.data.technologies).toEqual(['Express', 'TypeScript', 'Redis', 'PostgreSQL']);
    expect(parsed.data.tags).toContain('backend');

    // Move to archive
    const archivePath = await moveToArchive(inProgressPath, filename, config);
    await writeFile(archivePath, archiveContent);

    // Verify final state
    expect(await fileExists(path.join(config.inProgressDir, filename))).toBe(false);
    expect(await fileExists(archivePath)).toBe(true);

    const finalContent = await readFile(archivePath);
    expect(finalContent).toContain('title: Built a REST API with Node.js');
    expect(finalContent).toContain('## Detailed Context');
  });
});
