import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { createConfig } from '../../../src/models/config.js';
import { MigrationService } from '../../../src/services/migration-service.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-migrate-integration');

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

describe('migrate command integration', () => {
  it('should migrate complete workflow to experience directory', async () => {
    await createOldStructure({
      'drafts/2024-06-15-react-optimization.md': '# React Draft\n\nDraft content here.',
      'in-progress/2024-06-15-react-optimization.md': '# React Refined\n\nRefined content here.',
      'archive/2024-06-15-react-optimization.md': '# React Archived\n\nArchived content here.',
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    const result = await service.migrate();

    expect(result.success).toBe(true);
    expect(result.experiencesCreated).toBe(1);

    // Verify new structure
    const expDir = path.join(TEST_DIR, 'experiences', '2024-06-15-react-optimization');
    const draft = await fs.readFile(path.join(expDir, 'draft.md'), 'utf-8');
    const refined = await fs.readFile(path.join(expDir, 'refined.md'), 'utf-8');
    const archived = await fs.readFile(path.join(expDir, 'archived.md'), 'utf-8');

    expect(draft).toContain('React Draft');
    expect(refined).toContain('React Refined');
    expect(archived).toContain('React Archived');

    // Verify old structure still exists (not cleaned up yet)
    expect(await fs.pathExists(path.join(TEST_DIR, 'drafts'))).toBe(true);

    // Verify backup
    const backupDir = path.join(TEST_DIR, '.backup', result.migrationId);
    expect(await fs.pathExists(backupDir)).toBe(true);
  });

  it('should handle dry run mode', async () => {
    await createOldStructure({
      'drafts/2024-06-15-test.md': 'content',
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    const result = await service.migrate({ dryRun: true });

    expect(result.success).toBe(true);
    expect(result.experiencesCreated).toBe(1);
    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences'))).toBe(false);
  });

  it('should support cleanup after migration', async () => {
    await createOldStructure({
      'drafts/2024-06-15-test.md': 'content',
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    const result = await service.migrate();
    await service.cleanup(result.migrationId);

    expect(await fs.pathExists(path.join(TEST_DIR, 'drafts'))).toBe(false);
  });

  it('should support rollback after migration', async () => {
    await createOldStructure({
      'drafts/2024-06-15-test.md': 'original',
    });

    const config = createConfig(TEST_DIR);
    const service = new MigrationService(config);
    const result = await service.migrate();

    // Verify migration happened
    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences', '2024-06-15-test'))).toBe(true);

    // Rollback
    await service.rollbackMigration(result.migrationId);

    // Experience should be removed
    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences', '2024-06-15-test'))).toBe(false);

    // Old files should still be there (never deleted during migration)
    expect(await fs.pathExists(path.join(TEST_DIR, 'drafts', '2024-06-15-test.md'))).toBe(true);
  });
});
