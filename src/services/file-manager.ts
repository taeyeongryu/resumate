import fs from 'fs-extra';
import path from 'node:path';
import { isValid, parse } from 'date-fns';

export async function readFile(filepath: string): Promise<string> {
  return fs.readFile(filepath, 'utf-8');
}

export async function writeFile(filepath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filepath));
  await fs.writeFile(filepath, content, 'utf-8');
}

export async function moveFile(src: string, dest: string): Promise<void> {
  await fs.ensureDir(path.dirname(dest));
  await fs.move(src, dest, { overwrite: false });
}

export async function removeFile(filepath: string): Promise<void> {
  await fs.remove(filepath);
}

export async function fileExists(filepath: string): Promise<boolean> {
  return fs.pathExists(filepath);
}

export async function getFileStat(filepath: string): Promise<fs.Stats> {
  return fs.stat(filepath);
}

export async function directoryExists(dirpath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirpath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function listFiles(dirpath: string, extension?: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dirpath);
    if (extension) {
      return files.filter((f) => f.endsWith(extension));
    }
    return files;
  } catch {
    return [];
  }
}

export async function ensureDirectory(dirpath: string): Promise<void> {
  await fs.ensureDir(dirpath);
}

const WINDOWS_RESERVED = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];

export function validateExperienceDirName(dirName: string): { valid: boolean; error?: string } {
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(dirName)) {
    return { valid: false, error: 'Directory name must match pattern YYYY-MM-DD-slug (lowercase alphanumeric and hyphens)' };
  }

  if (dirName.length > 100) {
    return { valid: false, error: 'Directory name must be 100 characters or less' };
  }

  const parts = dirName.split('-');
  const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isValid(parsed)) {
    return { valid: false, error: `Invalid date: ${dateStr}` };
  }

  const slug = parts.slice(3).join('-');
  if (slug.length === 0 || slug.length > 50) {
    return { valid: false, error: 'Slug must be 1-50 characters' };
  }

  if (WINDOWS_RESERVED.includes(slug.toLowerCase())) {
    return { valid: false, error: `Slug cannot be a Windows reserved name: ${slug}` };
  }

  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Slug cannot start or end with a hyphen' };
  }

  return { valid: true };
}

export function parseExperienceDirName(dirName: string): { date: string; slug: string } | null {
  const match = dirName.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (!match) return null;

  const dateStr = match[1];
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isValid(parsed)) return null;

  return { date: dateStr, slug: match[2] };
}

export async function listDirectories(dirpath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirpath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}
