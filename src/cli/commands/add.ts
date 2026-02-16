import { createConfig } from '../../models/config.js';
import { validateResumateInitialized } from '../utils/validation.js';
import { ExperienceManager } from '../../services/experience-manager.js';
import { generateDatePrefix, generateSlug } from '../../services/slug-generator.js';

export async function addCommand(options: {
  title?: string;
  company?: string;
  role?: string;
  date?: string;
  slug?: string;
}): Promise<void> {
  const rootDir = process.cwd();
  const config = createConfig(rootDir);

  if (!(await validateResumateInitialized(rootDir))) {
    console.error('✗ Error: Not a Resumate project');
    console.error('');
    console.error("  Run 'resumate init' first to initialize the project.");
    process.exit(1);
  }

  const title = options.title || 'Untitled Experience';
  const company = options.company || 'Unknown Company';
  const role = options.role || 'Unknown Role';

  const dateStr = options.date || generateDatePrefix();
  const slug = options.slug || generateSlug(title);

  try {
    const manager = new ExperienceManager(config);
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      console.error(`✗ Error: Invalid date format: ${dateStr}`);
      console.error('');
      console.error('  Expected format: YYYY-MM-DD (e.g., 2024-06-15)');
      process.exit(1);
    }

    const experience = await manager.createExperience(date, slug, {
      title,
      company,
      role,
    });

    console.log(`✓ Created experience: ${experience.name}`);
    console.log('');
    console.log(`  Location: experiences/${experience.name}/draft.md`);
    console.log('');
    console.log('  Next steps:');
    console.log('    • Edit the draft in your editor');
    console.log(`    • Run 'resumate refine ${dateStr}' when ready for Q&A`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Error: ${message}`);
    process.exit(1);
  }
}
