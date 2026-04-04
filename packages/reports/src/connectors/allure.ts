import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { InferenceEngine, ConnectorConfig } from '@spaguettiscope/core';
import type { Connector } from './interface.js';
import type { NormalizedRunRecord, TestStatus } from '../model/normalized.js';

interface AllureLabel {
  name: string;
  value: string;
}

interface AllureResult {
  uuid: string;
  name: string;
  fullName?: string;
  status: string;
  start?: number;
  stop?: number;
  labels?: AllureLabel[];
}

const ALLURE_STATUS_MAP: Record<string, TestStatus> = {
  passed: 'passed',
  failed: 'failed',
  broken: 'broken',
  skipped: 'skipped',
  unknown: 'unknown',
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export class AllureConnector implements Connector {
  readonly id = 'allure';

  async read(config: ConnectorConfig, engine: InferenceEngine): Promise<NormalizedRunRecord[]> {
    const { resultsDir } = config;
    if (typeof resultsDir !== 'string') {
      throw new Error('AllureConnector: config.resultsDir must be a string path');
    }
    const resultFiles = readdirSync(resultsDir).filter(f => f.endsWith('-result.json'));
    const records: NormalizedRunRecord[] = [];

    for (const file of resultFiles) {
      const filePath = join(resultsDir, file);
      let raw: AllureResult;

      try {
        raw = JSON.parse(readFileSync(filePath, 'utf-8')) as AllureResult;
      } catch {
        continue;
      }

      const labels: AllureLabel[] = raw.labels ?? [];
      const getLabel = (name: string) => labels.find(l => l.name === name)?.value;

      const sourceFile = getLabel('testSourceFile');
      const feature = getLabel('feature');

      let dimensions = sourceFile
        ? engine.infer(sourceFile)
        : {};

      // If domain not inferred from path, fall back to feature label
      if (!dimensions.domain && feature) {
        dimensions = { ...dimensions, domain: slugify(feature) };
      }

      records.push({
        id: raw.uuid ?? randomUUID(),
        connectorId: this.id,
        runAt: raw.start ? new Date(raw.start).toISOString() : new Date().toISOString(),
        name: raw.name,
        fullName: raw.fullName ?? raw.name,
        status: ALLURE_STATUS_MAP[raw.status] ?? 'unknown',
        duration: raw.start && raw.stop ? raw.stop - raw.start : 0,
        dimensions,
        source: { file: filePath, connectorId: this.id },
        metadata: { labels },
      });
    }

    return records;
  }
}
