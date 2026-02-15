import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { locateFile, moveToInProgress, moveToArchive } from '../../../src/services/workflow-manager.js';
import { writeFile, readFile } from '../../../src/services/file-manager.js';
import type { ResumateConfig } from '../../../src/models/config.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-workflow');

function makeConfig(): ResumateConfig {
  return {
    rootDir: TEST_DIR,
    resumateDir: path.join(TEST_DIR, '.resumate'),
    draftsDir: path.join(TEST_DIR, '.resumate', 'drafts'),
    inProgressDir: path.join(TEST_DIR, '.resumate', 'in-progress'),
    archiveDir: path.join(TEST_DIR, '.resumate', 'archive'),
    claudeCommandsDir: path.join(TEST_DIR, '.claude', 'commands'),
  };
}

beforeEach(async () => {
  const config = makeConfig();
  await fs.ensureDir(config.draftsDir);
  await fs.ensureDir(config.inProgressDir);
  await fs.ensureDir(config.archiveDir);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('locateFile', () => {
  it('should find file in drafts', async () => {
    const config = makeConfig();
    await writeFile(path.join(config.draftsDir, 'test.md'), 'draft');
    const result = await locateFile('test.md', config);
    expect(result.location).toBe('drafts');
    expect(result.filepath).toBe(path.join(config.draftsDir, 'test.md'));
  });

  it('should find file in in-progress', async () => {
    const config = makeConfig();
    await writeFile(path.join(config.inProgressDir, 'test.md'), 'wip');
    const result = await locateFile('test.md', config);
    expect(result.location).toBe('in-progress');
  });

  it('should find file in archive', async () => {
    const config = makeConfig();
    await writeFile(path.join(config.archiveDir, 'test.md'), 'archived');
    const result = await locateFile('test.md', config);
    expect(result.location).toBe('archive');
  });

  it('should return not-found when file does not exist', async () => {
    const config = makeConfig();
    const result = await locateFile('missing.md', config);
    expect(result.location).toBe('not-found');
    expect(result.filepath).toBe('');
  });
});

describe('moveToInProgress', () => {
  it('should move file from drafts to in-progress', async () => {
    const config = makeConfig();
    const src = path.join(config.draftsDir, 'test.md');
    await writeFile(src, 'content');

    const dest = await moveToInProgress(src, 'test.md', config);
    expect(dest).toBe(path.join(config.inProgressDir, 'test.md'));
    expect(await readFile(dest)).toBe('content');
  });
});

describe('moveToArchive', () => {
  it('should move file from in-progress to archive', async () => {
    const config = makeConfig();
    const src = path.join(config.inProgressDir, 'test.md');
    await writeFile(src, 'content');

    const dest = await moveToArchive(src, 'test.md', config);
    expect(dest).toBe(path.join(config.archiveDir, 'test.md'));
    expect(await readFile(dest)).toBe('content');
  });
});
