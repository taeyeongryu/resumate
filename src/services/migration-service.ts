import path from 'node:path';
import fs from 'fs-extra';
import crypto from 'node:crypto';
import { format } from 'date-fns';
import type { ResumateConfig } from '../models/config.js';
import type { MigrationManifest, MigrationExperienceMapping, MigrationError } from '../models/experience.js';
import {
  directoryExists,
  fileExists,
  ensureDirectory,
  readFile,
  writeFile,
  listFiles,
} from './file-manager.js';
import { parseExperienceDirName, validateExperienceDirName } from './file-manager.js';
import { generateSlug, extractDateFromFilename } from './slug-generator.js';

export interface MigrationOptions {
  dryRun?: boolean;
  backupDir?: string;
  autoConfirm?: boolean;
}

export interface MigrationPlan {
  experiences: MigrationExperienceMapping[];
  conflicts: MigrationConflict[];
  unmappedFiles: string[];
  summary: {
    filesTotal: number;
    experiencesTotal: number;
    conflictsCount: number;
  };
}

export interface MigrationConflict {
  type: 'duplicate-date' | 'ambiguous-match' | 'unmappable';
  files: string[];
  message: string;
}

export interface MigrationResult {
  success: boolean;
  migrationId: string;
  experiencesCreated: number;
  errors: MigrationError[];
}

interface ScannedFile {
  source: 'drafts' | 'in-progress' | 'archive';
  filename: string;
  filepath: string;
  date: string | null;
  slug: string;
}

/**
 * Handles migration from legacy workflow-based structure (drafts/in-progress/archive)
 * to the new experience-based directory structure.
 * Supports dry-run preview, phased execution, backup, rollback, and resume.
 */
export class MigrationService {
  private legacyDirs: { drafts: string; inProgress: string; archive: string };
  private migrationsDir: string;

  constructor(private config: ResumateConfig) {
    this.legacyDirs = {
      drafts: path.join(config.rootDir, 'drafts'),
      inProgress: path.join(config.rootDir, 'in-progress'),
      archive: path.join(config.rootDir, 'archive'),
    };
    this.migrationsDir = path.join(config.resumateDir, 'migrations');
  }

  /** Checks if any legacy directories (drafts, in-progress, archive) exist. */
  async hasLegacyStructure(): Promise<boolean> {
    return (
      (await directoryExists(this.legacyDirs.drafts)) ||
      (await directoryExists(this.legacyDirs.inProgress)) ||
      (await directoryExists(this.legacyDirs.archive))
    );
  }

  /**
   * Previews the migration plan without making any changes.
   * @throws If no legacy structure exists
   */
  async previewMigration(): Promise<MigrationPlan> {
    if (!(await this.hasLegacyStructure())) {
      throw new Error('No old structure found to migrate.\n\nThis project already uses the experience-based structure.');
    }

    const scanned = await this.scanPhase();
    const { groups, conflicts, unmappedFiles } = this.groupingPhase(scanned);
    const mappings = this.createMappings(groups);

    return {
      experiences: mappings,
      conflicts,
      unmappedFiles,
      summary: {
        filesTotal: scanned.length,
        experiencesTotal: mappings.length,
        conflictsCount: conflicts.length,
      },
    };
  }

