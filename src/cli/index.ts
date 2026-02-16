#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand, updateCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { refineCommand } from './commands/refine.js';
import { archiveCommand } from './commands/archive.js';
import { migrateCommand } from './commands/migrate.js';

const program = new Command();

program
  .name('resumate')
  .description('AI-powered experience structuring tool for resume building')
  .version('1.0.0');

program
  .command('init')
  .argument('<projectname>', 'Project name for .resumate directory')
  .description('Initialize Resumate project structure')
  .action(initCommand);

program
  .command('update')
  .description('Update Claude Code skill definitions to latest version')
  .action(updateCommand);

program
  .command('add')
  .description('Create a new experience entry with draft.md')
  .option('-t, --title <title>', 'Experience title')
  .option('-c, --company <company>', 'Company name')
  .option('-r, --role <role>', 'Job role')
  .option('-d, --date <date>', 'Experience date (YYYY-MM-DD, default: today)')
  .option('--slug <slug>', 'Custom slug (default: auto-generated from title)')
  .action(addCommand);

program
  .command('refine')
  .argument('<query>', 'Experience to refine (directory name or search query)')
  .option('--prompt', 'Output draft analysis and AI prompt as JSON (for Claude Code integration)')
  .option('--questions <json>', 'Accept AI-generated questions as JSON and write to draft')
  .option('--deep', 'Force deeper follow-up questions even when draft is sufficient')
  .option('--complete', 'Create refined.md from draft content (marks refinement as complete)')
  .description('Refine an experience through AI-guided Q&A')
  .action(refineCommand);

program
  .command('archive')
  .argument('<query>', 'Experience to archive (directory name or search query)')
  .option('--prompt', 'Output archive analysis and AI structuring prompt as JSON (for Claude Code integration)')
  .option('--content <json>', 'Accept AI-structured content as JSON and write archived.md')
  .description('Convert refined experience to final structured format')
  .action(archiveCommand);

program
  .command('migrate')
  .description('Convert old workflow-based structure to new experience-based structure')
  .option('--dry-run', 'Preview migration without making changes')
  .option('--cleanup', 'Remove old directories after successful migration')
  .option('--resume <id>', 'Resume interrupted migration')
  .option('--rollback <id>', 'Rollback partial migration')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(migrateCommand);

program.parse();
