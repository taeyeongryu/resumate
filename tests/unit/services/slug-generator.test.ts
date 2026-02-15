import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import {
  generateSlug,
  generateDatePrefix,
  generateUniqueFilename,
  extractDateFromFilename,
} from '../../../src/services/slug-generator.js';

describe('generateSlug', () => {
  it('should convert to lowercase', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('should remove special characters in strict mode', () => {
    expect(generateSlug('Hello & World! @#$')).toBe('hello-and-world-dollar');
  });

  it('should trim whitespace', () => {
    expect(generateSlug('  spaced  ')).toBe('spaced');
  });
});

describe('generateDatePrefix', () => {
  it('should format a specific date as yyyy-MM-dd', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(generateDatePrefix(date)).toBe('2024-01-15');
  });

  it('should use current date when no argument', () => {
    const result = generateDatePrefix();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('generateUniqueFilename', () => {
  const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-slug-gen');

  beforeEach(async () => {
    await fs.ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.remove(TEST_DIR);
  });

  it('should generate date-slug.md filename', async () => {
    const date = new Date(2024, 5, 1);
    const filename = await generateUniqueFilename('My Project', TEST_DIR, date);
    expect(filename).toBe('2024-06-01-my-project.md');
  });

  it('should append counter on collision', async () => {
    const date = new Date(2024, 5, 1);
    await fs.writeFile(path.join(TEST_DIR, '2024-06-01-my-project.md'), '');
    const filename = await generateUniqueFilename('My Project', TEST_DIR, date);
    expect(filename).toBe('2024-06-01-my-project-1.md');
  });

  it('should increment counter for multiple collisions', async () => {
    const date = new Date(2024, 5, 1);
    await fs.writeFile(path.join(TEST_DIR, '2024-06-01-my-project.md'), '');
    await fs.writeFile(path.join(TEST_DIR, '2024-06-01-my-project-1.md'), '');
    const filename = await generateUniqueFilename('My Project', TEST_DIR, date);
    expect(filename).toBe('2024-06-01-my-project-2.md');
  });
});

describe('extractDateFromFilename', () => {
  it('should extract date from valid filename', () => {
    expect(extractDateFromFilename('2024-01-15-my-post.md')).toBe('2024-01-15');
  });

  it('should return null for invalid filename', () => {
    expect(extractDateFromFilename('no-date-here.md')).toBeNull();
  });
});
