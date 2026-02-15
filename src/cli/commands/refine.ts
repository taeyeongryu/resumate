import { createConfig } from '../../models/config.js';
import { validateResumateInitialized, normalizeFilename } from '../utils/validation.js';
import { readFile, writeFile, listFiles } from '../../services/file-manager.js';
import { extractQASection, parseQAPairs } from '../../services/markdown-processor.js';
import { locateFile, moveToInProgress } from '../../services/workflow-manager.js';
import { questionTemplates, isCompletionSignal } from '../../templates/ai-prompts.js';
import { getNextUnansweredQuestion, buildInitialQASection, formatQASection } from '../utils/prompts.js';

export async function refineCommand(filenameArg: string): Promise<void> {
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
    const drafts = await listFiles(config.draftsDir, '.md');
    const inProgress = await listFiles(config.inProgressDir, '.md');
    console.error('Error: File not found.');
    if (drafts.length > 0) console.error(`  Available in drafts/: ${drafts.join(', ')}`);
    if (inProgress.length > 0) console.error(`  Available in in-progress/: ${inProgress.join(', ')}`);
    process.exit(1);
  }

  if (location === 'archive') {
    console.error(`This experience is already archived.`);
    console.error(`  Location: .resumate/archive/${filename}`);
    process.exit(1);
  }

  try {
    let currentPath = filepath;

    // Move from drafts to in-progress if needed
    if (location === 'drafts') {
      currentPath = await moveToInProgress(filepath, filename, config);
      console.log(`Moved ${filename} from drafts/ to in-progress/`);
    }

    const content = await readFile(currentPath);
    const qaResult = extractQASection(content);

    if (!qaResult) {
      // First refinement - add Q&A section
      const firstQuestion = questionTemplates[0];
      const qaSection = buildInitialQASection(firstQuestion);
      await writeFile(currentPath, content.trimEnd() + '\n' + qaSection + '\n');

      console.log('');
      console.log("Let's refine this experience through a few questions.");
      console.log('You can answer by editing the file directly or typing here.');
      console.log('');
      console.log(`Q: ${firstQuestion.korean}`);
      console.log(`   (${firstQuestion.english})`);
      console.log('');
      console.log(`After adding your answer, run: /resumate refine @${filename.replace('.md', '')}`);
    } else {
      // Continue refinement - parse existing Q&A
      const qaPairs = parseQAPairs(qaResult.qaSection);

      // Check for completion signal in last answer
      const lastPair = qaPairs[qaPairs.length - 1];
      if (lastPair?.answer && isCompletionSignal(lastPair.answer)) {
        console.log('');
        console.log('Refinement complete!');
        console.log('');
        const answeredCount = qaPairs.filter((p) => p.answer).length;
        console.log(`Your experience has been refined with ${answeredCount} answered questions.`);
        console.log('');
        console.log('Ready to archive? Run:');
        console.log(`  /resumate archive ${filename.replace('.md', '')}`);
        return;
      }

      const nextQuestion = getNextUnansweredQuestion(qaPairs);

      if (!nextQuestion) {
        // All questions answered
        console.log('');
        console.log('All refinement questions have been answered!');
        console.log('');
        console.log('Ready to archive? Run:');
        console.log(`  /resumate archive ${filename.replace('.md', '')}`);
        return;
      }

      // Append next question to file
      const updatedQA = formatQASection(qaPairs, nextQuestion);
      const newContent = qaResult.originalContent + '\n\n---\n\n' + updatedQA + '\n';
      await writeFile(currentPath, newContent);

      console.log('');
      console.log('Continuing refinement...');
      console.log('');
      console.log(`Q: ${nextQuestion.korean}`);
      console.log(`   (${nextQuestion.english})`);
      console.log('');
      console.log(`After adding your answer, run: /resumate refine @${filename.replace('.md', '')}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error during refinement: ${message}`);
    process.exit(1);
  }
}
