import { readFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ConnectorConfig, InferenceEngine } from '@spaguettiscope/core'
import type { Connector, ConnectorCategory } from './interface.js'
import type { NormalizedRunRecord, TestStatus } from '../model/normalized.js'

const DEFAULT_THRESHOLD = 80

interface LcovRecord {
  sourceFile: string
  linesFound: number
  linesHit: number
}

function parseLcov(content: string): LcovRecord[] {
  const records: LcovRecord[] = []
  let current: Partial<LcovRecord> | null = null

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (line.startsWith('SF:')) {
      current = { sourceFile: line.slice(3), linesFound: 0, linesHit: 0 }
    } else if (line.startsWith('LF:') && current) {
      current.linesFound = parseInt(line.slice(3), 10)
    } else if (line.startsWith('LH:') && current) {
      current.linesHit = parseInt(line.slice(3), 10)
    } else if (line === 'end_of_record' && current?.sourceFile !== undefined) {
      records.push(current as LcovRecord)
      current = null
    }
  }

  return records
}

export class LcovConnector implements Connector {
  readonly id = 'lcov'
  readonly category: ConnectorCategory = 'coverage'

  async read(config: ConnectorConfig, engine: InferenceEngine): Promise<NormalizedRunRecord[]> {
    const cfg = config as Record<string, unknown>
    const lcovFile = cfg.lcovFile
    if (typeof lcovFile !== 'string') {
      throw new Error('LcovConnector: config.lcovFile must be a string path')
    }
    const threshold = typeof cfg.threshold === 'number' ? cfg.threshold : DEFAULT_THRESHOLD

    let content: string
    try {
      content = readFileSync(lcovFile, 'utf-8')
    } catch (err) {
      throw new Error(`LcovConnector: could not read file at ${lcovFile}: ${(err as Error).message}`)
    }
    const lcovRecords = parseLcov(content)
    const runAt = new Date().toISOString()
    const records: NormalizedRunRecord[] = []

    // Resolve relative SF: paths to absolute paths so the inference engine can correctly
    // identify package and other dimensions. Resolution order:
    //   1. config.packageRoot (relative to engine.projectRoot, or absolute) — most explicit
    //   2. The directory containing the lcov file — reasonable default when co-located
    const rawPackageRoot = typeof cfg.packageRoot === 'string' ? cfg.packageRoot : null
    const resolvedPackageRoot = rawPackageRoot
      ? resolve(engine.projectRoot, rawPackageRoot)
      : dirname(resolve(lcovFile))

    for (const lcov of lcovRecords) {
      const absSourceFile = isAbsolute(lcov.sourceFile)
        ? lcov.sourceFile
        : resolve(resolvedPackageRoot, lcov.sourceFile)
      let status: TestStatus
      if (lcov.linesFound === 0) {
        status = 'skipped'
      } else {
        const pct = (lcov.linesHit / lcov.linesFound) * 100
        status = pct >= threshold ? 'passed' : 'failed'
      }

      const dimensions = engine.infer(absSourceFile)

      records.push({
        id: randomUUID(),
        connectorId: this.id,
        runAt,
        name: basename(absSourceFile),
        fullName: absSourceFile,
        status,
        duration: 0,
        dimensions,
        source: { file: absSourceFile, connectorId: this.id },
        metadata: {
          linesFound: lcov.linesFound,
          linesHit: lcov.linesHit,
          coveragePct:
            lcov.linesFound > 0 ? Math.round((lcov.linesHit / lcov.linesFound) * 10000) / 100 : 0,
        },
      })
    }

    return records
  }
}
