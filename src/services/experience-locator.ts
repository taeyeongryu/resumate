import type { ResumateConfig } from '../models/config.js';
import type { ExperienceDirectory, ExperienceQuery, ExperienceSearchResult } from '../models/experience.js';
import { ExperienceManager } from './experience-manager.js';

/**
 * Provides search and lookup capabilities for experience directories.
 * Supports exact date, partial date, slug keyword, and text-based queries.
 */
export class ExperienceLocator {
  private manager: ExperienceManager;

  constructor(private config: ResumateConfig) {
    this.manager = new ExperienceManager(config);
  }

  /** Returns all experience directories, sorted by date descending. */
  async getAll(): Promise<ExperienceDirectory[]> {
    return this.manager.listExperiences();
  }

  /**
   * Searches experiences by query string with relevance scoring.
   * Results are sorted by score descending. Only matches above 0.3 threshold are returned.
   */
  async search(query: string): Promise<ExperienceSearchResult[]> {
    const experiences = await this.getAll();
    const parsedQuery = parseQuery(query);

    const results: ExperienceSearchResult[] = [];

    for (const exp of experiences) {
      const score = scoreMatch(exp, parsedQuery);
      if (score > 0.3) {
        results.push({
          experience: exp,
          score,
          matchReason: getMatchReason(parsedQuery),
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Finds a single experience matching the query.
   * Tries exact directory name match first, then falls back to search.
   * @throws If no match is found or multiple ambiguous matches exist
   */
  async findOne(query: string): Promise<ExperienceDirectory> {
    // Try exact directory name match first
    const exact = await this.manager.getExperience(query);
    if (exact) return exact;

    const results = await this.search(query);

    if (results.length === 0) {
      const all = await this.getAll();
      let msg = `No experiences found matching "${query}"`;
      if (all.length > 0) {
        msg += '\n\n  Available experiences:';
        all.forEach(exp => { msg += `\n    • ${exp.name}`; });
      }
      throw new Error(msg);
    }

    if (results.length > 1) {
      // Check if top result is clearly better
      if (results[0].score > results[1].score + 0.2) {
        return results[0].experience;
      }
      let msg = `Multiple experiences match "${query}":`;
      results.forEach((r, i) => {
        msg += `\n  [${i + 1}] ${r.experience.name} (score: ${r.score.toFixed(1)})`;
      });
      msg += '\n\nPlease use a more specific query.';
      throw new Error(msg);
    }

    return results[0].experience;
  }
}

/**
 * Parses a query string into a typed ExperienceQuery.
 * Detects: exact-date (YYYY-MM-DD), partial-date (YYYY or YYYY-MM),
 * slug-keyword (lowercase alphanumeric with hyphens), or text-match (fallback).
 */
export function parseQuery(query: string): ExperienceQuery {
  // Exact date: "2024-06-15"
  if (/^\d{4}-\d{2}-\d{2}$/.test(query)) {
    const parts = query.split('-').map(Number);
    return {
      query,
      type: 'exact-date',
      components: { year: parts[0], month: parts[1], day: parts[2] },
    };
  }

  // Partial date: "2024-06" or "2024"
  if (/^\d{4}(-\d{2})?$/.test(query)) {
    const parts = query.split('-').map(Number);
    return {
      query,
      type: 'partial-date',
      components: { year: parts[0], month: parts[1] },
    };
  }

  // Slug keyword: single lowercase word with optional hyphens
  if (/^[a-z0-9-]+$/.test(query)) {
    return {
      query,
      type: 'slug-keyword',
      components: { keywords: [query] },
    };
  }

  // General text match
  return {
    query,
    type: 'text-match',
    components: { keywords: query.toLowerCase().split(/\s+/) },
  };
}

function scoreMatch(experience: ExperienceDirectory, query: ExperienceQuery): number {
  const dateStr = experience.date.toISOString().split('T')[0];
  const dateParts = dateStr.split('-').map(Number);

  switch (query.type) {
    case 'exact-date': {
      if (dateParts[0] === query.components.year &&
          dateParts[1] === query.components.month &&
          dateParts[2] === query.components.day) {
        return 1.0;
      }
      return 0;
    }

    case 'partial-date': {
      if (dateParts[0] !== query.components.year) return 0;
      if (query.components.month && dateParts[1] === query.components.month) return 0.8;
      if (!query.components.month) return 0.6;
      return 0;
    }

    case 'slug-keyword': {
      const keyword = query.components.keywords![0];
      if (experience.slug === keyword) return 1.0;
      if (experience.slug.includes(keyword)) return 0.9;
      if (experience.name.includes(keyword)) return 0.7;
      return 0;
    }

    case 'text-match': {
      const keywords = query.components.keywords!;
      const name = experience.name.toLowerCase();
      const matchCount = keywords.filter(kw => name.includes(kw)).length;
      if (matchCount === 0) return 0;
      if (matchCount === keywords.length) return 0.8;
      return 0.4 + (0.3 * matchCount / keywords.length);
    }
  }
}

function getMatchReason(query: ExperienceQuery): string {
  switch (query.type) {
    case 'exact-date': return `Exact date match: ${query.query}`;
    case 'partial-date': return `Partial date match: ${query.query}`;
    case 'slug-keyword': return `Slug keyword match: ${query.query}`;
    case 'text-match': return `Text match: ${query.query}`;
  }
}
