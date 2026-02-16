import path from 'node:path';
import { format } from 'date-fns';
import type { ResumateConfig } from '../models/config.js';
import type { ExperienceDirectory, ExperienceContent, VersionType } from '../models/experience.js';
import {
  ensureDirectory,
  writeFile,
  readFile,
  fileExists,
  directoryExists,
  validateExperienceDirName,
  parseExperienceDirName,
  listDirectories,
} from './file-manager.js';
import { stringifyMarkdown } from './markdown-processor.js';

/**
 * Manages the lifecycle of experience directories.
 * Handles creation, retrieval, and version management (draft, refined, archived).
 */
export class ExperienceManager {
  constructor(private config: ResumateConfig) {}

  /**
   * Creates a new experience directory with an initial draft.md file.
   * @param date - The experience date
   * @param slug - URL-safe identifier for the experience
   * @param content - Frontmatter content (title, company, role, etc.)
   * @returns The created ExperienceDirectory
   * @throws If the directory name is invalid or already exists
   */
  async createExperience(date: Date, slug: string, content: ExperienceContent): Promise<ExperienceDirectory> {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dirName = `${dateStr}-${slug}`;

    const validation = validateExperienceDirName(dirName);
    if (!validation.valid) {
      throw new Error(`Invalid experience directory name "${dirName}": ${validation.error}`);
    }

    const dirPath = path.join(this.config.experiencesDir, dirName);

    if (await directoryExists(dirPath)) {
      throw new Error(`Experience already exists: ${dirName}\n\nOptions:\n  • Use a different slug: --slug ${slug}-v2\n  • Edit existing draft directly`);
    }

    await ensureDirectory(dirPath);

    const frontmatter: Record<string, unknown> = {
      date: dateStr,
      title: content.title,
      company: content.company,
      role: content.role,
    };
    if (content.description) {
      frontmatter.description = content.description;
    }

    const body = content.description
      ? `\n# ${content.title}\n\n${content.description}\n`
      : `\n# ${content.title}\n\n`;
    const draftContent = stringifyMarkdown(body, frontmatter);
    await writeFile(path.join(dirPath, 'draft.md'), draftContent);

    return this.buildExperienceDirectory(dirName, dirPath);
  }

  /**
   * Retrieves an experience directory by its name.
   * @param dirName - Directory name in YYYY-MM-DD-slug format
   * @returns The ExperienceDirectory or null if not found
   */
  async getExperience(dirName: string): Promise<ExperienceDirectory | null> {
    const dirPath = path.join(this.config.experiencesDir, dirName);
    if (!(await directoryExists(dirPath))) {
      return null;
    }
    return this.buildExperienceDirectory(dirName, dirPath);
  }

  /** Lists all valid experience directories, sorted by date descending. */
  async listExperiences(): Promise<ExperienceDirectory[]> {
    const dirs = await listDirectories(this.config.experiencesDir);
    const experiences: ExperienceDirectory[] = [];

    for (const dir of dirs) {
      const parsed = parseExperienceDirName(dir);
      if (parsed) {
        const exp = await this.buildExperienceDirectory(dir, path.join(this.config.experiencesDir, dir));
        experiences.push(exp);
      }
    }

    return experiences.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /** Checks whether an experience directory exists. */
  async experienceExists(dirName: string): Promise<boolean> {
    return directoryExists(path.join(this.config.experiencesDir, dirName));
  }

  /**
   * Adds a refined.md version to an existing experience.
   * @throws If the experience doesn't exist or already has a refined version
   */
  async addRefinedVersion(dirName: string, content: string): Promise<void> {
    const dirPath = path.join(this.config.experiencesDir, dirName);

    if (!(await directoryExists(dirPath))) {
      throw new Error(`Experience not found: ${dirName}`);
    }

    const refinedPath = path.join(dirPath, 'refined.md');
    if (await fileExists(refinedPath)) {
      throw new Error(`Experience already has a refined version: ${dirName}\n\nOptions:\n  • Edit refined.md directly in your editor\n  • Delete refined.md and run 'resumate refine' again`);
    }

    await writeFile(refinedPath, content);
  }

  /**
   * Adds an archived.md version to an existing experience.
   * @throws If the experience doesn't exist, has no refined version, or already has an archived version
   */
  async addArchivedVersion(dirName: string, content: string): Promise<void> {
    const dirPath = path.join(this.config.experiencesDir, dirName);

    if (!(await directoryExists(dirPath))) {
      throw new Error(`Experience not found: ${dirName}`);
    }

    const refinedPath = path.join(dirPath, 'refined.md');
    if (!(await fileExists(refinedPath))) {
      throw new Error(`No refined version found for experience: ${dirName}\n\nThe archive command requires a refined version.\nRun 'resumate refine ${dirName}' first.`);
    }

    const archivedPath = path.join(dirPath, 'archived.md');
    if (await fileExists(archivedPath)) {
      throw new Error(`Experience already has an archived version: ${dirName}\n\nOptions:\n  • Edit archived.md directly\n  • Delete archived.md and run 'resumate archive' again`);
    }

    await writeFile(archivedPath, content);
  }

  /**
   * Reads the content of a specific version file.
   * @throws If the version file doesn't exist
   */
  async getVersion(dirName: string, version: VersionType): Promise<string> {
    const filePath = path.join(this.config.experiencesDir, dirName, `${version}.md`);
    if (!(await fileExists(filePath))) {
      throw new Error(`Version ${version}.md not found for experience: ${dirName}`);
    }
    return readFile(filePath);
  }

  /** Returns which version files (draft, refined, archived) exist for an experience. */
  async getAvailableVersions(dirName: string): Promise<{ draft: boolean; refined: boolean; archived: boolean }> {
    const dirPath = path.join(this.config.experiencesDir, dirName);
    return {
      draft: await fileExists(path.join(dirPath, 'draft.md')),
      refined: await fileExists(path.join(dirPath, 'refined.md')),
      archived: await fileExists(path.join(dirPath, 'archived.md')),
    };
  }

  private async buildExperienceDirectory(dirName: string, dirPath: string): Promise<ExperienceDirectory> {
    const parsed = parseExperienceDirName(dirName);
    if (!parsed) {
      throw new Error(`Invalid experience directory name: ${dirName}`);
    }

    const versions = await this.getAvailableVersions(dirName);

    const timestamps: { draft?: Date; refined?: Date; archived?: Date } = {};
    for (const version of ['draft', 'refined', 'archived'] as const) {
      if (versions[version]) {
        const filePath = path.join(dirPath, `${version}.md`);
        const stat = await import('fs-extra').then(fs => fs.stat(filePath));
        timestamps[version] = stat.mtime;
      }
    }

    return {
      path: dirPath,
      name: dirName,
      date: new Date(parsed.date),
      slug: parsed.slug,
      versions,
      timestamps,
    };
  }
}
