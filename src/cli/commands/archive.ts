import path from 'node:path';
import { createConfig } from '../../models/config.js';
import { validateResumateInitialized, normalizeFilename, parseDurationFromText, parseList, generateTags } from '../utils/validation.js';
import { readFile, writeFile, removeFile, listFiles } from '../../services/file-manager.js';
import { extractTitle, extractQASection, parseQAPairs, stringifyMarkdown } from '../../services/markdown-processor.js';
import { locateFile } from '../../services/workflow-manager.js';
import { extractDateFromFilename } from '../../services/slug-generator.js';
import { getAnsweredFields } from '../utils/prompts.js';
import type { QAPair } from '../../services/markdown-processor.js';

interface ExtractedData {
  title: string;
  date: string;
  duration?: { start: string; end: string };
  project?: string;
  technologies?: string[];
  tags?: string[];
  achievements?: string[];
  learnings?: string;
  reflections?: string;
}

function extractFieldFromQA(qaPairs: QAPair[], fieldKeywords: string[]): string | undefined {
  for (const pair of qaPairs) {
    const questionLower = pair.question.toLowerCase();
    if (fieldKeywords.some((kw) => questionLower.includes(kw)) && pair.answer) {
      return pair.answer;
    }
  }
  return undefined;
}

function extractData(originalContent: string, qaPairs: QAPair[], filename: string): ExtractedData {
  const title = extractTitle(originalContent);
  const date = extractDateFromFilename(filename) || new Date().toISOString().split('T')[0];

  const durationText = extractFieldFromQA(qaPairs, ['기간', '시작일', '종료일', 'timeframe', 'duration']);
  const duration = durationText ? (parseDurationFromText(durationText) ?? undefined) : undefined;

  const achievementText = extractFieldFromQA(qaPairs, ['성과', 'achievement', '지표', 'metric']);
  const achievements = achievementText ? parseList(achievementText) : undefined;

  const techText = extractFieldFromQA(qaPairs, ['기술', '도구', 'technolog', 'tool']);
  const technologies = techText ? parseList(techText) : undefined;

  const learnings = extractFieldFromQA(qaPairs, ['배운', 'learning', '교훈']);
  const reflections = extractFieldFromQA(qaPairs, ['느끼', 'reflection', '소감', '계획']);
  const project = extractFieldFromQA(qaPairs, ['프로젝트', '회사', 'project', 'company']);

  const tags = technologies ? generateTags(technologies) : undefined;

  return { title, date, duration, project, technologies, tags, achievements, learnings, reflections };
}

export async function archiveCommand(filenameArg: string): Promise<void> {
  const rootDir = process.cwd();
  const config = createConfig(rootDir);

  if (!(await validateResumateInitialized(rootDir))) {
    console.error('Error: Resumate not initialized.');
    console.error('Run `resumate init <projectname>` first.');
    process.exit(1);
  }

  const filename = normalizeFilename(filenameArg);
  const { location, filepath } = await locateFile(filename, config);

  if (location === 'not-found') {
    const inProgress = await listFiles(config.inProgressDir, '.md');
    console.error('Error: File not found in in-progress/.');
    console.error('Did you run `/resumate refine` first?');
    if (inProgress.length > 0) {
      console.error(`  Available in in-progress/: ${inProgress.join(', ')}`);
    }
    process.exit(1);
  }

  if (location === 'drafts') {
    console.error("Error: This draft hasn't been refined yet.");
    console.error(`Run \`/resumate refine @${filenameArg}\` first.`);
    process.exit(1);
  }

  if (location === 'archive') {
    console.error('This experience is already archived.');
    console.error(`  Location: archive/${filename}`);
    process.exit(1);
  }

  try {
    const content = await readFile(filepath);
    const qaResult = extractQASection(content);

    if (!qaResult) {
      console.error('Error: No refinement questions found in file.');
      console.error('Run `/resumate refine` to add Q&A before archiving.');
      process.exit(1);
    }

    const qaPairs = parseQAPairs(qaResult.qaSection);
    const data = extractData(qaResult.originalContent, qaPairs, filename);

    // Validate required fields
    const missing: string[] = [];
    if (!data.title) missing.push('Title');
    if (!data.date) missing.push('Date');
    if (!data.duration) missing.push('Duration (start and end dates)');
    if (!qaResult.originalContent.trim()) missing.push('Content');

    if (missing.length > 0) {
      console.error('Error: Cannot archive - missing required fields:');
      missing.forEach((f) => console.error(`  - ${f}`));
      console.error(`\nPlease run \`/resumate refine @${filenameArg}\` to complete these fields.`);
      process.exit(1);
    }

    // Build frontmatter
    const frontmatter: Record<string, unknown> = {
      title: data.title,
      date: data.date,
      duration: data.duration,
    };

    if (data.project) frontmatter.project = data.project;
    if (data.technologies?.length) frontmatter.technologies = data.technologies;
    if (data.tags?.length) frontmatter.tags = data.tags;
    if (data.achievements?.length) frontmatter.achievements = data.achievements;
    if (data.learnings) frontmatter.learnings = data.learnings;
    if (data.reflections) frontmatter.reflections = data.reflections;

    // Build body
    let body = `\n# Detailed Context\n\n${qaResult.originalContent.replace(/^#.*\n\n?/, '').trim()}`;

    if (data.achievements?.length) {
      body += '\n\n## Achievements\n\n';
      data.achievements.forEach((a) => (body += `- ${a}\n`));
    }

    if (data.learnings) {
      body += `\n## Key Learnings\n\n${data.learnings}\n`;
    }

    const archiveContent = stringifyMarkdown(body + '\n', frontmatter);
    const archivePath = path.join(config.archiveDir, filename);
    await writeFile(archivePath, archiveContent);

    // Remove from in-progress only after successful write
    await removeFile(filepath);

    console.log('Experience archived successfully!');
    console.log('');
    console.log(`  File: archive/${filename}`);
    console.log('');
    console.log('Extracted fields:');
    console.log(`  Title: ${data.title}`);
    if (data.duration) console.log(`  Duration: ${data.duration.start} to ${data.duration.end}`);
    if (data.project) console.log(`  Project: ${data.project}`);
    if (data.technologies?.length) console.log(`  Technologies: ${data.technologies.length} items`);
    if (data.achievements?.length) console.log(`  Achievements: ${data.achievements.length} items`);
    if (data.learnings) console.log('  Learnings: Documented');
    if (data.reflections) console.log('  Reflections: Documented');
    console.log('');
    console.log('Your experience is now ready for resume building!');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error archiving experience: ${message}`);
    process.exit(1);
  }
}
