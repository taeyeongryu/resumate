import fs from 'fs-extra';
import path from 'node:path';

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
