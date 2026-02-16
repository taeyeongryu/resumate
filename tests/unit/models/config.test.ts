import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { createConfig, RESUMATE_DIR_NAME } from '../../../src/models/config.js';

describe('createConfig', () => {
  it('should create config with correct paths', () => {
    const rootDir = '/test/project';
    const config = createConfig(rootDir);

    expect(config.rootDir).toBe(rootDir);
    expect(config.resumateDir).toBe(path.join(rootDir, '.resumate'));
    expect(config.experiencesDir).toBe(path.join(rootDir, 'experiences'));
    expect(config.claudeCommandsDir).toBe(path.join(rootDir, '.claude', 'commands'));
  });

  it('should not include legacy directories by default', () => {
    const config = createConfig('/test/project');
    expect(config.legacy).toBeUndefined();
  });
});

describe('RESUMATE_DIR_NAME', () => {
  it('should be .resumate', () => {
    expect(RESUMATE_DIR_NAME).toBe('.resumate');
  });
});
