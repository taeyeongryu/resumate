import { createConfig } from '../../models/config.js';
import { validateResumateInitialized } from '../utils/validation.js';
import { ExperienceManager } from '../../services/experience-manager.js';
import { ExperienceLocator } from '../../services/experience-locator.js';
import { readFile, writeFile } from '../../services/file-manager.js';
import { extractQASection, parseQAPairs, parseMarkdown } from '../../services/markdown-processor.js';
import { questionTemplates, isCompletionSignal, buildPromptOutput } from '../../templates/ai-prompts.js';
import { getNextUnansweredQuestion, buildInitialQASection, formatQASection, buildBatchQASection, validateDynamicQuestions } from '../utils/prompts.js';
import { analyzeDraft } from '../../services/draft-analyzer.js';
import path from 'node:path';

export interface RefineOptions {
  prompt?: boolean;
  questions?: string;
  deep?: boolean;
  complete?: boolean;
}

export async function refineCommand(query: string, options?: RefineOptions): Promise<void> {
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

    // Check if draft exists
    if (!experience.versions.draft) {
      console.error(`✗ Error: No draft found for experience: ${experience.name}`);
      console.error('');
      console.error(`  Expected: experiences/${experience.name}/draft.md`);
      process.exit(1);
    }

    // Check if already refined
    if (experience.versions.refined) {
      console.error(`✗ Error: Experience already has refined version: ${experience.name}`);
      console.error('');
      console.error(`  Location: experiences/${experience.name}/refined.md`);
      console.error('');
      console.error('  Options:');
      console.error('    • Edit refined.md directly in your editor');
      console.error("    • Delete refined.md and run 'resumate refine' again to recreate");
      process.exit(1);
    }

    const draftPath = path.join(experience.path, 'draft.md');
    const content = await readFile(draftPath);

    // Handle --complete flag: create refined.md from draft content
    if (options?.complete) {
      await handleCompleteMode(content, experience.name, manager);
      return;
    }

    // Handle --prompt flag: analyze and output JSON
    if (options?.prompt) {
      await handlePromptMode(content, experience.name, options.deep);
      return;
    }

    // Handle --questions flag: accept AI-generated questions and write to file
    if (options?.questions) {
      await handleQuestionsMode(content, draftPath, options.questions);
      return;
    }

    // Default: existing hardcoded question flow (unchanged)
    await handleHardcodedFlow(content, draftPath, experience.name, manager);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Error: ${message}`);
    process.exit(1);
  }
}

async function handlePromptMode(content: string, experienceDir: string, deep?: boolean): Promise<void> {
  const parsed = parseMarkdown(content);
  const analysis = analyzeDraft(parsed.content, parsed.data);

  // If --deep is set, force question generation even when sufficient
  if (deep) {
    analysis.isSufficient = false;
    if (analysis.missingFields.length === 0) {
      // Add all fields as "missing" for deep enrichment
      analysis.missingFields = ['duration', 'achievements', 'learnings', 'project', 'technologies', 'reflections'];
    }
  }

  const output = buildPromptOutput(analysis, experienceDir);
  process.stdout.write(JSON.stringify(output));
}

async function handleCompleteMode(content: string, experienceName: string, manager: ExperienceManager): Promise<void> {
  await createRefinedVersion(manager, experienceName, content);
}

async function handleQuestionsMode(content: string, draftPath: string, questionsJson: string): Promise<void> {
  // Check if Q&A section already exists
  const qaResult = extractQASection(content);
  if (qaResult) {
    throw new Error('Q&A section already exists in draft.md. Use the standard refine flow to continue.');
  }

  const questions = validateDynamicQuestions(questionsJson);
  const qaSection = buildBatchQASection(questions);
  await writeFile(draftPath, content.trimEnd() + '\n' + qaSection + '\n');

  console.log('');
  console.log(`✓ Added ${questions.length} questions to draft.md`);
  console.log('');
  console.log('  Please answer each question in the file, then run:');
  console.log(`    resumate refine <query>`);
}

async function handleHardcodedFlow(
  content: string,
  draftPath: string,
  experienceName: string,
  manager: ExperienceManager,
): Promise<void> {
  console.log(`Found experience: ${experienceName}`);

  const qaResult = extractQASection(content);

  if (!qaResult) {
    // First refinement - add Q&A section to draft
    const firstQuestion = questionTemplates[0];
    const qaSection = buildInitialQASection(firstQuestion);
    await writeFile(draftPath, content.trimEnd() + '\n' + qaSection + '\n');

    console.log('');
    console.log("Let's refine this experience through a few questions.");
    console.log('');
    console.log(`Q: ${firstQuestion.korean}`);
    console.log(`   (${firstQuestion.english})`);
    console.log('');
    console.log(`After adding your answer, run: resumate refine ${experienceName}`);
  } else {
    // Continue refinement
    const qaPairs = parseQAPairs(qaResult.qaSection);

    // Check for completion
    const lastPair = qaPairs[qaPairs.length - 1];
    if (lastPair?.answer && isCompletionSignal(lastPair.answer)) {
      await createRefinedVersion(manager, experienceName, content);
      return;
    }

    const nextQuestion = getNextUnansweredQuestion(qaPairs);

    if (!nextQuestion) {
      // All questions answered - create refined version
      await createRefinedVersion(manager, experienceName, content);
      return;
    }

    // Append next question
    const updatedQA = formatQASection(qaPairs, nextQuestion);
    const newContent = qaResult.originalContent + '\n\n---\n\n' + updatedQA + '\n';
    await writeFile(draftPath, newContent);

    console.log('');
    console.log('Continuing refinement...');
    console.log('');
    console.log(`Q: ${nextQuestion.korean}`);
    console.log(`   (${nextQuestion.english})`);
    console.log('');
    console.log(`After adding your answer, run: resumate refine ${experienceName}`);
  }
}

async function createRefinedVersion(
  manager: ExperienceManager,
  dirName: string,
  fullContent: string,
): Promise<void> {
  await manager.addRefinedVersion(dirName, fullContent);

  console.log('');
  console.log(`✓ Created refined version: experiences/${dirName}/refined.md`);
  console.log('');
  console.log(`  Preserved draft: experiences/${dirName}/draft.md`);
  console.log('');
  console.log('  Next steps:');
  console.log('    • Review the refined version');
  console.log(`    • Run 'resumate archive ${dirName}' to create final structured version`);
}
