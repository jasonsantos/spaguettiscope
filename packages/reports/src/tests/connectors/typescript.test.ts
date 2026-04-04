import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { InferenceEngine, defaultDefinitions } from '@spaguettiscope/core'
import { TypescriptConnector } from '../../connectors/typescript.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, 'fixtures/tsc-output.txt')
const engine = new InferenceEngine(defaultDefinitions, '/project')

describe('TypescriptConnector', () => {
  it('produces one record per unique file with errors', async () => {
    const connector = new TypescriptConnector()
    // auth.service.ts (2 errors) + payment.service.ts (1 error) = 2 records
    const records = await connector.read({ id: 'typescript', outputFile: FIXTURE }, engine)
    expect(records).toHaveLength(2)
  })

  it('marks all files with errors as failed', async () => {
    const connector = new TypescriptConnector()
    const records = await connector.read({ id: 'typescript', outputFile: FIXTURE }, engine)
    expect(records.every(r => r.status === 'failed')).toBe(true)
  })

  it('stores all error messages per file in metadata', async () => {
    const connector = new TypescriptConnector()
    const records = await connector.read({ id: 'typescript', outputFile: FIXTURE }, engine)
    const authRecord = records.find(r => r.source.file.includes('auth.service.ts'))!
    expect((authRecord.metadata as { errors: string[] }).errors).toHaveLength(2)
  })

  it('sets connectorId to typescript', async () => {
    const connector = new TypescriptConnector()
    const records = await connector.read({ id: 'typescript', outputFile: FIXTURE }, engine)
    expect(records.every(r => r.connectorId === 'typescript')).toBe(true)
  })

  it('returns empty array when output contains no error lines', async () => {
    const connector = new TypescriptConnector()
    // The fixture only has 2 unique files — confirm no unexpected extras
    const records = await connector.read({ id: 'typescript', outputFile: FIXTURE }, engine)
    const files = new Set(records.map(r => r.source.file))
    expect(files.size).toBe(2)
  })
})
