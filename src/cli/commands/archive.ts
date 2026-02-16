import { createConfig } from '../../models/config.js';
import { validateResumateInitialized, parseDurationFromText, parseList, generateTags, validateStructuredArchiveContent } from '../utils/validation.js';
import { ExperienceManager } from '../../services/experience-manager.js';
import { ExperienceLocator } from '../../services/experience-locator.js';
import { extractTitle, extractQASection, parseQAPairs, stringifyMarkdown } from '../../services/markdown-processor.js';
import { analyzeRefined, calculateCompleteness } from '../../services/archive-analyzer.js';
import { buildArchivePromptOutput } from '../../templates/ai-prompts.js';
import type { QAPair } from '../../services/markdown-processor.js';
import type { StructuredArchiveContent, TechEntry } from '../../models/experience.js';

export interface ArchiveOptions {
  prompt?: boolean;
  content?: string;
}

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

function extractData(originalContent: string, qaPairs: QAPair[], dateStr: string): ExtractedData {
  const title = extractTitle(originalContent);
  const date = dateStr;

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

export async function archiveCommand(query: string, options?: ArchiveOptions): Promise<void> {
  const rootDir = process.cwd();
  const config = createConfig(rootDir);

  if (!(await validateResumateInitialized(rootDir))) {
    console.error('✗ Error: Not a Resumate project');
    console.error('');
    console.error("  Run 'resumate init' first to initialize the project.");
    process.exit(1);
  }

  try {
    const manager = new ExperienceManager(config);
    const locator = new ExperienceLocator(config);

    // Use ExperienceLocator for flexible search
    const experience = await locator.findOne(query);

    // Check if refined exists
    if (!experience.versions.refined) {
      console.error(`✗ Error: No refined version found for experience: ${experience.name}`);
      console.error('');
      console.error('  The archive command requires a refined version.');
      console.error('');
      console.error('  Next steps:');
      console.error(`    1. Run 'resumate refine ${experience.name}' first`);
      console.error(`    2. Then run 'resumate archive ${experience.name}'`);
      process.exit(1);
    }

    // Check if already archived
    if (experience.versions.archived) {
      console.error(`✗ Error: Experience already has archived version: ${experience.name}`);
      console.error('');
      console.error(`  Location: experiences/${experience.name}/archived.md`);
      console.error('');
      console.error('  Options:');
      console.error('    • Edit archived.md directly');
      console.error("    • Delete archived.md and run 'resumate archive' again to recreate");
      process.exit(1);
    }

    // Read refined content
    const refinedContent = await manager.getVersion(experience.name, 'refined');
    const dateStr = experience.date.toISOString().split('T')[0];

    // Handle --prompt flag: analyze and output JSON
    if (options?.prompt) {
      await handlePromptMode(refinedContent, experience.name, dateStr);
      return;
    }

    // Handle --content flag: accept AI-structured content and write archive
    if (options?.content) {
      await handleContentMode(options.content, refinedContent, experience.name, dateStr, manager);
      return;
    }

    // Default: relaxed fallback mode (never fails)
    await handleFallbackMode(refinedContent, experience.name, dateStr, manager);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Error: ${message}`);
    process.exit(1);
  }
}

async function handlePromptMode(refinedContent: string, experienceName: string, dateStr: string): Promise<void> {
  const analysis = analyzeRefined(refinedContent, dateStr);
  const output = buildArchivePromptOutput(analysis, experienceName);
  process.stdout.write(JSON.stringify(output));
}

async function handleContentMode(
  contentJson: string,
  refinedContent: string,
  experienceName: string,
  dateStr: string,
  manager: ExperienceManager,
): Promise<void> {
  const data = validateStructuredArchiveContent(contentJson);

  console.log(`Found experience: ${experienceName}`);
  console.log('');
  console.log('Generating AI-structured archive...');

  // Build frontmatter
  const frontmatter: Record<string, unknown> = {
    title: data.title,
    date: dateStr,
  };

  if (data.duration) {
    frontmatter.duration = data.duration;
  }
  if (data.project) frontmatter.project = data.project;
  if (data.technologies.length > 0) frontmatter.technologies = data.technologies;
  if (data.achievements.length > 0) frontmatter.achievements = data.achievements;
  if (data.learnings) frontmatter.learnings = data.learnings;
  if (data.reflections) frontmatter.reflections = data.reflections;

  // Generate tags from normalized technology names
  const normalizedTechNames = data.technologies.map((t: TechEntry) => t.normalized);
  const tags = generateTags(normalizedTechNames);
  if (tags.length > 0) frontmatter.tags = tags;

  // Include completeness metadata
  frontmatter.completeness = {
    score: data.completeness.score,
    suggestions: data.completeness.suggestions,
  };

  // Build markdown body
  const qaResult = extractQASection(refinedContent);
  const originalContent = qaResult
    ? qaResult.originalContent.replace(/^---[\s\S]*?---\s*/, '').replace(/^#.*\n\n?/, '').trim()
    : refinedContent.replace(/^---[\s\S]*?---\s*/, '').replace(/^#.*\n\n?/, '').trim();

  let body = `\n# Detailed Context\n\n${originalContent}`;

  // Achievements with resume-ready suggestions
  if (data.achievements.length > 0) {
    body += '\n\n## Achievements\n\n';
    for (const a of data.achievements) {
      body += `- ${a.original}\n`;
      if (a.resumeReady !== a.original) {
        body += `  → 이력서 작성 시: "${a.resumeReady}"\n`;
      }
    }
  }

  // Key Learnings
  if (data.learnings) {
    body += `\n## Key Learnings\n\n${data.learnings}\n`;
  }

  // Q&A Summary
  if (data.qaSummary.length > 0) {
    body += '\n## Q&A Summary\n\n';
    for (const qa of data.qaSummary) {
      body += `### Q: ${qa.question}\n`;
      body += `**A**: ${qa.answer}\n`;
      body += `**해석**: ${qa.interpretation}\n\n`;
    }
  }

  // AI Comments
  if (data.aiComments) {
    body += `## AI Comments\n\n${data.aiComments}\n`;
  }

  const archiveContent = stringifyMarkdown(body + '\n', frontmatter);
  await manager.addArchivedVersion(experienceName, archiveContent);

  printArchiveSuccess(experienceName, data);
}

async function handleFallbackMode(
  refinedContent: string,
  experienceName: string,
  dateStr: string,
  manager: ExperienceManager,
): Promise<void> {
  console.log(`Found experience: ${experienceName}`);
  console.log('');
  console.log('Generating structured archive from refined version...');

  const qaResult = extractQASection(refinedContent);

  // Handle case where there's no Q&A section — archive content as-is
  const originalContent = qaResult
    ? qaResult.originalContent
    : refinedContent;
  const qaPairs = qaResult ? parseQAPairs(qaResult.qaSection) : [];

  const data = extractData(originalContent, qaPairs, dateStr);

  // Build frontmatter — never fail, use null for missing fields
  const frontmatter: Record<string, unknown> = {
    title: data.title || experienceName,
    date: data.date,
  };

  if (data.duration) frontmatter.duration = data.duration;
  if (data.project) frontmatter.project = data.project;
  if (data.technologies?.length) frontmatter.technologies = data.technologies;
  if (data.tags?.length) frontmatter.tags = data.tags;
  if (data.achievements?.length) frontmatter.achievements = data.achievements;
  if (data.learnings) frontmatter.learnings = data.learnings;
  if (data.reflections) frontmatter.reflections = data.reflections;

  // Calculate completeness for fallback mode
  const completeness = calculateCompleteness({
    title: data.title,
    duration: data.duration,
    achievements: data.achievements,
    technologies: data.technologies,
    learnings: data.learnings,
    project: data.project,
    reflections: data.reflections,
  });
  frontmatter.completeness = {
    score: completeness.score,
    suggestions: completeness.suggestions,
  };

  // Build body
  const contentBody = originalContent.replace(/^---[\s\S]*?---\s*/, '').replace(/^#.*\n\n?/, '').trim();
  let body = `\n# Detailed Context\n\n${contentBody}`;

  if (data.achievements?.length) {
    body += '\n\n## Achievements\n\n';
    data.achievements.forEach((a) => (body += `- ${a}\n`));
  }

  if (data.learnings) {
    body += `\n## Key Learnings\n\n${data.learnings}\n`;
  }

  const archiveContent = stringifyMarkdown(body + '\n', frontmatter);

  await manager.addArchivedVersion(experienceName, archiveContent);

  console.log(`✓ Created archived version: experiences/${experienceName}/archived.md`);
  console.log('');
  console.log('  Preserved versions:');
  console.log('    • draft.md (original)');
  console.log('    • refined.md (with Q&A)');
  console.log('');
  console.log('  Extracted fields:');
  console.log(`    Title: ${data.title}`);
  if (data.duration) console.log(`    Duration: ${data.duration.start} to ${data.duration.end}`);
  if (data.project) console.log(`    Project: ${data.project}`);
  if (data.technologies?.length) console.log(`    Technologies: ${data.technologies.length} items`);
  if (data.achievements?.length) console.log(`    Achievements: ${data.achievements.length} items`);
  if (data.learnings) console.log('    Learnings: Documented');
  if (data.reflections) console.log('    Reflections: Documented');
  console.log('');
  console.log(`  Completeness: ${completeness.score}%`);
  if (completeness.suggestions.length > 0) {
    console.log('  Suggestions:');
    completeness.suggestions.slice(0, 3).forEach((s) => console.log(`    • ${s}`));
  }
}

function printArchiveSuccess(experienceName: string, data: StructuredArchiveContent): void {
  console.log(`✓ Created archived version: experiences/${experienceName}/archived.md`);
  console.log('');
  console.log('  Preserved versions:');
  console.log('    • draft.md (original)');
  console.log('    • refined.md (with Q&A)');
  console.log('');
  console.log('  Structured fields:');
  console.log(`    Title: ${data.title}`);
  if (data.duration) console.log(`    Duration: ${data.duration.interpretation}`);
  if (data.project) console.log(`    Project: ${data.project}`);
  if (data.technologies.length > 0) console.log(`    Technologies: ${data.technologies.map(t => t.normalized).join(', ')}`);
  if (data.achievements.length > 0) console.log(`    Achievements: ${data.achievements.length} items`);
  if (data.learnings) console.log('    Learnings: Documented');
  if (data.reflections) console.log('    Reflections: Documented');
  console.log('');
  console.log(`  Completeness: ${data.completeness.score}%`);
  if (data.completeness.suggestions.length > 0) {
    console.log('  Suggestions:');
    data.completeness.suggestions.slice(0, 3).forEach((s) => console.log(`    • ${s}`));
  }
}
