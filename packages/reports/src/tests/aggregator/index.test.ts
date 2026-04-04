import { describe, it, expect } from 'vitest';
import { aggregateByDimension, aggregateAll } from '../../aggregator/index.js';
import type { NormalizedRunRecord } from '../../model/normalized.js';

const makeRecord = (
  id: string,
  status: NormalizedRunRecord['status'],
  dimensions: Record<string, string>
): NormalizedRunRecord => ({
  id,
  connectorId: 'allure',
  runAt: new Date().toISOString(),
  name: `Test ${id}`,
  fullName: `Suite > Test ${id}`,
  status,
  duration: 100,
  dimensions,
  source: { file: 'file.json', connectorId: 'allure' },
});

const records: NormalizedRunRecord[] = [
  makeRecord('1', 'passed', { role: 'repository', domain: 'admin' }),
  makeRecord('2', 'passed', { role: 'repository', domain: 'auth' }),
  makeRecord('3', 'failed', { role: 'repository', domain: 'admin' }),
  makeRecord('4', 'passed', { role: 'hook', domain: 'auth' }),
  makeRecord('5', 'skipped', { role: 'hook' }),
];

describe('aggregateByDimension', () => {
  it('groups records by role and computes counts', () => {
    const slices = aggregateByDimension(records, 'role');
    const repository = slices.find(s => s.value === 'repository');
    const hook = slices.find(s => s.value === 'hook');

    expect(repository?.total).toBe(3);
    expect(repository?.passed).toBe(2);
    expect(repository?.failed).toBe(1);

    expect(hook?.total).toBe(2);
    expect(hook?.passed).toBe(1);
    expect(hook?.skipped).toBe(1);
  });

  it('computes passRate as passed / total', () => {
    const slices = aggregateByDimension(records, 'role');
    const repository = slices.find(s => s.value === 'repository')!;
    expect(repository.passRate).toBeCloseTo(2 / 3);
  });

  it('returns empty array for a dimension no records have', () => {
    const slices = aggregateByDimension(records, 'package');
    expect(slices).toEqual([]);
  });
});

describe('aggregateAll', () => {
  it('returns aggregations for every dimension present in records', () => {
    const result = aggregateAll(records);
    expect(result).toHaveProperty('role');
    expect(result).toHaveProperty('domain');
    expect(result).not.toHaveProperty('package');
  });

  it('includes overall totals', () => {
    const result = aggregateAll(records);
    expect(result.overall.total).toBe(5);
    expect(result.overall.passed).toBe(3);
    expect(result.overall.failed).toBe(1);
    expect(result.overall.skipped).toBe(1);
  });
});
