import path from 'node:path';
import { createConfig } from '../../models/config.js';
import { validateResumateInitialized } from '../utils/validation.js';
import { writeFile, directoryExists } from '../../services/file-manager.js';
import { extractTitle } from '../../services/markdown-processor.js';
import { generateUniqueFilename } from '../../services/slug-generator.js';

export async function draftCommand(content: string): Promise<void> {
  const rootDir = process.cwd();
  const config = createConfig(rootDir);

  if (!(await validateResumateInitialized(rootDir))) {
    console.error('Error: Resumate not initialized.');
    console.error('Run `resumate init <projectname>` first.');
    process.exit(1);
  }

  if (!(await directoryExists(config.draftsDir))) {
    console.error('Error: .resumate/drafts/ directory not found.');
    console.error('Run `resumate init <projectname>` to fix directory structure.');
    process.exit(1);
  }

  if (!content || content.trim().length === 0) {
    console.error('Error: Please provide content for your experience.');
    console.error('Usage: resumate draft "Your experience text here"');
    process.exit(1);
  }

  try {
    const title = extractTitle(content);
    const filename = await generateUniqueFilename(title, config.draftsDir);
    const filepath = path.join(config.draftsDir, filename);

    const hasTitle = content.trim().startsWith('#');
    const fileContent = hasTitle ? content.trim() : `# ${title}\n\n${content.trim()}`;

    await writeFile(filepath, fileContent + '\n');

    console.log('Draft created successfully!');
    console.log('');
    console.log(`  File: .resumate/drafts/${filename}`);
    console.log('');
    console.log('Next step: Refine this draft with AI');
    console.log(`  /resumate refine @${filename.replace('.md', '')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error creating draft: ${message}`);
    process.exit(1);
  }
}
