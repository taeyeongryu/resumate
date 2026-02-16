import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { createConfig } from '../../../src/models/config.js';
import { ExperienceManager } from '../../../src/services/experience-manager.js';
import { parseMarkdown } from '../../../src/services/markdown-processor.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-add-integration');

beforeEach(async () => {
  await fs.remove(TEST_DIR);
  const config = createConfig(TEST_DIR);
  await fs.ensureDir(config.experiencesDir);
  await fs.ensureDir(config.resumateDir);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('add command integration', () => {
  it('should create experience directory with draft.md', async () => {
    const config = createConfig(TEST_DIR);
    const manager = new ExperienceManager(config);

    const experience = await manager.createExperience(
      new Date('2024-06-15'),
      'react-optimization',
      {
        title: 'React Performance Optimization',
        company: 'TechCorp',
        role: 'Senior Engineer',
        description: 'Led team initiative to improve performance.',
      }
    );

    // Verify directory created
    expect(await fs.pathExists(experience.path)).toBe(true);

    // Verify draft.md exists with correct content
    const draftPath = path.join(experience.path, 'draft.md');
    expect(await fs.pathExists(draftPath)).toBe(true);

    const content = await fs.readFile(draftPath, 'utf-8');
    const parsed = parseMarkdown(content);
    expect(parsed.data.title).toBe('React Performance Optimization');
    expect(parsed.data.company).toBe('TechCorp');
    expect(parsed.data.role).toBe('Senior Engineer');
    expect(parsed.data.date).toBe('2024-06-15');
  });

  it('should prevent creating duplicate experience directories', async () => {
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

  it('should create experiences/ directory if it does not exist', async () => {
    const config = createConfig(TEST_DIR);
    await fs.remove(config.experiencesDir);
    const manager = new ExperienceManager(config);

    const experience = await manager.createExperience(new Date('2024-06-15'), 'test', {
      title: 'Test', company: 'Corp', role: 'Dev',
    });

    expect(await fs.pathExists(experience.path)).toBe(true);
  });
});
