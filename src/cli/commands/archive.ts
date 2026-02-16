import { createConfig } from '../../models/config.js';
import { validateResumateInitialized, parseDurationFromText, parseList, generateTags } from '../utils/validation.js';
import { ExperienceManager } from '../../services/experience-manager.js';
import { ExperienceLocator } from '../../services/experience-locator.js';
import { extractTitle, extractQASection, parseQAPairs, stringifyMarkdown } from '../../services/markdown-processor.js';
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

export async function archiveCommand(query: string): Promise<void> {
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

    console.log(`Found experience: ${experience.name}`);
    console.log('');
    console.log('Generating structured archive from refined version...');

    // Read refined content
    const refinedContent = await manager.getVersion(experience.name, 'refined');
    const qaResult = extractQASection(refinedContent);

    if (!qaResult) {
      console.error('✗ Error: No refinement questions found in refined version.');
      process.exit(1);
    }

    const qaPairs = parseQAPairs(qaResult.qaSection);
    const dateStr = experience.date.toISOString().split('T')[0];
    const data = extractData(qaResult.originalContent, qaPairs, dateStr);

    // Validate required fields
    const missing: string[] = [];
    if (!data.title) missing.push('Title');
    if (!data.date) missing.push('Date');
    if (!data.duration) missing.push('Duration (start and end dates)');
    if (!qaResult.originalContent.trim()) missing.push('Content');

    if (missing.length > 0) {
      console.error('✗ Error: Cannot archive - missing required fields:');
      missing.forEach((f) => console.error(`  - ${f}`));
      console.error(`\nPlease refine the experience further to complete these fields.`);
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

    await manager.addArchivedVersion(experience.name, archiveContent);

    console.log(`✓ Created archived version: experiences/${experience.name}/archived.md`);
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
    console.log('  Structure: YAML with experience metadata, achievements, and impact');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Error: ${message}`);
    process.exit(1);
  }
}
