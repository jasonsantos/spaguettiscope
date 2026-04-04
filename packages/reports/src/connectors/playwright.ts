import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { ConnectorConfig, InferenceEngine } from '@spaguettiscope/core';
import type { Connector } from './interface.js';
import type { NormalizedRunRecord, TestStatus } from '../model/normalized.js';

interface PlaywrightResult {
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  duration: number;
  retry: number;
  startTime: string;
}

interface PlaywrightTest {
  timeout: number;
  projectName: string;
  results: PlaywrightResult[];
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
}

interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests: PlaywrightTest[];
}

interface PlaywrightSuite {
  title: string;
  file?: string;
  specs: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  config: { rootDir: string };
  suites: PlaywrightSuite[];
  stats: { startTime: string; duration: number };
}

const STATUS_MAP: Record<PlaywrightTest['status'], TestStatus> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'broken',
  skipped: 'skipped',
};

function collectSpecs(
  suite: PlaywrightSuite,
  inheritedFile: string
): Array<{ spec: PlaywrightSpec; file: string }> {
  const file = suite.file ?? inheritedFile;
  const own = suite.specs.map(spec => ({ spec, file }));
  const nested = (suite.suites ?? []).flatMap(s => collectSpecs(s, file));
  return [...own, ...nested];
}

export class PlaywrightConnector implements Connector {
  readonly id = 'playwright';

  async read(config: ConnectorConfig, engine: InferenceEngine): Promise<NormalizedRunRecord[]> {
    const { reportFile } = config as { reportFile: string };
    const report: PlaywrightReport = JSON.parse(readFileSync(reportFile, 'utf-8'));
    const records: NormalizedRunRecord[] = [];

    for (const topSuite of report.suites) {
      const items = collectSpecs(topSuite, topSuite.file ?? topSuite.title);

      for (const { spec, file } of items) {
        const test = spec.tests[0];
        if (!test) continue;

        const lastResult = test.results[test.results.length - 1];
        const runAt = lastResult?.startTime ?? report.stats.startTime;
        const duration = lastResult?.duration ?? 0;
        const status: TestStatus = STATUS_MAP[test.status] ?? 'unknown';
        const dimensions = engine.infer(file);

        records.push({
          id: randomUUID(),
          connectorId: this.id,
          runAt,
          name: spec.title,
          fullName: `${topSuite.title} > ${spec.title}`,
          status,
          duration,
          dimensions,
          source: { file, connectorId: this.id },
          metadata: { projectName: test.projectName },
        });
      }
    }

    return records;
  }
}
