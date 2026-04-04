import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { ConnectorConfig, InferenceEngine } from '@spaguettiscope/core'
import type { Connector, ConnectorCategory } from './interface.js'
import type { NormalizedRunRecord, TestStatus } from '../model/normalized.js'

interface VitestAssertionResult {
  ancestorTitles: string[]
  fullName: string
  status: 'passed' | 'failed' | 'pending' | 'skipped' | 'todo'
  title: string
  duration: number | null
  failureMessages: string[]
}

interface VitestTestResult {
  /** Vitest JSON reporter uses 'name' for the file path */
  name: string
  testFilePath?: string
  status: 'passed' | 'failed' | 'skipped'
  startTime: number
  endTime: number
  assertionResults: VitestAssertionResult[]
}

interface VitestReport {
  testResults: VitestTestResult[]
  startTime: number
  success: boolean
}

const STATUS_MAP: Record<VitestAssertionResult['status'], TestStatus> = {
  passed: 'passed',
  failed: 'failed',
  pending: 'skipped',
  skipped: 'skipped',
  todo: 'skipped',
}

export class VitestConnector implements Connector {
  readonly id = 'vitest'
  readonly category: ConnectorCategory = 'testing'

  async read(config: ConnectorConfig, engine: InferenceEngine): Promise<NormalizedRunRecord[]> {
    const reportFile = (config as Record<string, unknown>).reportFile
    if (typeof reportFile !== 'string') {
      throw new Error('VitestConnector: config.reportFile must be a string path')
    }
    let report: VitestReport
    try {
      report = JSON.parse(readFileSync(reportFile, 'utf-8')) as VitestReport
    } catch (err) {
      throw new Error(`VitestConnector: could not read report at ${reportFile}: ${(err as Error).message}`)
    }
    const records: NormalizedRunRecord[] = []

    for (const suite of report.testResults) {
      const filePath = suite.name ?? suite.testFilePath ?? ''
      const runAt = new Date(suite.startTime).toISOString()
      const dimensions = engine.infer(filePath)

      for (const assertion of suite.assertionResults) {
        records.push({
          id: randomUUID(),
          connectorId: this.id,
          runAt,
          name: assertion.title,
          fullName: assertion.fullName,
          status: STATUS_MAP[assertion.status] ?? 'unknown',
          duration: assertion.duration ?? 0,
          dimensions,
          source: { file: filePath, connectorId: this.id },
          metadata: { failureMessages: assertion.failureMessages },
        })
      }
    }

    return records
  }
}
