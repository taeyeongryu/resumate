import { directoryExists } from '../../services/file-manager.js';
import { RESUMATE_DIR_NAME } from '../../models/config.js';
import path from 'node:path';

export async function validateResumateInitialized(rootDir: string): Promise<boolean> {
  const resumateDir = path.join(rootDir, RESUMATE_DIR_NAME);
  return directoryExists(resumateDir);
}

export function validateFilename(filename: string): boolean {
  const pattern = /^\d{4}-\d{2}-\d{2}-.+\.md$/;
  return pattern.test(filename);
}

export function normalizeFilename(input: string): string {
  let filename = input.trim();
  filename = filename.replace(/^@/, '');
  if (!filename.endsWith('.md')) {
    filename += '.md';
  }
  return filename;
}

export function isValidISODate(dateStr: string): boolean {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(dateStr)) return false;
  const date = new Date(dateStr + 'T00:00:00Z');
  return !isNaN(date.getTime());
}

export function parseKoreanDate(text: string): string | null {
  const match = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

export function parseDateFlexible(text: string): string | null {
  const trimmed = text.trim();

  if (isValidISODate(trimmed)) {
    return trimmed;
  }

  const koreanDate = parseKoreanDate(trimmed);
  if (koreanDate) return koreanDate;

  const englishMatch = trimmed.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
  );
  if (englishMatch) {
    const monthNames: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12',
    };
    const monthName = trimmed.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)/i,
    )![1].toLowerCase();
    const month = monthNames[monthName];
    const day = englishMatch[1].padStart(2, '0');
    const year = englishMatch[2];
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function parseDurationFromText(text: string): { start: string; end: string } | null {
  // Try to find two dates in the text
  const koreanDatePattern = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g;
  const isoDatePattern = /(\d{4}-\d{2}-\d{2})/g;

  const koreanDates = [...text.matchAll(koreanDatePattern)];
  if (koreanDates.length >= 2) {
    const start = `${koreanDates[0][1]}-${koreanDates[0][2].padStart(2, '0')}-${koreanDates[0][3].padStart(2, '0')}`;
    const end = `${koreanDates[1][1]}-${koreanDates[1][2].padStart(2, '0')}-${koreanDates[1][3].padStart(2, '0')}`;
    return { start, end };
  }

  const isoDates = [...text.matchAll(isoDatePattern)];
  if (isoDates.length >= 2) {
    return { start: isoDates[0][1], end: isoDates[1][1] };
  }

  // Fallback: split by common separators
  const parts = text.split(/부터|까지|~|–|—|\bto\b/);
  if (parts.length >= 2) {
    const start = parseDateFlexible(parts[0]);
    const end = parseDateFlexible(parts[parts.length - 1]);
    if (start && end) return { start, end };
  }

  return null;
}

export function parseList(text: string): string[] {
  const lines = text.split('\n');
  const items: string[] = [];

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      items.push(bulletMatch[1].trim());
    }
  }

  if (items.length > 0) return items;

  return text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function generateTags(technologies: string[]): string[] {
  const tagMap: Record<string, string[]> = {
    react: ['frontend'],
    vue: ['frontend'],
    angular: ['frontend'],
    'next.js': ['frontend', 'fullstack'],
    'node.js': ['backend'],
    express: ['backend'],
    python: ['backend'],
    django: ['backend'],
    docker: ['devops'],
    kubernetes: ['devops'],
    redis: ['database', 'caching'],
    postgresql: ['database'],
    mongodb: ['database'],
    typescript: ['typescript'],
  };

  const tags = new Set<string>();
  for (const tech of technologies) {
    const lower = tech.toLowerCase();
    const mapped = tagMap[lower];
    if (mapped) {
      mapped.forEach((t) => tags.add(t));
    }
  }

  return [...tags];
}
