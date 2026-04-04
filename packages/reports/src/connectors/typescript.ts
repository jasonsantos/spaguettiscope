import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ConnectorConfig, InferenceEngine } from '@spaguettiscope/core'
import type { Connector } from './interface.js'
import type { NormalizedRunRecord } from '../model/normalized.js'

// Matches: /abs/path/to/file.ts(line,col): error TSxxxx: message
const ERROR_PATTERN = /^(.+?)\((\d+),(\d+)\): error TS\d+: (.+)$/gm

export class TypescriptConnector implements Connector {
  readonly id = 'typescript'

  async read(config: ConnectorConfig, engine: InferenceEngine): Promise<NormalizedRunRecord[]> {
    const outputFile = (config as Record<string, unknown>).outputFile
    if (typeof outputFile !== 'string') {
      throw new Error('TypescriptConnector: config.outputFile must be a string path')
    }
    let content: string
    try {
      content = readFileSync(outputFile, 'utf-8')
    } catch (err) {
      throw new Error(`TypescriptConnector: could not read file at ${outputFile}: ${(err as Error).message}`)
    }
    const runAt = new Date().toISOString()

    // Group error messages by file path
    const errorsByFile = new Map<string, string[]>()
    let match: RegExpExecArray | null

    ERROR_PATTERN.lastIndex = 0
    while ((match = ERROR_PATTERN.exec(content)) !== null) {
      const [, filePath, , , message] = match
      const existing = errorsByFile.get(filePath) ?? []
      existing.push(message)
      errorsByFile.set(filePath, existing)
    }

    const records: NormalizedRunRecord[] = []

    for (const [filePath, errors] of errorsByFile) {
      const dimensions = engine.infer(filePath)

      records.push({
        id: randomUUID(),
        connectorId: this.id,
        runAt,
        name: basename(filePath),
        fullName: filePath,
        status: 'failed',
        duration: 0,
        dimensions,
        source: { file: filePath, connectorId: this.id },
        metadata: { errors },
      })
    }

    return records
  }
}
