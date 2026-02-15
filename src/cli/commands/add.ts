import path from 'node:path';
import { createConfig } from '../../models/config.js';
import { validateResumateInitialized } from '../utils/validation.js';
import { writeFile, directoryExists, fileExists } from '../../services/file-manager.js';
import { generateDatePrefix } from '../../services/slug-generator.js';

export async function addCommand(): Promise<void> {
  const rootDir = process.cwd();
  const config = createConfig(rootDir);

  if (!(await validateResumateInitialized(rootDir))) {
    console.error('Error: Resumate not initialized.');
    console.error('Run `resumate init <projectname>` first.');
    process.exit(1);
  }

  if (!(await directoryExists(config.draftsDir))) {
    console.error('Error: drafts/ directory not found.');
    console.error('Run `resumate init <projectname>` to fix directory structure.');
    process.exit(1);
  }

  try {
    const datePrefix = generateDatePrefix();
    const filename = await generateUniqueDateFilename(datePrefix, config.draftsDir);
    const filepath = path.join(config.draftsDir, filename);

    await writeFile(filepath, '');

    console.log('Draft created successfully!');
    console.log('');
    console.log(`  File: drafts/${filename}`);
    console.log('');
    console.log('Next steps:');
    console.log(`  1. Open drafts/${filename} and write your experience`);
    console.log(`  2. Refine with AI: resumate refine ${filename}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error creating draft: ${message}`);
    process.exit(1);
  }
}

export async function generateUniqueDateFilename(datePrefix: string, directory: string): Promise<string> {
  let filename = `${datePrefix}.md`;

  if (!(await fileExists(path.join(directory, filename)))) {
    return filename;
  }

  let counter = 1;
  while (await fileExists(path.join(directory, `${datePrefix}-${counter}.md`))) {
    counter++;
  }

  return `${datePrefix}-${counter}.md`;
}
