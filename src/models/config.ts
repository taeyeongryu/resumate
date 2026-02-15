import path from 'node:path';

export interface ResumateConfig {
  rootDir: string;
  resumateDir: string;
  draftsDir: string;
  inProgressDir: string;
  archiveDir: string;
  claudeCommandsDir: string;
}

export function createConfig(rootDir: string): ResumateConfig {
  const resumateDir = path.join(rootDir, '.resumate');
  return {
    rootDir,
    resumateDir,
    draftsDir: path.join(rootDir, 'drafts'),
    inProgressDir: path.join(rootDir, 'in-progress'),
    archiveDir: path.join(rootDir, 'archive'),
    claudeCommandsDir: path.join(rootDir, '.claude', 'commands'),
  };
}

export const RESUMATE_DIR_NAME = '.resumate';
