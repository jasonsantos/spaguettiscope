import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InferenceEngine, defaultDefinitions } from '@spaguettiscope/core';
import { PlaywrightConnector } from '../../connectors/playwright.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, 'fixtures/playwright-report.json');
const engine = new InferenceEngine(defaultDefinitions, '/project');

describe('PlaywrightConnector', () => {
  it('reads all specs from nested suites', async () => {
    const connector = new PlaywrightConnector();
    const records = await connector.read({ id: 'playwright', reportFile: FIXTURE }, engine);
    expect(records).toHaveLength(3);
  });

  it('maps playwright statuses to normalized statuses', async () => {
    const connector = new PlaywrightConnector();
    const records = await connector.read({ id: 'playwright', reportFile: FIXTURE }, engine);
    const statuses = records.map(r => r.status).sort();
    expect(statuses).toEqual(['failed', 'passed', 'skipped']);
  });

  it('sets connectorId to playwright', async () => {
    const connector = new PlaywrightConnector();
    const records = await connector.read({ id: 'playwright', reportFile: FIXTURE }, engine);
    expect(records.every(r => r.connectorId === 'playwright')).toBe(true);
  });

  it('sets source.file to the spec file path from the suite', async () => {
    const connector = new PlaywrightConnector();
    const records = await connector.read({ id: 'playwright', reportFile: FIXTURE }, engine);
    expect(records.every(r => r.source.file.includes('auth.spec.ts'))).toBe(true);
  });

  it('records duration from the last result', async () => {
    const connector = new PlaywrightConnector();
    const records = await connector.read({ id: 'playwright', reportFile: FIXTURE }, engine);
    const passed = records.find(r => r.status === 'passed')!;
    expect(passed.duration).toBe(1234);
  });
});