  /**
   * Executes the full migration: scan, group, validate, convert, verify, and backup.
   * Progress is saved to a manifest file after each experience, enabling resume on failure.
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const migrationId = `migration-${format(new Date(), 'yyyyMMdd-HHmmss')}`;
    const backupDir = options.backupDir || path.join(this.config.rootDir, '.backup', migrationId);
    const errors: MigrationError[] = [];

    const manifest: MigrationManifest = {
      migrationId,
      startedAt: new Date().toISOString(),
      phase: 'scanning',
      progress: { filesScanned: 0, filesTotal: 0, experiencesCreated: 0, experiencesTotal: 0 },
      experiences: [],
      errors: [],
      config: { rootDir: this.config.rootDir, backupDir, dryRun: options.dryRun || false },
    };

    try {
      // Phase 1: Scan
      manifest.phase = 'scanning';
      const scanned = await this.scanPhase();
      manifest.progress.filesScanned = scanned.length;
      manifest.progress.filesTotal = scanned.length;

      // Phase 2: Group
      manifest.phase = 'grouping';
      const { groups, unmappedFiles } = this.groupingPhase(scanned);
      const mappings = this.createMappings(groups);
      manifest.experiences = mappings;
      manifest.progress.experiencesTotal = mappings.length;

      if (options.dryRun) {
        manifest.phase = 'completed';
        manifest.completedAt = new Date().toISOString();
        return {
          success: true,
          migrationId,
          experiencesCreated: mappings.length,
          errors: [],
        };
      }

      // Phase 3: Validate
      manifest.phase = 'validating';
      await this.saveManifest(manifest);

      // Phase 4: Convert
      manifest.phase = 'converting';
      await ensureDirectory(this.config.experiencesDir);

      for (const mapping of mappings) {
        try {
          mapping.status = 'in-progress';
          await this.convertExperience(mapping);
          mapping.status = 'completed';
          manifest.progress.experiencesCreated++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          mapping.status = 'failed';
          mapping.error = message;
          errors.push({
            phase: 'converting',
            filepath: mapping.experienceDir,
            message,
            timestamp: new Date().toISOString(),
          });
        }
        await this.saveManifest(manifest);
      }

      // Phase 5: Verify
      manifest.phase = 'verifying';
      for (const mapping of mappings.filter(m => m.status === 'completed')) {
        const verified = await this.verifyExperience(mapping);
        if (!verified) {
          errors.push({
            phase: 'verifying',
            filepath: mapping.experienceDir,
            message: 'Content verification failed',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Phase 6: Backup old directories
      manifest.phase = 'cleanup';
      await ensureDirectory(backupDir);
      for (const [name, dirPath] of Object.entries(this.legacyDirs)) {
        if (await directoryExists(dirPath)) {
          await fs.copy(dirPath, path.join(backupDir, name));
        }
      }

      manifest.phase = 'completed';
      manifest.completedAt = new Date().toISOString();
      manifest.errors = errors;
      await this.saveManifest(manifest);

      return {
        success: errors.length === 0,
        migrationId,
        experiencesCreated: manifest.progress.experiencesCreated,
        errors,
      };
    } catch (err) {
      manifest.phase = 'failed';
      manifest.errors = errors;
      const message = err instanceof Error ? err.message : String(err);
      manifest.errors.push({
        phase: manifest.phase,
        message,
        timestamp: new Date().toISOString(),
      });
      await this.saveManifest(manifest);
      throw err;
    }
  }

  /**
   * Removes legacy directories after a completed migration.
   * @throws If the migration is not found or not completed
   */
  async cleanup(migrationId: string): Promise<void> {
    const manifest = await this.loadManifest(migrationId);
    if (!manifest) {
      throw new Error(`Migration not found: ${migrationId}`);
    }
    if (manifest.phase !== 'completed') {
      throw new Error(`Migration ${migrationId} is not completed (phase: ${manifest.phase})`);
    }

    // Remove old directories
    for (const dirPath of Object.values(this.legacyDirs)) {
      if (await directoryExists(dirPath)) {
        await fs.remove(dirPath);
      }
    }
  }

  /**
   * Rolls back a migration by removing created experience directories
   * and restoring legacy directories from backup.
   */
  async rollbackMigration(migrationId: string): Promise<void> {
    const manifest = await this.loadManifest(migrationId);
    if (!manifest) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    // Remove created experience directories
    for (const mapping of manifest.experiences.filter(m => m.status === 'completed')) {
      const dirPath = path.join(this.config.experiencesDir, mapping.experienceDir);
      if (await directoryExists(dirPath)) {
        await fs.remove(dirPath);
      }
    }

    // Restore from backup if it exists
    if (await directoryExists(manifest.config.backupDir)) {
      for (const [name, dirPath] of Object.entries(this.legacyDirs)) {
        const backupPath = path.join(manifest.config.backupDir, name);
        if (await directoryExists(backupPath)) {
          await fs.copy(backupPath, dirPath);
        }
      }
    }

    manifest.phase = 'failed';
    await this.saveManifest(manifest);
  }

  /**
   * Resumes a previously interrupted migration, retrying pending and failed experiences.
   * @throws If the migration is not found
   */
  async resumeMigration(migrationId: string): Promise<MigrationResult> {
    const manifest = await this.loadManifest(migrationId);
    if (!manifest) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    const errors: MigrationError[] = [...manifest.errors];
    manifest.phase = 'converting';

    for (const mapping of manifest.experiences.filter(m => m.status === 'pending' || m.status === 'failed')) {
      try {
        mapping.status = 'in-progress';
        await this.convertExperience(mapping);
        mapping.status = 'completed';
        manifest.progress.experiencesCreated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        mapping.status = 'failed';
        mapping.error = message;
        errors.push({
          phase: 'converting',
          filepath: mapping.experienceDir,
          message,
          timestamp: new Date().toISOString(),
        });
      }
      await this.saveManifest(manifest);
    }

    manifest.phase = 'completed';
    manifest.completedAt = new Date().toISOString();
    manifest.errors = errors;
    await this.saveManifest(manifest);

    return {
      success: errors.length === 0,
      migrationId,
      experiencesCreated: manifest.progress.experiencesCreated,
      errors,
    };
  }

  private async scanPhase(): Promise<ScannedFile[]> {
    const files: ScannedFile[] = [];

    const sources: Array<{ dir: string; source: ScannedFile['source'] }> = [
      { dir: this.legacyDirs.drafts, source: 'drafts' },
      { dir: this.legacyDirs.inProgress, source: 'in-progress' },
      { dir: this.legacyDirs.archive, source: 'archive' },
    ];

    for (const { dir, source } of sources) {
      if (!(await directoryExists(dir))) continue;
      const mdFiles = await listFiles(dir, '.md');
      for (const filename of mdFiles) {
        const date = extractDateFromFilename(filename);
        const nameWithoutExt = filename.replace('.md', '');
        const slugPart = date
          ? nameWithoutExt.replace(/^\d{4}-\d{2}-\d{2}-?/, '')
          : nameWithoutExt;
        const slug = slugPart ? generateSlug(slugPart) : generateSlug(nameWithoutExt);

        files.push({
          source,
          filename,
          filepath: path.join(dir, filename),
          date,
          slug,
        });
      }
    }

    return files;
  }

