import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { createConfig } from '../../src/models/config.js';
import { ExperienceManager } from '../../src/services/experience-manager.js';
import { ExperienceLocator } from '../../src/services/experience-locator.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-search-scenarios');

let locator: ExperienceLocator;
let manager: ExperienceManager;

beforeEach(async () => {
  await fs.remove(TEST_DIR);
  const config = createConfig(TEST_DIR);
  await fs.ensureDir(config.experiencesDir);
  await fs.ensureDir(config.resumateDir);
  locator = new ExperienceLocator(config);
  manager = new ExperienceManager(config);

  // Create diverse experiences for search testing
  await manager.createExperience(new Date('2024-01-15'), 'react-optimization', {
    title: 'React Optimization', company: 'TechCorp', role: 'Dev',
  });
  await manager.createExperience(new Date('2024-06-15'), 'api-gateway', {
    title: 'API Gateway', company: 'DataCo', role: 'Dev',
  });
  await manager.createExperience(new Date('2024-06-20'), 'database-migration', {
    title: 'Database Migration', company: 'DBInc', role: 'Dev',
  });
  await manager.createExperience(new Date('2025-01-10'), 'react-hooks-refactor', {
    title: 'React Hooks Refactor', company: 'WebCo', role: 'Dev',
  });
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('Search by date', () => {
  it('finds exact date match', async () => {
    const results = await locator.search('2024-06-15');
    expect(results.length).toBe(1);
    expect(results[0].experience.slug).toBe('api-gateway');
  });

  it('finds by year', async () => {
    const results = await locator.search('2024');
    expect(results.length).toBe(3);
  });

  it('finds by year-month', async () => {
    const results = await locator.search('2024-06');
    expect(results.length).toBe(2);
  });
});

describe('Search by slug keyword', () => {
  it('finds by slug substring', async () => {
    const results = await locator.search('react');
    expect(results.length).toBe(2);
    results.forEach(r => expect(r.experience.slug).toContain('react'));
  });

  it('finds exact slug', async () => {
    const results = await locator.search('api-gateway');
    expect(results.length).toBe(1);
    expect(results[0].score).toBe(1.0);
  });
});

describe('Search by text', () => {
  it('finds by multi-word query', async () => {
    const results = await locator.search('database migration');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].experience.slug).toBe('database-migration');
  });
});

describe('findOne behavior', () => {
  it('returns single match for unique query', async () => {
    const exp = await locator.findOne('api-gateway');
    expect(exp.slug).toBe('api-gateway');
  });

  it('throws for ambiguous query with similar scores', async () => {
    await expect(locator.findOne('react')).rejects.toThrow(/multiple/i);
  });

  it('throws for no results', async () => {
    await expect(locator.findOne('angular')).rejects.toThrow(/no experiences found/i);
  });
});
