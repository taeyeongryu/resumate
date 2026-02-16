import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import {
  readFile,
  writeFile,
  moveFile,
  removeFile,
  fileExists,
  directoryExists,
  listFiles,
  ensureDirectory,
  validateExperienceDirName,
  parseExperienceDirName,
  listDirectories,
} from '../../../src/services/file-manager.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-file-manager');

beforeEach(async () => {
  await fs.ensureDir(TEST_DIR);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('readFile / writeFile', () => {
  it('should round-trip file content', async () => {
    const filepath = path.join(TEST_DIR, 'hello.txt');
    await writeFile(filepath, 'Hello, world!');
    const content = await readFile(filepath);
    expect(content).toBe('Hello, world!');
  });

  it('should create parent directories automatically', async () => {
    const filepath = path.join(TEST_DIR, 'nested', 'deep', 'file.txt');
    await writeFile(filepath, 'nested content');
    const content = await readFile(filepath);
    expect(content).toBe('nested content');
  });
});

describe('moveFile', () => {
  it('should move a file between directories', async () => {
    const src = path.join(TEST_DIR, 'src.txt');
    const dest = path.join(TEST_DIR, 'subdir', 'dest.txt');
    await writeFile(src, 'move me');

    await moveFile(src, dest);

    expect(await fileExists(src)).toBe(false);
    expect(await readFile(dest)).toBe('move me');
  });
});

describe('removeFile', () => {
  it('should remove an existing file', async () => {
    const filepath = path.join(TEST_DIR, 'removable.txt');
    await writeFile(filepath, 'bye');
    expect(await fileExists(filepath)).toBe(true);

    await removeFile(filepath);
    expect(await fileExists(filepath)).toBe(false);
  });
});

describe('fileExists', () => {
  it('should return true for existing file', async () => {
    const filepath = path.join(TEST_DIR, 'exists.txt');
    await writeFile(filepath, '');
    expect(await fileExists(filepath)).toBe(true);
  });

  it('should return false for non-existing file', async () => {
    expect(await fileExists(path.join(TEST_DIR, 'nope.txt'))).toBe(false);
  });
});

describe('directoryExists', () => {
  it('should return true for existing directory', async () => {
    expect(await directoryExists(TEST_DIR)).toBe(true);
  });

  it('should return false for non-existing directory', async () => {
    expect(await directoryExists(path.join(TEST_DIR, 'nope'))).toBe(false);
  });

  it('should return false for a file path', async () => {
    const filepath = path.join(TEST_DIR, 'file.txt');
    await writeFile(filepath, '');
    expect(await directoryExists(filepath)).toBe(false);
  });
});

describe('listFiles', () => {
  it('should list all files in a directory', async () => {
    await writeFile(path.join(TEST_DIR, 'a.txt'), '');
    await writeFile(path.join(TEST_DIR, 'b.md'), '');
    const files = await listFiles(TEST_DIR);
    expect(files.sort()).toEqual(['a.txt', 'b.md']);
  });

  it('should filter by extension', async () => {
    await writeFile(path.join(TEST_DIR, 'a.txt'), '');
    await writeFile(path.join(TEST_DIR, 'b.md'), '');
    const files = await listFiles(TEST_DIR, '.md');
    expect(files).toEqual(['b.md']);
  });

  it('should return empty array for non-existing directory', async () => {
    const files = await listFiles(path.join(TEST_DIR, 'nope'));
    expect(files).toEqual([]);
  });
});

describe('ensureDirectory', () => {
  it('should create nested directories', async () => {
    const nested = path.join(TEST_DIR, 'a', 'b', 'c');
    await ensureDirectory(nested);
    expect(await directoryExists(nested)).toBe(true);
  });
});

describe('validateExperienceDirName', () => {
  it('should accept valid directory names', () => {
    expect(validateExperienceDirName('2024-06-15-react-optimization').valid).toBe(true);
    expect(validateExperienceDirName('2024-01-01-my-project').valid).toBe(true);
    expect(validateExperienceDirName('2025-12-31-a').valid).toBe(true);
  });

  it('should reject names without date prefix', () => {
    const result = validateExperienceDirName('react-optimization');
    expect(result.valid).toBe(false);
  });

  it('should reject names with invalid dates', () => {
    const result = validateExperienceDirName('2024-13-45-test');
    expect(result.valid).toBe(false);
  });

  it('should reject names with uppercase', () => {
    const result = validateExperienceDirName('2024-06-15-React');
    expect(result.valid).toBe(false);
  });

  it('should reject names with special characters', () => {
    const result = validateExperienceDirName('2024-06-15-react_opt');
    expect(result.valid).toBe(false);
  });

  it('should reject names longer than 100 characters', () => {
    const longSlug = 'a'.repeat(90);
    const result = validateExperienceDirName(`2024-06-15-${longSlug}`);
    expect(result.valid).toBe(false);
  });

  it('should reject Windows reserved names as slug', () => {
    const result = validateExperienceDirName('2024-06-15-con');
    expect(result.valid).toBe(false);
  });

  it('should reject slugs starting or ending with hyphen', () => {
    expect(validateExperienceDirName('2024-06-15--test').valid).toBe(false);
    expect(validateExperienceDirName('2024-06-15-test-').valid).toBe(false);
  });
});

describe('parseExperienceDirName', () => {
  it('should parse valid directory names', () => {
    const result = parseExperienceDirName('2024-06-15-react-optimization');
    expect(result).toEqual({ date: '2024-06-15', slug: 'react-optimization' });
  });

  it('should parse single-word slugs', () => {
    const result = parseExperienceDirName('2025-01-01-test');
    expect(result).toEqual({ date: '2025-01-01', slug: 'test' });
  });

  it('should return null for invalid names', () => {
    expect(parseExperienceDirName('not-a-valid-name')).toBeNull();
    expect(parseExperienceDirName('2024-13-45-test')).toBeNull();
  });
});

describe('listDirectories', () => {
  it('should list only directories', async () => {
    await ensureDirectory(path.join(TEST_DIR, 'dir1'));
    await ensureDirectory(path.join(TEST_DIR, 'dir2'));
    await writeFile(path.join(TEST_DIR, 'file.txt'), '');
    const dirs = await listDirectories(TEST_DIR);
    expect(dirs.sort()).toEqual(['dir1', 'dir2']);
  });

  it('should return empty array for non-existing directory', async () => {
    const dirs = await listDirectories(path.join(TEST_DIR, 'nope'));
    expect(dirs).toEqual([]);
  });
});
