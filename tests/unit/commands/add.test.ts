import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { generateUniqueDateFilename } from '../../../src/cli/commands/add.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-add');

beforeEach(async () => {
  await fs.ensureDir(TEST_DIR);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('generateUniqueDateFilename', () => {
  it('should generate YYYY-MM-DD.md when no conflict', async () => {
    const result = await generateUniqueDateFilename('2026-02-15', TEST_DIR);
    expect(result).toBe('2026-02-15.md');
  });

  it('should append -1 when base filename exists', async () => {
    await fs.writeFile(path.join(TEST_DIR, '2026-02-15.md'), '');
    const result = await generateUniqueDateFilename('2026-02-15', TEST_DIR);
    expect(result).toBe('2026-02-15-1.md');
  });

  it('should append -2 when base and -1 both exist', async () => {
    await fs.writeFile(path.join(TEST_DIR, '2026-02-15.md'), '');
    await fs.writeFile(path.join(TEST_DIR, '2026-02-15-1.md'), '');
    const result = await generateUniqueDateFilename('2026-02-15', TEST_DIR);
    expect(result).toBe('2026-02-15-2.md');
  });

  it('should increment counter for multiple collisions', async () => {
    await fs.writeFile(path.join(TEST_DIR, '2026-02-15.md'), '');
    await fs.writeFile(path.join(TEST_DIR, '2026-02-15-1.md'), '');
    await fs.writeFile(path.join(TEST_DIR, '2026-02-15-2.md'), '');
    const result = await generateUniqueDateFilename('2026-02-15', TEST_DIR);
    expect(result).toBe('2026-02-15-3.md');
  });
});
