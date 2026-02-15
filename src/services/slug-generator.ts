import { format } from 'date-fns';
import slugifyModule from 'slugify';
const slugify = slugifyModule as unknown as (str: string, opts?: { lower?: boolean; strict?: boolean; trim?: boolean }) => string;
import path from 'node:path';
import { fileExists } from './file-manager.js';

export function generateSlug(title: string): string {
  return slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });
}

export function generateDatePrefix(date?: Date): string {
  return format(date || new Date(), 'yyyy-MM-dd');
}

export async function generateUniqueFilename(
  title: string,
  directory: string,
  date?: Date,
): Promise<string> {
  const datePrefix = generateDatePrefix(date);
  const slug = generateSlug(title);
  let filename = `${datePrefix}-${slug}.md`;
  let counter = 1;

  while (await fileExists(path.join(directory, filename))) {
    filename = `${datePrefix}-${slug}-${counter}.md`;
    counter++;
  }

  return filename;
}

export function extractDateFromFilename(filename: string): string | null {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
