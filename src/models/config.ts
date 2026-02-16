import path from 'node:path';

export interface ResumateConfig {
  rootDir: string;
  resumateDir: string;
  experiencesDir: string;
  claudeCommandsDir: string;
  legacy?: {
    draftsDir: string;
    inProgressDir: string;
    archiveDir: string;
  };
}

export function createConfig(rootDir: string): ResumateConfig {
  const resumateDir = path.join(rootDir, '.resumate');
  return {
    rootDir,
    resumateDir,
    experiencesDir: path.join(rootDir, 'experiences'),
    claudeCommandsDir: path.join(rootDir, '.claude', 'commands'),
  };
}

export const RESUMATE_DIR_NAME = '.resumate';

export interface LegacyResumateConfig {
  rootDir: string;
  resumateDir: string;
  draftsDir: string;
  inProgressDir: string;
  archiveDir: string;
  claudeCommandsDir: string;
}

export function createLegacyConfig(rootDir: string): LegacyResumateConfig {
  return {
    rootDir,
    resumateDir: path.join(rootDir, '.resumate'),
    draftsDir: path.join(rootDir, 'drafts'),
    inProgressDir: path.join(rootDir, 'in-progress'),
    archiveDir: path.join(rootDir, 'archive'),
    claudeCommandsDir: path.join(rootDir, '.claude', 'commands'),
  };
}
