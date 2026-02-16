import { createConfig } from '../../models/config.js';
import { validateResumateInitialized } from '../utils/validation.js';
import { ExperienceManager } from '../../services/experience-manager.js';
import { ExperienceLocator } from '../../services/experience-locator.js';
import { readFile, writeFile } from '../../services/file-manager.js';
import { extractQASection, parseQAPairs } from '../../services/markdown-processor.js';
import { questionTemplates, isCompletionSignal } from '../../templates/ai-prompts.js';
import { getNextUnansweredQuestion, buildInitialQASection, formatQASection } from '../utils/prompts.js';
import path from 'node:path';

export async function refineCommand(query: string): Promise<void> {
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

    console.log(`Found experience: ${experience.name}`);

    // Read draft content and work with Q&A refinement
    const draftPath = path.join(experience.path, 'draft.md');
    const content = await readFile(draftPath);
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
      console.log(`After adding your answer, run: resumate refine ${experience.name}`);
    } else {
      // Continue refinement
      const qaPairs = parseQAPairs(qaResult.qaSection);

      // Check for completion
      const lastPair = qaPairs[qaPairs.length - 1];
      if (lastPair?.answer && isCompletionSignal(lastPair.answer)) {
        await createRefinedVersion(manager, experience.name, content);
        return;
      }

      const nextQuestion = getNextUnansweredQuestion(qaPairs);

      if (!nextQuestion) {
        // All questions answered - create refined version
        await createRefinedVersion(manager, experience.name, content);
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
      console.log(`After adding your answer, run: resumate refine ${experience.name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Error: ${message}`);
    process.exit(1);
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
