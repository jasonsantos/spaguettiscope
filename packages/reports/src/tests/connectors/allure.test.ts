import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { AllureConnector } from '../../connectors/allure.js';
import { InferenceEngine, defaultDefinitions } from '@spaguettiscope/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

describe('AllureConnector', () => {
  let tmpDir: string;
  let engine: InferenceEngine;
  let connector: AllureConnector;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `allure-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    engine = new InferenceEngine(defaultDefinitions, '/project');
    connector = new AllureConnector();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when resultsDir has no result files', async () => {
    const records = await connector.read(
      { id: 'allure', resultsDir: tmpDir },
      engine
    );
    expect(records).toEqual([]);
  });

  it('reads a passed result and maps to NormalizedRunRecord', async () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'passed-result.json'), 'utf-8'));
    writeFileSync(join(tmpDir, 'abc-001-result.json'), JSON.stringify(fixture));

    const records = await connector.read({ id: 'allure', resultsDir: tmpDir }, engine);

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('abc-001');
    expect(records[0].status).toBe('passed');
    expect(records[0].name).toBe('should create user');
    expect(records[0].duration).toBe(1200);
    expect(records[0].connectorId).toBe('allure');
  });

  it('reads a failed result correctly', async () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'failed-result.json'), 'utf-8'));
    writeFileSync(join(tmpDir, 'abc-002-result.json'), JSON.stringify(fixture));

    const records = await connector.read({ id: 'allure', resultsDir: tmpDir }, engine);

    expect(records[0].status).toBe('failed');
  });

  it('assigns dimensions using InferenceEngine from testSourceFile label', async () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'passed-result.json'), 'utf-8'));
    writeFileSync(join(tmpDir, 'abc-001-result.json'), JSON.stringify(fixture));

    const records = await connector.read({ id: 'allure', resultsDir: tmpDir }, engine);

    // testSourceFile label is 'src/repositories/userRepository.test.ts' → role=test
    expect(records[0].dimensions.role).toBe('test');
  });

  it('falls back to feature label for domain when no testSourceFile label exists', async () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'passed-result.json'), 'utf-8'));
    // Remove testSourceFile label
    fixture.labels = fixture.labels.filter((l: { name: string }) => l.name !== 'testSourceFile');
    writeFileSync(join(tmpDir, 'abc-001-result.json'), JSON.stringify(fixture));

    const records = await connector.read({ id: 'allure', resultsDir: tmpDir }, engine);

    // Feature label is 'User Management' — lowercased and slugged → 'user-management'
    expect(records[0].dimensions.domain).toBe('user-management');
  });

  it('ignores non-result JSON files in the directory', async () => {
    writeFileSync(join(tmpDir, 'categories.json'), JSON.stringify({ categories: [] }));
    writeFileSync(join(tmpDir, 'executor.json'), JSON.stringify({ name: 'CI' }));

    const records = await connector.read({ id: 'allure', resultsDir: tmpDir }, engine);
    expect(records).toEqual([]);
  });
});
