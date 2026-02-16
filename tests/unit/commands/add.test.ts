import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { createConfig } from '../../../src/models/config.js';
import { ExperienceManager } from '../../../src/services/experience-manager.js';
import { generateSlug, generateDatePrefix } from '../../../src/services/slug-generator.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-add');

beforeEach(async () => {
  await fs.ensureDir(TEST_DIR);
  const config = createConfig(TEST_DIR);
  await fs.ensureDir(config.experiencesDir);
  await fs.ensureDir(config.resumateDir);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('add command logic', () => {
  it('should create experience directory with slug from title', async () => {
    const config = createConfig(TEST_DIR);
    const manager = new ExperienceManager(config);
    const slug = generateSlug('React Performance Optimization');
    expect(slug).toBe('react-performance-optimization');

    const experience = await manager.createExperience(new Date('2024-06-15'), slug, {
      title: 'React Performance Optimization', company: 'Corp', role: 'Dev',
    });
    expect(experience.name).toBe('2024-06-15-react-performance-optimization');
  });

  it('should use today date when no date provided', () => {
    const datePrefix = generateDatePrefix();
    expect(datePrefix).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should reject duplicate experience directories', async () => {
    const config = createConfig(TEST_DIR);
    const manager = new ExperienceManager(config);
    await manager.createExperience(new Date('2024-06-15'), 'test', {
      title: 'Test', company: 'Corp', role: 'Dev',
    });
    await expect(
      manager.createExperience(new Date('2024-06-15'), 'test', {
        title: 'Test', company: 'Corp', role: 'Dev',
      })
    ).rejects.toThrow(/already exists/);
  });
});
