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

  it('writes index.html and data/summary.json when ci flag is false', async () => {
    const allureDir = join(tmpDir, 'allure-results')
    mkdirSync(allureDir)
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
      })
    )
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ dashboard: { connectors: [{ id: 'allure', resultsDir: allureDir }] } })
    )
    const outputDir = join(tmpDir, 'reports')
    await runDashboard({ ci: false, output: outputDir, projectRoot: tmpDir })

    expect(existsSync(join(outputDir, 'index.html'))).toBe(true)
    expect(existsSync(join(outputDir, 'data', 'summary.json'))).toBe(true)
    expect(existsSync(join(outputDir, 'data', 'records.json'))).toBe(true)

    const summary = JSON.parse(readFileSync(join(outputDir, 'data', 'summary.json'), 'utf-8'))
    expect(summary.overall.total).toBe(1)
    expect(summary.overall.passed).toBe(1)

    const records = JSON.parse(readFileSync(join(outputDir, 'data', 'records.json'), 'utf-8'))
    expect(Array.isArray(records)).toBe(true)
    expect(records).toHaveLength(1)
    expect(records[0].name).toBe('sample test')
  });

  it('applies skeleton attributes to records', async () => {
    const allureDir = join(tmpDir, 'allure-results')
    mkdirSync(allureDir)
    writeFileSync(
      join(allureDir, 'test-001-result.json'),
      JSON.stringify({
        uuid: 'test-001',
        name: 'checkout test',
        fullName: 'src/checkout/checkout.test.ts#Suite checkout test',
        status: 'passed',
        start: Date.now() - 500,
        stop: Date.now(),
        labels: [{ name: 'testSourceFile', value: 'src/checkout/checkout.test.ts' }],
      })
    )
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ dashboard: { connectors: [{ id: 'allure', resultsDir: allureDir }] } })
    )
    // Write a skeleton that assigns domain=checkout to src/checkout/**
    writeFileSync(
      join(tmpDir, 'spaguettiscope.skeleton.yaml'),
      `- attributes:\n    domain: checkout\n    layer: bff\n  paths:\n    - src/checkout/**\n`
    )

    const outputDir = join(tmpDir, 'reports')
    await runDashboard({ ci: false, output: outputDir, projectRoot: tmpDir })

    const records = JSON.parse(readFileSync(join(outputDir, 'data', 'records.json'), 'utf-8'))
    const record = records[0]
    expect(record.dimensions.domain).toBe('checkout')
    expect(record.dimensions.layer).toBe('bff')
  });

  it('writes history file and reads it back on second run', async () => {
    const allureDir = join(tmpDir, 'allure-results')
    mkdirSync(allureDir)
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
      })
    )
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ dashboard: { connectors: [{ id: 'allure', resultsDir: allureDir }] } })
    )
    const outputDir = join(tmpDir, 'reports')
    // First run — history file doesn't exist yet
    await runDashboard({ ci: true, output: outputDir, projectRoot: tmpDir })
    const historyPath = join(tmpDir, 'reports', '.spaguetti-history.jsonl')
    expect(existsSync(historyPath)).toBe(true)
    // Second run — history file exists; should be read back
    await runDashboard({ ci: true, output: outputDir, projectRoot: tmpDir })
    const lines = readFileSync(historyPath, 'utf-8').trim().split('\n')
    expect(lines).toHaveLength(2)
  })

  it('runs without error when skeleton file does not exist', async () => {
    const allureDir = join(tmpDir, 'allure-results')
    mkdirSync(allureDir)
    writeFileSync(
      join(allureDir, 'test-001-result.json'),
      JSON.stringify({
        uuid: 'test-001',
        name: 'test',
        fullName: 'src/test.ts#test',
        status: 'passed',
        start: Date.now() - 100,
        stop: Date.now(),
      })
    )
    writeFileSync(
      join(tmpDir, 'spaguettiscope.config.json'),
      JSON.stringify({ dashboard: { connectors: [{ id: 'allure', resultsDir: allureDir }] } })
    )
    // No skeleton file written — should not crash

    const outputDir = join(tmpDir, 'reports')
    await expect(runDashboard({ ci: false, output: outputDir, projectRoot: tmpDir })).resolves.not.toThrow()
  })

  describe('inherit-from-import pass', () => {
    it('test record inherits attributes from imported source file', async () => {
      // Create source file
      mkdirSync(join(tmpDir, 'src'), { recursive: true })
      writeFileSync(join(tmpDir, 'src', 'payments.ts'), `export function pay() {}`)
      // Create test file that imports from payments
      writeFileSync(
        join(tmpDir, 'src', 'payments.test.ts'),
        `import { pay } from './payments'\ntest('pay', () => {})`
      )
      // Create skeleton that assigns domain=payments to src/payments.ts
      writeFileSync(
        join(tmpDir, 'spaguettiscope.skeleton.yaml'),
        `- attributes:\n    domain: payments\n  paths:\n    - src/payments.ts\n`
      )
      // Set up allure connector with a record for the test file
      const allureDir = join(tmpDir, 'allure-results')
      mkdirSync(allureDir)
      writeFileSync(
        join(allureDir, 'test-001-result.json'),
        JSON.stringify({
          uuid: 'test-001',
          name: 'pay',
          fullName: 'src/payments.test.ts#pay',
          status: 'passed',
          start: Date.now() - 100,
          stop: Date.now(),
          labels: [
            { name: 'testSourceFile', value: 'src/payments.test.ts' },
          ],
        })
      )
      writeFileSync(
        join(tmpDir, 'spaguettiscope.config.json'),
        JSON.stringify({ dashboard: { connectors: [{ id: 'allure', resultsDir: allureDir }] } })
      )

      const outputDir = join(tmpDir, 'reports')
      await runDashboard({ ci: false, output: outputDir, projectRoot: tmpDir })

      const records = JSON.parse(readFileSync(join(outputDir, 'data', 'records.json'), 'utf-8'))
      const record = records[0]
      expect(record.dimensions.domain).toBe('payments')
    })

    it('direct skeleton annotation wins over inherited attribute', async () => {
      // Create source file with domain=payments
      mkdirSync(join(tmpDir, 'src'), { recursive: true })
      writeFileSync(join(tmpDir, 'src', 'payments.ts'), `export function pay() {}`)
      // Create test file that imports from payments but is directly annotated domain=auth
      writeFileSync(
        join(tmpDir, 'src', 'payments.test.ts'),
        `import { pay } from './payments'\ntest('pay', () => {})`
      )
      // Skeleton: test file → domain=auth, source file → domain=payments
      writeFileSync(
        join(tmpDir, 'spaguettiscope.skeleton.yaml'),
        `- attributes:\n    domain: auth\n  paths:\n    - src/payments.test.ts\n- attributes:\n    domain: payments\n  paths:\n    - src/payments.ts\n`
      )
      const allureDir = join(tmpDir, 'allure-results')
      mkdirSync(allureDir)
      writeFileSync(
        join(allureDir, 'test-001-result.json'),
        JSON.stringify({
          uuid: 'test-001',
          name: 'pay',
          fullName: 'src/payments.test.ts#pay',
          status: 'passed',
          start: Date.now() - 100,
          stop: Date.now(),
          labels: [
            { name: 'testSourceFile', value: 'src/payments.test.ts' },
          ],
        })
      )
      writeFileSync(
        join(tmpDir, 'spaguettiscope.config.json'),
        JSON.stringify({ dashboard: { connectors: [{ id: 'allure', resultsDir: allureDir }] } })
      )

      const outputDir = join(tmpDir, 'reports')
      await runDashboard({ ci: false, output: outputDir, projectRoot: tmpDir })

      const records = JSON.parse(readFileSync(join(outputDir, 'data', 'records.json'), 'utf-8'))
      const record = records[0]
      // Direct annotation wins — should remain auth, not be overwritten with payments
      expect(record.dimensions.domain).toBe('auth')
    })

    it('skips inherit-from-import when disabled in config', async () => {
      // Create source file with domain=payments
      mkdirSync(join(tmpDir, 'src'), { recursive: true })
      writeFileSync(join(tmpDir, 'src', 'payments.ts'), `export function pay() {}`)
      // Create test file that imports from payments (no direct skeleton annotation on test file)
      writeFileSync(
        join(tmpDir, 'src', 'payments.test.ts'),
        `import { pay } from './payments'\ntest('pay', () => {})`
      )
      // Skeleton only annotates source file
      writeFileSync(
        join(tmpDir, 'spaguettiscope.skeleton.yaml'),
        `- attributes:\n    domain: payments\n  paths:\n    - src/payments.ts\n`
      )
      const allureDir = join(tmpDir, 'allure-results')
      mkdirSync(allureDir)
      writeFileSync(
        join(allureDir, 'test-001-result.json'),
        JSON.stringify({
          uuid: 'test-001',
          name: 'pay',
          fullName: 'src/payments.test.ts#pay',
          status: 'passed',
          start: Date.now() - 100,
          stop: Date.now(),
          labels: [
            { name: 'testSourceFile', value: 'src/payments.test.ts' },
          ],
        })
      )
      // Config disables inherit-from-import
      writeFileSync(
        join(tmpDir, 'spaguettiscope.config.json'),
        JSON.stringify({
          dashboard: { connectors: [{ id: 'allure', resultsDir: allureDir }] },
          rules: { disable: ['inherit-from-import'] },
        })
      )

      const outputDir = join(tmpDir, 'reports')
      await runDashboard({ ci: false, output: outputDir, projectRoot: tmpDir })

      const records = JSON.parse(readFileSync(join(outputDir, 'data', 'records.json'), 'utf-8'))
      const record = records[0]
      // Should NOT have inherited domain from payments.ts
      expect(record.dimensions.domain).toBeUndefined()
    })
  })
});
