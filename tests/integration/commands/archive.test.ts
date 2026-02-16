import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { createConfig } from '../../../src/models/config.js';
import { ExperienceManager } from '../../../src/services/experience-manager.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-archive-integration');

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

describe('archive command integration', () => {
  it('should create archived.md while preserving all version files', async () => {
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

    await manager.addRefinedVersion('2024-06-15-react-optimization', 'Refined content');

    const archivedContent = [
      '---',
      'experience:',
      '  title: React Performance Optimization',
      '  company: TechCorp',
      '  achievements:',
      '    - description: Reduced bundle size by 40%',
      '---',
      '',
      'Archived structured content.',
    ].join('\n');

    await manager.addArchivedVersion('2024-06-15-react-optimization', archivedContent);

    // Verify all three files exist
    expect(await fs.pathExists(path.join(experience.path, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(experience.path, 'refined.md'))).toBe(true);
    expect(await fs.pathExists(path.join(experience.path, 'archived.md'))).toBe(true);

    // Verify archived content
    const archived = await fs.readFile(path.join(experience.path, 'archived.md'), 'utf-8');
    expect(archived).toContain('Reduced bundle size by 40%');
  });

  it('should reject archiving without refined version', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', {
      title: 'Test', company: 'Corp', role: 'Dev',
    });
    await expect(
      manager.addArchivedVersion('2024-06-15-test', 'archived')
    ).rejects.toThrow(/refined/i);
  });

  it('should reject duplicate archiving', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', {
      title: 'Test', company: 'Corp', role: 'Dev',
    });
    await manager.addRefinedVersion('2024-06-15-test', 'refined');
    await manager.addArchivedVersion('2024-06-15-test', 'archived');
    await expect(
      manager.addArchivedVersion('2024-06-15-test', 'archived again')
    ).rejects.toThrow(/already has.*archived/i);
  });

  it('should complete full lifecycle: draft → refined → archived', async () => {
    const dirName = '2024-06-15-full-lifecycle';
    await manager.createExperience(new Date('2024-06-15'), 'full-lifecycle', {
      title: 'Full Lifecycle Test',
      company: 'TestCo',
      role: 'Engineer',
    });

    // Verify draft only
    let versions = await manager.getAvailableVersions(dirName);
    expect(versions).toEqual({ draft: true, refined: false, archived: false });

    // Add refined
    await manager.addRefinedVersion(dirName, 'refined content');
    versions = await manager.getAvailableVersions(dirName);
    expect(versions).toEqual({ draft: true, refined: true, archived: false });

    // Add archived
    await manager.addArchivedVersion(dirName, 'archived content');
    versions = await manager.getAvailableVersions(dirName);
    expect(versions).toEqual({ draft: true, refined: true, archived: true });

    // Verify all content readable
    const draft = await manager.getVersion(dirName, 'draft');
    const refined = await manager.getVersion(dirName, 'refined');
    const archived = await manager.getVersion(dirName, 'archived');
    expect(draft).toContain('Full Lifecycle Test');
    expect(refined).toBe('refined content');
    expect(archived).toBe('archived content');
  });
});
