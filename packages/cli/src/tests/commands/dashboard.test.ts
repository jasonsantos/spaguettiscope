import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDashboard } from '../../commands/dashboard.js';

describe('runDashboard', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dashboard-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('completes without error when no connectors are configured', async () => {
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ dashboard: { connectors: [] } })
    );

    await expect(
      runDashboard({ ci: true, output: join(tmpDir, 'reports'), projectRoot: tmpDir })
    ).resolves.not.toThrow();
  });

  it('writes index.html when ci flag is false and connector succeeds', async () => {
    const allureDir = join(tmpDir, 'allure-results');
    mkdirSync(allureDir);

    writeFileSync(
      join(allureDir, 'test-001-result.json'),
      JSON.stringify({
        uuid: 'test-001',
        name: 'sample test',
        fullName: 'Suite > sample test',
        status: 'passed',
        start: Date.now() - 500,
        stop: Date.now(),
        labels: [],
        parameters: [],
        attachments: [],
        steps: [],
      })
    );

    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({
        dashboard: {
          connectors: [{ id: 'allure', resultsDir: allureDir }],
        },
      })
    );

    const outputDir = join(tmpDir, 'reports');

    await runDashboard({ ci: false, output: outputDir, projectRoot: tmpDir });

    expect(existsSync(join(outputDir, 'index.html'))).toBe(true);
    const html = readFileSync(join(outputDir, 'index.html'), 'utf-8');
    expect(html).toContain('__SPASCO_DATA__');
  });
});
