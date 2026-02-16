import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { createConfig } from '../../src/models/config.js';
import { MigrationService } from '../../src/services/migration-service.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-migration-scenarios');

beforeEach(async () => {
  await fs.remove(TEST_DIR);
  await fs.ensureDir(path.join(TEST_DIR, '.resumate'));
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

async function createOldStructure(files: Record<string, string>) {
  for (const [filepath, content] of Object.entries(files)) {
    const fullPath = path.join(TEST_DIR, filepath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
  }
}

describe('Migration scenario: complete workflow', () => {
  it('should preserve all files during migration', async () => {
    await createOldStructure({
      'drafts/2024-06-15-react.md': '---\ntitle: React\n---\n# React draft',
      'in-progress/2024-06-15-react.md': '---\ntitle: React Refined\n---\n# React refined',
      'archive/2024-06-15-react.md': '---\ntitle: React Archived\n---\n# React archived',
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    const result = await service.migrate();

    expect(result.success).toBe(true);
    const expDir = path.join(TEST_DIR, 'experiences', '2024-06-15-react');

    // All three version files should exist
    expect(await fs.pathExists(path.join(expDir, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(expDir, 'refined.md'))).toBe(true);
    expect(await fs.pathExists(path.join(expDir, 'archived.md'))).toBe(true);

    // Content should be byte-for-byte identical
    const originalDraft = await fs.readFile(path.join(TEST_DIR, 'drafts', '2024-06-15-react.md'), 'utf-8');
    const migratedDraft = await fs.readFile(path.join(expDir, 'draft.md'), 'utf-8');
    expect(migratedDraft).toBe(originalDraft);
  });
});

describe('Migration scenario: partial workflow', () => {
  it('should handle draft-only experiences', async () => {
    await createOldStructure({
      'drafts/2024-06-15-new-project.md': '# New project draft',
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    const result = await service.migrate();

    expect(result.success).toBe(true);
    const expDir = path.join(TEST_DIR, 'experiences', '2024-06-15-new-project');
    expect(await fs.pathExists(path.join(expDir, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(expDir, 'refined.md'))).toBe(false);
  });

  it('should handle in-progress-only experiences', async () => {
    await createOldStructure({
      'in-progress/2024-06-15-mid-work.md': '# Mid-work content',
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    const result = await service.migrate();

    expect(result.success).toBe(true);
    const expDir = path.join(TEST_DIR, 'experiences', '2024-06-15-mid-work');
    expect(await fs.pathExists(path.join(expDir, 'refined.md'))).toBe(true);
  });
});

describe('Migration scenario: multiple experiences', () => {
  it('should correctly separate experiences by date and slug', async () => {
    await createOldStructure({
      'drafts/2024-01-15-project-a.md': 'Project A draft',
      'drafts/2024-06-15-project-b.md': 'Project B draft',
      'in-progress/2024-06-15-project-b.md': 'Project B refined',
      'archive/2024-01-15-project-a.md': 'Project A archived',
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    const result = await service.migrate();

    expect(result.success).toBe(true);
    expect(result.experiencesCreated).toBe(2);

    // Project A
    const dirA = path.join(TEST_DIR, 'experiences', '2024-01-15-project-a');
    expect(await fs.pathExists(path.join(dirA, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dirA, 'archived.md'))).toBe(true);

    // Project B
    const dirB = path.join(TEST_DIR, 'experiences', '2024-06-15-project-b');
    expect(await fs.pathExists(path.join(dirB, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dirB, 'refined.md'))).toBe(true);
  });
});

describe('Migration scenario: data integrity', () => {
  it('should preserve content with special characters', async () => {
    const specialContent = '# 한국어 제목\n\n특수문자: `<script>alert("xss")</script>`\n\nEmoji: 🎉';
    await createOldStructure({
      'drafts/2024-06-15-special.md': specialContent,
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    await service.migrate();

    const migrated = await fs.readFile(
      path.join(TEST_DIR, 'experiences', '2024-06-15-special', 'draft.md'),
      'utf-8',
    );
    expect(migrated).toBe(specialContent);
  });

  it('should preserve large files', async () => {
    const largeContent = '# Large File\n\n' + 'Line of content.\n'.repeat(10000);
    await createOldStructure({
      'drafts/2024-06-15-large.md': largeContent,
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    await service.migrate();

    const migrated = await fs.readFile(
      path.join(TEST_DIR, 'experiences', '2024-06-15-large', 'draft.md'),
      'utf-8',
    );
    expect(migrated).toBe(largeContent);
  });
});
