#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { refineCommand } from './commands/refine.js';
import { archiveCommand } from './commands/archive.js';

const program = new Command();

program
  .name('resumate')
  .description('AI-powered experience structuring tool for resume building')
  .version('0.1.0');

program
  .command('init')
  .argument('<projectname>', 'Project name for .resumate directory')
  .description('Initialize Resumate project structure')
  .action(initCommand);

program
  .command('add')
  .description('Create a new empty experience draft with today\'s date')
  .action(addCommand);

program
  .command('refine')
  .argument('<filename>', 'Filename of draft to refine (with or without @)')
  .description('Refine a draft through AI-guided conversation')
  .action(refineCommand);

program
  .command('archive')
  .argument('<filename>', 'Filename of refined experience to archive')
  .description('Convert refined experience to final structured format')
  .action(archiveCommand);

program.parse();
