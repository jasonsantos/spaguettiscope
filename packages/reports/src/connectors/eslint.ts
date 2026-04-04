import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ConnectorConfig, InferenceEngine } from '@spaguettiscope/core'
import type { Connector, ConnectorCategory } from './interface.js'
import type { NormalizedRunRecord, TestStatus } from '../model/normalized.js'

interface EslintMessage {
  ruleId: string | null
  severity: number
  message: string
  line: number
  column: number
}

interface EslintFileResult {
  filePath: string
  messages: EslintMessage[]
  errorCount: number
  warningCount: number
}

export class EslintConnector implements Connector {
  readonly id = 'eslint'
  readonly category: ConnectorCategory = 'lint'

  async read(config: ConnectorConfig, engine: InferenceEngine): Promise<NormalizedRunRecord[]> {
    const reportFile = (config as Record<string, unknown>).reportFile
    if (typeof reportFile !== 'string') {
      throw new Error('EslintConnector: config.reportFile must be a string path')
    }
    let results: EslintFileResult[]
    try {
      results = JSON.parse(readFileSync(reportFile, 'utf-8')) as EslintFileResult[]
    } catch (err) {
      throw new Error(`EslintConnector: could not read report at ${reportFile}: ${(err as Error).message}`)
    }
    const runAt = new Date().toISOString()
    const records: NormalizedRunRecord[] = []

    for (const result of results) {
      let status: TestStatus
      if (result.errorCount > 0) {
        status = 'failed'
      } else if (result.warningCount > 0) {
        status = 'unknown'
      } else {
        status = 'passed'
      }

      const dimensions = engine.infer(result.filePath)

      records.push({
        id: randomUUID(),
        connectorId: this.id,
        runAt,
        name: basename(result.filePath),
        fullName: result.filePath,
        status,
        duration: 0,
        dimensions,
        source: { file: result.filePath, connectorId: this.id },
        metadata: {
          errorCount: result.errorCount,
          warningCount: result.warningCount,
          messages: result.messages,
        },
      })
    }

    return records
  }
}
