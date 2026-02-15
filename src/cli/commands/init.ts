import path from 'node:path';
import { createConfig } from '../../models/config.js';
import { ensureDirectory, directoryExists, writeFile, readFile } from '../../services/file-manager.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILL_TEMPLATES = [
  'resumate.draft.md.template',
  'resumate.refine.md.template',
  'resumate.archive.md.template',
];

function getTemplatesDir(): string {
  // In dist: dist/cli/commands/init.js -> we need dist/templates/skills/
  return path.resolve(__dirname, '..', '..', 'templates', 'skills');
}

export async function updateCommand(): Promise<void> {
  const rootDir = process.cwd();
  const config = createConfig(rootDir);

  if (!(await directoryExists(config.resumateDir))) {
    console.error('Error: Resumate not initialized in this directory.');
    console.error('Run `resumate init <projectname>` first.');
    process.exit(1);
  }

  try {
    await installSkills(config.claudeCommandsDir);
    console.log('Updated Claude Code skill definitions in .claude/commands/');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error updating skills: ${message}`);
    process.exit(1);
  }
}

export async function initCommand(projectname: string): Promise<void> {
  const rootDir = path.resolve(process.cwd(), projectname);
  const config = createConfig(rootDir);

  if (await directoryExists(config.resumateDir)) {
    console.error(`Error: .resumate/ already exists in ${rootDir}`);
    console.error('Resumate is already initialized in this directory.');
    process.exit(1);
  }

  try {
    // Create .resumate/ for metadata
    await ensureDirectory(config.resumateDir);

    // Create root-level data directories
    await ensureDirectory(config.draftsDir);
    await ensureDirectory(config.inProgressDir);
    await ensureDirectory(config.archiveDir);
    console.log(`Created directory structure in ${projectname}/`);

    // Install Claude Code skills
    await installSkills(config.claudeCommandsDir);
    console.log('Installed Claude Code skill definitions in .claude/commands/');

    console.log('');
    console.log(`Resumate initialized successfully in ${projectname}/`);
    console.log('');
    console.log('Directory structure:');
    console.log(`  ${projectname}/`);
    console.log('  ├── .resumate/         # metadata');
    console.log('  ├── drafts/            # experience drafts');
    console.log('  ├── in-progress/       # refinement in progress');
    console.log('  └── archive/           # structured archive');
    console.log('');
    console.log('Next steps:');
    console.log(`  1. cd ${projectname}`);
    console.log('  2. Open Claude Code: claude');
    console.log('  3. Add a new experience: resumate add');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error initializing Resumate: ${message}`);
    process.exit(1);
  }
}

async function installSkills(commandsDir: string): Promise<void> {
  await ensureDirectory(commandsDir);
  const templatesDir = getTemplatesDir();

  for (const templateFile of SKILL_TEMPLATES) {
    const templatePath = path.join(templatesDir, templateFile);
    const skillName = templateFile.replace('.template', '');
    const destPath = path.join(commandsDir, skillName);

    const content = await readFile(templatePath);
    await writeFile(destPath, content);
  }
}
