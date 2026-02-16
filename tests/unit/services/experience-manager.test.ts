import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { ExperienceManager } from '../../../src/services/experience-manager.js';
import { createConfig } from '../../../src/models/config.js';
import type { ExperienceContent } from '../../../src/models/experience.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-experience-manager');

let manager: ExperienceManager;
let config: ReturnType<typeof createConfig>;

beforeEach(async () => {
  await fs.remove(TEST_DIR);
  config = createConfig(TEST_DIR);
  await fs.ensureDir(config.experiencesDir);
  await fs.ensureDir(config.resumateDir);
  manager = new ExperienceManager(config);
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

const sampleContent: ExperienceContent = {
  title: 'React Performance Optimization',
  company: 'TechCorp',
  role: 'Senior Engineer',
  description: 'Led team initiative to improve performance.',
};

describe('ExperienceManager.createExperience', () => {
  it('should create experience directory with draft.md', async () => {
    const experience = await manager.createExperience(new Date('2024-06-15'), 'react-optimization', sampleContent);

    expect(experience.name).toBe('2024-06-15-react-optimization');
    expect(experience.date).toEqual(new Date('2024-06-15'));
    expect(experience.slug).toBe('react-optimization');
    expect(experience.versions.draft).toBe(true);
    expect(experience.versions.refined).toBe(false);
    expect(experience.versions.archived).toBe(false);

    const draftPath = path.join(config.experiencesDir, '2024-06-15-react-optimization', 'draft.md');
    expect(await fs.pathExists(draftPath)).toBe(true);

    const content = await fs.readFile(draftPath, 'utf-8');
    expect(content).toContain('React Performance Optimization');
    expect(content).toContain('TechCorp');
    expect(content).toContain('Senior Engineer');
  });

  it('should throw on duplicate experience directory', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'react-optimization', sampleContent);
    await expect(
      manager.createExperience(new Date('2024-06-15'), 'react-optimization', sampleContent)
    ).rejects.toThrow(/already exists/);
  });

  it('should throw on invalid directory name', async () => {
    await expect(
      manager.createExperience(new Date('2024-06-15'), 'React-Opt', sampleContent)
    ).rejects.toThrow();
  });

  it('should auto-create experiences/ directory if missing', async () => {
    await fs.remove(config.experiencesDir);
    const experience = await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);
    expect(experience.name).toBe('2024-06-15-test');
  });
});

describe('ExperienceManager.getExperience', () => {
  it('should return experience directory metadata', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'react-optimization', sampleContent);
    const experience = await manager.getExperience('2024-06-15-react-optimization');

    expect(experience).not.toBeNull();
    expect(experience!.name).toBe('2024-06-15-react-optimization');
    expect(experience!.versions.draft).toBe(true);
    expect(experience!.versions.refined).toBe(false);
  });

  it('should return null for non-existent experience', async () => {
    const experience = await manager.getExperience('2024-06-15-nonexistent');
    expect(experience).toBeNull();
  });
});

describe('ExperienceManager.experienceExists', () => {
  it('should return true for existing experience', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);
    expect(await manager.experienceExists('2024-06-15-test')).toBe(true);
  });

  it('should return false for non-existing experience', async () => {
    expect(await manager.experienceExists('2024-06-15-nope')).toBe(false);
  });
});

describe('ExperienceManager.addRefinedVersion', () => {
  it('should create refined.md while preserving draft.md', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);
    await manager.addRefinedVersion('2024-06-15-test', '---\ntitle: Refined\n---\nRefined content');

    const expDir = path.join(config.experiencesDir, '2024-06-15-test');
    expect(await fs.pathExists(path.join(expDir, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(expDir, 'refined.md'))).toBe(true);

    const refinedContent = await fs.readFile(path.join(expDir, 'refined.md'), 'utf-8');
    expect(refinedContent).toContain('Refined content');
  });

  it('should throw if experience does not exist', async () => {
    await expect(
      manager.addRefinedVersion('2024-06-15-nope', 'content')
    ).rejects.toThrow(/not found/i);
  });

  it('should throw if refined.md already exists', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);
    await manager.addRefinedVersion('2024-06-15-test', 'refined');
    await expect(
      manager.addRefinedVersion('2024-06-15-test', 'refined again')
    ).rejects.toThrow(/already has.*refined/i);
  });
});

describe('ExperienceManager.addArchivedVersion', () => {
  it('should create archived.md while preserving draft.md and refined.md', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);
    await manager.addRefinedVersion('2024-06-15-test', 'refined content');
    await manager.addArchivedVersion('2024-06-15-test', '---\ntitle: Archived\n---\nArchived content');

    const expDir = path.join(config.experiencesDir, '2024-06-15-test');
    expect(await fs.pathExists(path.join(expDir, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(expDir, 'refined.md'))).toBe(true);
    expect(await fs.pathExists(path.join(expDir, 'archived.md'))).toBe(true);
  });

  it('should throw if refined.md does not exist', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);
    await expect(
      manager.addArchivedVersion('2024-06-15-test', 'archived')
    ).rejects.toThrow(/refined/i);
  });

  it('should throw if archived.md already exists', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);
    await manager.addRefinedVersion('2024-06-15-test', 'refined');
    await manager.addArchivedVersion('2024-06-15-test', 'archived');
    await expect(
      manager.addArchivedVersion('2024-06-15-test', 'archived again')
    ).rejects.toThrow(/already has.*archived/i);
  });
});

describe('ExperienceManager.getVersion', () => {
  it('should read specific version content', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);
    const draft = await manager.getVersion('2024-06-15-test', 'draft');
    expect(draft).toContain('React Performance Optimization');
  });

  it('should throw for non-existent version', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);
    await expect(
      manager.getVersion('2024-06-15-test', 'refined')
    ).rejects.toThrow();
  });
});

describe('ExperienceManager.getAvailableVersions', () => {
  it('should return correct version availability', async () => {
    await manager.createExperience(new Date('2024-06-15'), 'test', sampleContent);

    let versions = await manager.getAvailableVersions('2024-06-15-test');
    expect(versions).toEqual({ draft: true, refined: false, archived: false });

    await manager.addRefinedVersion('2024-06-15-test', 'refined');
    versions = await manager.getAvailableVersions('2024-06-15-test');
    expect(versions).toEqual({ draft: true, refined: true, archived: false });

    await manager.addArchivedVersion('2024-06-15-test', 'archived');
    versions = await manager.getAvailableVersions('2024-06-15-test');
    expect(versions).toEqual({ draft: true, refined: true, archived: true });
  });
});
