import path from 'node:path';
import { moveFile, fileExists } from './file-manager.js';
import type { LegacyResumateConfig } from '../models/config.js';

export type LegacyWorkflowConfig = LegacyResumateConfig;

export type FileLocation = 'drafts' | 'in-progress' | 'archive' | 'not-found';

export async function locateFile(
  filename: string,
  config: LegacyWorkflowConfig,
): Promise<{ location: FileLocation; filepath: string }> {
  const draftsPath = path.join(config.draftsDir, filename);
  if (await fileExists(draftsPath)) {
    return { location: 'drafts', filepath: draftsPath };
  }

  const inProgressPath = path.join(config.inProgressDir, filename);
  if (await fileExists(inProgressPath)) {
    return { location: 'in-progress', filepath: inProgressPath };
  }

  const archivePath = path.join(config.archiveDir, filename);
  if (await fileExists(archivePath)) {
    return { location: 'archive', filepath: archivePath };
  }

  return { location: 'not-found', filepath: '' };
}

export async function moveToDrafts(filepath: string, filename: string, config: LegacyWorkflowConfig): Promise<string> {
  const dest = path.join(config.draftsDir, filename);
  await moveFile(filepath, dest);
  return dest;
}

export async function moveToInProgress(filepath: string, filename: string, config: LegacyWorkflowConfig): Promise<string> {
  const dest = path.join(config.inProgressDir, filename);
  await moveFile(filepath, dest);
  return dest;
}

export async function moveToArchive(filepath: string, filename: string, config: LegacyWorkflowConfig): Promise<string> {
  const dest = path.join(config.archiveDir, filename);
  await moveFile(filepath, dest);
  return dest;
}
