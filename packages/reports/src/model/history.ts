import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { OverallSummary } from '../aggregator/index.js';

export interface HistoryDimensionSlice {
  total: number;
  passed: number;
  failed: number;
}

export interface HistoryEntry {
  runAt: string;
  connectors: string[];
  overall: OverallSummary;
  dimensionSummary: Record<string, Record<string, HistoryDimensionSlice>>;
}

export async function appendHistory(filePath: string, entry: HistoryEntry): Promise<void> {
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
}

export async function readHistory(filePath: string): Promise<HistoryEntry[]> {
  if (!existsSync(filePath)) return [];

  const lines = readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(l => l.trim().length > 0);

  const entries: HistoryEntry[] = lines
    .map(line => {
      try {
        return JSON.parse(line) as HistoryEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is HistoryEntry => e !== null);

  return entries.sort((a, b) => a.runAt.localeCompare(b.runAt));
}
