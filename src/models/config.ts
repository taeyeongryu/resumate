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
    draftsDir: path.join(resumateDir, 'drafts'),
    inProgressDir: path.join(resumateDir, 'in-progress'),
    archiveDir: path.join(resumateDir, 'archive'),
    claudeCommandsDir: path.join(rootDir, '.claude', 'commands'),
  };
}

export const RESUMATE_DIR_NAME = '.resumate';
export const SUBDIRECTORIES = ['drafts', 'in-progress', 'archive'] as const;
