import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../config/loader.js';

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

  it('reads custom skeleton path from config', async () => {
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ skeleton: './custom/skeleton.yaml', dashboard: { connectors: [] } })
    )
    const config = await loadConfig(tmpDir)
    expect(config.skeleton).toBe('./custom/skeleton.yaml')
  })

  it('defaults rules.disable to empty array', async () => {
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ dashboard: { connectors: [] } })
    )
    const config = await loadConfig(tmpDir)
    expect(config.rules.disable).toEqual([])
  })

  it('reads rules.disable from config', async () => {
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ rules: { disable: ['built-in:role:test-ts'] }, dashboard: { connectors: [] } })
    )
    const config = await loadConfig(tmpDir)
    expect(config.rules.disable).toEqual(['built-in:role:test-ts'])
  })

  it('defaults plugins to empty array', async () => {
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ dashboard: { connectors: [] } })
    )
    const config = await loadConfig(tmpDir)
    expect(config.plugins).toEqual([])
  })

  it('accepts plugins array', async () => {
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ plugins: ['@acme/plugin-foo'], dashboard: { connectors: [] } })
    )
    const config = await loadConfig(tmpDir)
    expect(config.plugins).toEqual(['@acme/plugin-foo'])
  })

  it('defaults skeleton path to .spasco/skeleton.yaml', async () => {
    writeFileSync(
      join(tmpDir, 'spasco.config.json'),
      JSON.stringify({ dashboard: { connectors: [] } })
    )
    const config = await loadConfig(tmpDir)
    expect(config.skeleton).toBe('.spasco/skeleton.yaml')
  })

  it('defaults dashboard.outputDir to .spasco/reports', async () => {
    writeFileSync(
      join(tmpDir, 'spasco.config.json'),
      JSON.stringify({ dashboard: { connectors: [] } })
    )
    const config = await loadConfig(tmpDir)
    expect(config.dashboard.outputDir).toBe('.spasco/reports')
  })

  it('defaults dashboard.historyFile to .spasco/history.jsonl', async () => {
    writeFileSync(
      join(tmpDir, 'spasco.config.json'),
      JSON.stringify({ dashboard: { connectors: [] } })
    )
    const config = await loadConfig(tmpDir)
    expect(config.dashboard.historyFile).toBe('.spasco/history.jsonl')
  })

  it('defaults analysis.intermediates to .spasco/intermediates.json', async () => {
    writeFileSync(
      join(tmpDir, 'spasco.config.json'),
      JSON.stringify({ dashboard: { connectors: [] } })
    )
    const config = await loadConfig(tmpDir)
    expect(config.analysis.intermediates).toBe('.spasco/intermediates.json')
  })
});
