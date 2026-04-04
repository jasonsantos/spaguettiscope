import type { DimensionName } from '@spaguettiscope/core';
import type { NormalizedRunRecord, TestStatus } from '../model/normalized.js';

export interface AggregatedSlice {
  dimension: DimensionName;
  value: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  broken: number;
  unknown: number;
  passRate: number;
}

export interface OverallSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  broken: number;
  unknown: number;
  passRate: number;
}

export interface AggregationResult {
  overall: OverallSummary;
  [dimension: string]: AggregatedSlice[] | OverallSummary;
}

function emptyStatusCounts() {
  return { passed: 0, failed: 0, skipped: 0, broken: 0, unknown: 0 };
}

export function aggregateByDimension(
  records: NormalizedRunRecord[],
  dimension: DimensionName
): AggregatedSlice[] {
  const map = new Map<string, ReturnType<typeof emptyStatusCounts>>();

  for (const record of records) {
    const value = record.dimensions[dimension];
    if (value === undefined) continue;

    if (!map.has(value)) map.set(value, emptyStatusCounts());
    const counts = map.get(value)!;
    counts[record.status as TestStatus]++;
  }

  return Array.from(map.entries()).map(([value, counts]) => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      dimension,
      value,
      total,
      ...counts,
      passRate: total > 0 ? counts.passed / total : 0,
    };
  });
}

export function aggregateAll(records: NormalizedRunRecord[]): AggregationResult {
  // Collect all dimension names present in the record set
  const dimensionNames = new Set<string>();
  for (const record of records) {
    for (const name of Object.keys(record.dimensions)) {
      dimensionNames.add(name);
    }
  }

  const overall: OverallSummary = { ...emptyStatusCounts(), total: 0, passRate: 0 };
  for (const record of records) {
    overall.total++;
    overall[record.status as TestStatus]++;
  }
  overall.passRate = overall.total > 0 ? overall.passed / overall.total : 0;

  const result: AggregationResult = { overall };

  for (const name of dimensionNames) {
    result[name] = aggregateByDimension(records, name);
  }

  return result;
}
