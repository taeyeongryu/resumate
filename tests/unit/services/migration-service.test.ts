import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { MigrationService } from '../../../src/services/migration-service.js';
import { createConfig } from '../../../src/models/config.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-migration-service');

let service: MigrationService;

beforeEach(async () => {
  await fs.remove(TEST_DIR);
  await fs.ensureDir(path.join(TEST_DIR, '.resumate'));
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

async function setupOldStructure(files: Record<string, string>) {
  for (const [filepath, content] of Object.entries(files)) {
    const fullPath = path.join(TEST_DIR, filepath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
  }
  const config = createConfig(TEST_DIR);
  service = new MigrationService(config);
}

describe('MigrationService.hasLegacyStructure', () => {
  it('should return true when old directories exist', async () => {
    await setupOldStructure({ 'drafts/2024-06-15.md': 'content' });
    expect(await service.hasLegacyStructure()).toBe(true);
  });

  it('should return false when no old directories exist', async () => {
    const config = createConfig(TEST_DIR);
    service = new MigrationService(config);
    expect(await service.hasLegacyStructure()).toBe(false);
  });
});

describe('MigrationService.previewMigration', () => {
  it('should scan and group files from old structure', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-react.md': 'draft content',
      'in-progress/2024-06-15-react.md': 'refined content',
      'archive/2024-06-15-react.md': 'archived content',
    });

    const plan = await service.previewMigration();

    expect(plan.summary.filesTotal).toBe(3);
    expect(plan.summary.experiencesTotal).toBe(1);
    expect(plan.experiences[0].sourceFiles.draft).toContain('drafts');
    expect(plan.experiences[0].sourceFiles.refined).toContain('in-progress');
    expect(plan.experiences[0].sourceFiles.archived).toContain('archive');
  });

  it('should handle files with different slugs as separate experiences', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-react.md': 'react content',
      'drafts/2024-07-20-api.md': 'api content',
    });

    const plan = await service.previewMigration();
    expect(plan.summary.experiencesTotal).toBe(2);
  });

  it('should throw when no legacy structure exists', async () => {
    const config = createConfig(TEST_DIR);
    service = new MigrationService(config);
    await expect(service.previewMigration()).rejects.toThrow(/no old structure/i);
  });
});

describe('MigrationService.migrate', () => {
  it('should create experience directories from old structure', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-react.md': 'draft content',
      'in-progress/2024-06-15-react.md': 'refined content',
    });

    const result = await service.migrate();

    expect(result.success).toBe(true);
    expect(result.experiencesCreated).toBe(1);

    // Verify files created
    const expDir = path.join(TEST_DIR, 'experiences', '2024-06-15-react');
    expect(await fs.pathExists(path.join(expDir, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(expDir, 'refined.md'))).toBe(true);

    // Verify content preserved
    const draft = await fs.readFile(path.join(expDir, 'draft.md'), 'utf-8');
    expect(draft).toBe('draft content');
  });

  it('should create backup of old directories', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-test.md': 'content',
    });

    const result = await service.migrate();

    // Backup should exist
    const backupDir = path.join(TEST_DIR, '.backup', result.migrationId);
    expect(await fs.pathExists(path.join(backupDir, 'drafts', '2024-06-15-test.md'))).toBe(true);
  });

  it('should handle dry run without creating files', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-test.md': 'content',
    });

    const result = await service.migrate({ dryRun: true });

    expect(result.success).toBe(true);
    expect(result.experiencesCreated).toBe(1);

    // No experience directory should be created
    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences'))).toBe(false);
  });

  it('should save migration manifest', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-test.md': 'content',
    });

    const result = await service.migrate();

    const manifestPath = path.join(TEST_DIR, '.resumate', 'migrations', `${result.migrationId}.json`);
    expect(await fs.pathExists(manifestPath)).toBe(true);

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    expect(manifest.phase).toBe('completed');
  });
});

describe('MigrationService.cleanup', () => {
  it('should remove old directories after successful migration', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-test.md': 'content',
    });

    const result = await service.migrate();
    await service.cleanup(result.migrationId);

    expect(await fs.pathExists(path.join(TEST_DIR, 'drafts'))).toBe(false);
  });
});

describe('MigrationService.rollbackMigration', () => {
  it('should remove created experiences and restore old structure', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-test.md': 'original content',
    });

    const result = await service.migrate();

    // Verify experience created
    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences', '2024-06-15-test'))).toBe(true);

    await service.rollbackMigration(result.migrationId);

    // Experience should be gone (but old dirs still exist since we didn't cleanup)
    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences', '2024-06-15-test'))).toBe(false);
  });
});

describe('Multiple file migration', () => {
  it('should handle complete workflow (draft + refined + archived)', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-react-optimization.md': '# React Draft',
      'in-progress/2024-06-15-react-optimization.md': '# React Refined',
      'archive/2024-06-15-react-optimization.md': '# React Archived',
    });

    const result = await service.migrate();

    expect(result.success).toBe(true);

    const expDir = path.join(TEST_DIR, 'experiences', '2024-06-15-react-optimization');
    expect(await fs.readFile(path.join(expDir, 'draft.md'), 'utf-8')).toBe('# React Draft');
    expect(await fs.readFile(path.join(expDir, 'refined.md'), 'utf-8')).toBe('# React Refined');
    expect(await fs.readFile(path.join(expDir, 'archived.md'), 'utf-8')).toBe('# React Archived');
  });

  it('should handle partial workflows (draft only)', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-test.md': 'draft only',
    });

    const result = await service.migrate();

    const expDir = path.join(TEST_DIR, 'experiences', '2024-06-15-test');
    expect(await fs.pathExists(path.join(expDir, 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(expDir, 'refined.md'))).toBe(false);
    expect(await fs.pathExists(path.join(expDir, 'archived.md'))).toBe(false);
  });

  it('should handle multiple experiences', async () => {
    await setupOldStructure({
      'drafts/2024-06-15-react.md': 'react draft',
      'drafts/2024-07-20-api.md': 'api draft',
      'in-progress/2024-07-20-api.md': 'api refined',
    });

    const result = await service.migrate();

    expect(result.success).toBe(true);
    expect(result.experiencesCreated).toBe(2);

    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences', '2024-06-15-react', 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences', '2024-07-20-api', 'draft.md'))).toBe(true);
    expect(await fs.pathExists(path.join(TEST_DIR, 'experiences', '2024-07-20-api', 'refined.md'))).toBe(true);
  });
});
