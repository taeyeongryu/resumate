import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { createConfig } from '../../../src/models/config.js';
import { ExperienceManager } from '../../../src/services/experience-manager.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-refine-integration');

let manager: ExperienceManager;

beforeEach(async () => {
  await fs.remove(TEST_DIR);
  const config = createConfig(TEST_DIR);
  await fs.ensureDir(config.experiencesDir);
  await fs.ensureDir(config.resumateDir);
  manager = new ExperienceManager(config);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('refine command integration', () => {
  it('should create refined.md while preserving draft.md', async () => {
    const experience = await manager.createExperience(
      new Date('2024-06-15'),
      'react-optimization',
      {
        title: 'React Performance Optimization',
        company: 'TechCorp',
        role: 'Senior Engineer',
        description: 'Led team initiative.',
      }
    );

    const refinedContent = [
      '---',
      'title: React Performance Optimization',
      'company: TechCorp',
      'achievements:',
      '  - Reduced bundle size by 40%',
      '---',
      '',
      'Refined content with Q&A enhancements.',
    ].join('\n');

    await manager.addRefinedVersion('2024-06-15-react-optimization', refinedContent);

    // Verify both files exist
    const draftExists = await fs.pathExists(path.join(experience.path, 'draft.md'));
    const refinedExists = await fs.pathExists(path.join(experience.path, 'refined.md'));
    expect(draftExists).toBe(true);
    expect(refinedExists).toBe(true);

    // Verify draft is unchanged
    const draftContent = await fs.readFile(path.join(experience.path, 'draft.md'), 'utf-8');
    expect(draftContent).toContain('React Performance Optimization');

    // Verify refined content
    const refined = await fs.readFile(path.join(experience.path, 'refined.md'), 'utf-8');
    expect(refined).toContain('Reduced bundle size by 40%');
  });

  it('should reject refinement of non-existent experience', async () => {
    await expect(
      manager.addRefinedVersion('2024-06-15-nonexistent', 'content')
    ).rejects.toThrow(/not found/i);
  });

  it('should reject duplicate refinement', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', {
      title: 'Test', company: 'Corp', role: 'Dev',
    });
    await manager.addRefinedVersion('2024-06-15-test', 'refined');
    await expect(
      manager.addRefinedVersion('2024-06-15-test', 'refined again')
    ).rejects.toThrow(/already has.*refined/i);
  });
});
