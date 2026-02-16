import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { ExperienceLocator } from '../../../src/services/experience-locator.js';
import { ExperienceManager } from '../../../src/services/experience-manager.js';
import { createConfig } from '../../../src/models/config.js';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-experience-locator');

let locator: ExperienceLocator;
let manager: ExperienceManager;

beforeEach(async () => {
  await fs.remove(TEST_DIR);
  const config = createConfig(TEST_DIR);
  await fs.ensureDir(config.experiencesDir);
  await fs.ensureDir(config.resumateDir);
  locator = new ExperienceLocator(config);
  manager = new ExperienceManager(config);

  // Create sample experiences
  await manager.createExperience(new Date('2024-06-15'), 'react-optimization', {
    title: 'React Performance Optimization', company: 'TechCorp', role: 'Senior Engineer',
  });
  await manager.createExperience(new Date('2024-07-20'), 'api-migration', {
    title: 'API Migration', company: 'DataCo', role: 'Lead Developer',
  });
  await manager.createExperience(new Date('2025-01-10'), 'react-hooks', {
    title: 'React Hooks Refactoring', company: 'WebInc', role: 'Frontend Dev',
  });
});

afterEach(async () => {
  await fs.remove(TEST_DIR);
});

describe('ExperienceLocator.getAll', () => {
  it('should list all experiences sorted by date descending', async () => {
    const all = await locator.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].name).toBe('2025-01-10-react-hooks');
    expect(all[1].name).toBe('2024-07-20-api-migration');
    expect(all[2].name).toBe('2024-06-15-react-optimization');
  });
});

describe('ExperienceLocator.search', () => {
  it('should find experiences by exact date', async () => {
    const results = await locator.search('2024-06-15');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].experience.name).toBe('2024-06-15-react-optimization');
    expect(results[0].score).toBe(1.0);
  });

  it('should find experiences by partial date (year)', async () => {
    const results = await locator.search('2024');
    expect(results.length).toBe(2);
    results.forEach(r => expect(r.experience.name).toMatch(/^2024/));
  });

  it('should find experiences by partial date (year-month)', async () => {
    const results = await locator.search('2024-06');
    expect(results.length).toBe(1);
    expect(results[0].experience.name).toContain('2024-06');
  });

  it('should find experiences by slug keyword', async () => {
    const results = await locator.search('react');
    expect(results.length).toBe(2);
    results.forEach(r => expect(r.experience.slug).toContain('react'));
  });

  it('should find experiences by text match', async () => {
    const results = await locator.search('api migration');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].experience.name).toContain('api-migration');
  });

  it('should return empty array for no matches', async () => {
    const results = await locator.search('angular');
    expect(results).toEqual([]);
  });
});

describe('ExperienceLocator.findOne', () => {
  it('should return single exact match', async () => {
    const experience = await locator.findOne('2024-06-15');
    expect(experience.name).toBe('2024-06-15-react-optimization');
  });

  it('should throw for no matches', async () => {
    await expect(locator.findOne('angular')).rejects.toThrow(/no experiences found/i);
  });

  it('should throw for multiple matches', async () => {
    await expect(locator.findOne('react')).rejects.toThrow(/multiple/i);
  });

  it('should return single result when only one matches', async () => {
    const experience = await locator.findOne('api');
    expect(experience.name).toBe('2024-07-20-api-migration');
  });
});

describe('parseQuery', () => {
  it('should detect exact date format', async () => {
    const results = await locator.search('2024-06-15');
    expect(results[0].matchReason).toContain('date');
  });

  it('should detect slug keyword format', async () => {
    const results = await locator.search('optimization');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
