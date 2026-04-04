import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../config/loader.ts';

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `spasco-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default config when no config file exists', async () => {
    const config = await loadConfig(tmpDir);
    expect(config).toMatchObject({ dashboard: { connectors: [] } });
  });

  it('loads and parses a valid config file', async () => {
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({
        name: 'My Project',
        dashboard: {
          connectors: [{ id: 'allure', resultsDir: './allure-results' }],
        },
      })
    );
    const config = await loadConfig(tmpDir);
    expect(config.name).toBe('My Project');
    expect(config.dashboard.connectors).toHaveLength(1);
    expect(config.dashboard.connectors[0].id).toBe('allure');
  });

  it('throws a descriptive error for an invalid config file', async () => {
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ dashboard: { connectors: 'not-an-array' } })
    );
    await expect(loadConfig(tmpDir)).rejects.toThrow('spaguettiscope.config.json');
  });
});
