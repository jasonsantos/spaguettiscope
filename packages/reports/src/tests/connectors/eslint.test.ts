import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { InferenceEngine, defaultDefinitions } from '@spaguettiscope/core'
import { EslintConnector } from '../../connectors/eslint.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, 'fixtures/eslint-report.json')
const engine = new InferenceEngine(defaultDefinitions, '/project')

describe('EslintConnector', () => {
  it('produces one record per file', async () => {
    const connector = new EslintConnector()
    const records = await connector.read({ id: 'eslint', reportFile: FIXTURE }, engine)
    expect(records).toHaveLength(3)
  })

  it('marks file as failed when errorCount > 0', async () => {
    const connector = new EslintConnector()
    const records = await connector.read({ id: 'eslint', reportFile: FIXTURE }, engine)
    const failed = records.find(r => r.source.file === '/project/src/auth/auth.service.ts')!
    expect(failed.status).toBe('failed')
  })

  it('marks file as passed when no errors and no warnings', async () => {
    const connector = new EslintConnector()
    const records = await connector.read({ id: 'eslint', reportFile: FIXTURE }, engine)
    const passed = records.find(r => r.source.file === '/project/src/payments/payment.service.ts')!
    expect(passed.status).toBe('passed')
  })

  it('marks file as unknown when only warnings (no errors)', async () => {
    const connector = new EslintConnector()
    const records = await connector.read({ id: 'eslint', reportFile: FIXTURE }, engine)
    const unknown = records.find(r => r.source.file === '/project/src/auth/auth.utils.ts')!
    expect(unknown.status).toBe('unknown')
  })

  it('stores errorCount and warningCount in metadata', async () => {
    const connector = new EslintConnector()
    const records = await connector.read({ id: 'eslint', reportFile: FIXTURE }, engine)
    const failed = records.find(r => r.source.file === '/project/src/auth/auth.service.ts')!
    expect((failed.metadata as { errorCount: number }).errorCount).toBe(1)
  })

  it('sets connectorId to eslint', async () => {
    const connector = new EslintConnector()
    const records = await connector.read({ id: 'eslint', reportFile: FIXTURE }, engine)
    expect(records.every(r => r.connectorId === 'eslint')).toBe(true)
  })
})