  private groupingPhase(files: ScannedFile[]): {
    groups: Map<string, { draft?: ScannedFile; refined?: ScannedFile; archived?: ScannedFile }>;
    conflicts: MigrationConflict[];
    unmappedFiles: string[];
  } {
    const groups = new Map<string, { draft?: ScannedFile; refined?: ScannedFile; archived?: ScannedFile }>();
    const conflicts: MigrationConflict[] = [];
    const unmappedFiles: string[] = [];

    for (const file of files) {
      if (!file.date) {
        unmappedFiles.push(file.filepath);
        continue;
      }

      const key = file.slug ? `${file.date}-${file.slug}` : file.date;
      if (!groups.has(key)) {
        groups.set(key, {});
      }

      const group = groups.get(key)!;
      const versionKey = file.source === 'drafts' ? 'draft'
        : file.source === 'in-progress' ? 'refined'
        : 'archived';

      if (group[versionKey]) {
        // Conflict: multiple files for same slot
        conflicts.push({
          type: 'duplicate-date',
          files: [group[versionKey]!.filepath, file.filepath],
          message: `Multiple ${versionKey} files found for ${key}`,
        });
      } else {
        group[versionKey] = file;
      }
    }

    return { groups, conflicts, unmappedFiles };
  }

  private createMappings(
    groups: Map<string, { draft?: ScannedFile; refined?: ScannedFile; archived?: ScannedFile }>,
  ): MigrationExperienceMapping[] {
    const mappings: MigrationExperienceMapping[] = [];

    for (const [key, group] of groups) {
      let dirName = key;
      // Validate the directory name
      const validation = validateExperienceDirName(dirName);
      if (!validation.valid) {
        // Try to fix: ensure slug part exists
        const parsed = dirName.match(/^(\d{4}-\d{2}-\d{2})-?(.*)$/);
        if (parsed) {
          const slug = parsed[2] ? generateSlug(parsed[2]) : 'unnamed';
          dirName = `${parsed[1]}-${slug}`;
        } else {
          dirName = `${dirName}-unnamed`;
        }
      }

      mappings.push({
        experienceDir: dirName,
        sourceFiles: {
          draft: group.draft?.filepath,
          refined: group.refined?.filepath,
          archived: group.archived?.filepath,
        },
        status: 'pending',
      });
    }

    return mappings;
  }

  private async convertExperience(mapping: MigrationExperienceMapping): Promise<void> {
    const dirPath = path.join(this.config.experiencesDir, mapping.experienceDir);
    await ensureDirectory(dirPath);

    const versionMap: Array<{ source?: string; dest: string }> = [
      { source: mapping.sourceFiles.draft, dest: 'draft.md' },
      { source: mapping.sourceFiles.refined, dest: 'refined.md' },
      { source: mapping.sourceFiles.archived, dest: 'archived.md' },
    ];

    mapping.checksums = {};

    for (const { source, dest } of versionMap) {
      if (!source) continue;
      const content = await readFile(source);
      await writeFile(path.join(dirPath, dest), content);

      // Calculate checksum
      const hash = crypto.createHash('md5').update(content).digest('hex');
      const key = dest.replace('.md', '') as 'draft' | 'refined' | 'archived';
      mapping.checksums[key] = hash;
    }
  }

  private async verifyExperience(mapping: MigrationExperienceMapping): Promise<boolean> {
    if (!mapping.checksums) return true;

    const dirPath = path.join(this.config.experiencesDir, mapping.experienceDir);

    for (const [version, expectedHash] of Object.entries(mapping.checksums)) {
      if (!expectedHash) continue;
      const filePath = path.join(dirPath, `${version}.md`);
      if (!(await fileExists(filePath))) return false;
      const content = await readFile(filePath);
      const hash = crypto.createHash('md5').update(content).digest('hex');
      if (hash !== expectedHash) return false;
    }

    return true;
  }

  private async saveManifest(manifest: MigrationManifest): Promise<void> {
    await ensureDirectory(this.migrationsDir);
    const filepath = path.join(this.migrationsDir, `${manifest.migrationId}.json`);
    await writeFile(filepath, JSON.stringify(manifest, null, 2));
  }

  private async loadManifest(migrationId: string): Promise<MigrationManifest | null> {
    const filepath = path.join(this.migrationsDir, `${migrationId}.json`);
    if (!(await fileExists(filepath))) return null;
    const content = await readFile(filepath);
    return JSON.parse(content) as MigrationManifest;
  }
}
