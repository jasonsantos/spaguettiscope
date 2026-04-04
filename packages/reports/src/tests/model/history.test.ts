import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendHistory, readHistory } from '../../model/history.js';
import type { HistoryEntry } from '../../model/history.js';

describe('history', () => {
  let tmpDir: string;
  let historyFile: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `history-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    historyFile = join(tmpDir, '.spaguetti-history.jsonl');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const entry: HistoryEntry = {
    runAt: '2026-04-03T12:00:00.000Z',
    connectors: ['allure'],
    overall: { total: 10, passed: 9, failed: 1, skipped: 0, broken: 0, unknown: 0, passRate: 0.9 },
    dimensionSummary: {
      role: { repository: { total: 5, passed: 4, failed: 1 } },
    },
  };

  it('creates the file if it does not exist', async () => {
    await appendHistory(historyFile, entry);
    expect(existsSync(historyFile)).toBe(true);
  });

  it('writes one JSONL line per entry', async () => {
    await appendHistory(historyFile, entry);
    await appendHistory(historyFile, { ...entry, runAt: '2026-04-04T12:00:00.000Z' });

    const lines = readFileSync(historyFile, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('readHistory returns entries in chronological order', async () => {
    await appendHistory(historyFile, { ...entry, runAt: '2026-04-04T12:00:00.000Z' });
    await appendHistory(historyFile, { ...entry, runAt: '2026-04-03T12:00:00.000Z' });

    const entries = await readHistory(historyFile);
    expect(entries[0].runAt).toBe('2026-04-03T12:00:00.000Z');
    expect(entries[1].runAt).toBe('2026-04-04T12:00:00.000Z');
  });

  it('readHistory returns empty array when file does not exist', async () => {
    const entries = await readHistory(historyFile);
    expect(entries).toEqual([]);
  });
});
