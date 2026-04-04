import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { InferenceEngine, defaultDefinitions } from '@spaguettiscope/core'
import { VitestConnector } from '../../connectors/vitest.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, 'fixtures/vitest-report.json')
const engine = new InferenceEngine(defaultDefinitions, '/project')

describe('VitestConnector', () => {
  it('reads all assertion results', async () => {
    const connector = new VitestConnector()
    const records = await connector.read({ id: 'vitest', reportFile: FIXTURE }, engine)
    expect(records).toHaveLength(3)
  })

  it('maps vitest statuses to normalized statuses', async () => {
    const connector = new VitestConnector()
    const records = await connector.read({ id: 'vitest', reportFile: FIXTURE }, engine)
    const statuses = records.map(r => r.status).sort()
    expect(statuses).toEqual(['failed', 'passed', 'skipped'])
  })

  it('sets connectorId to vitest', async () => {
    const connector = new VitestConnector()
    const records = await connector.read({ id: 'vitest', reportFile: FIXTURE }, engine)
    expect(records.every(r => r.connectorId === 'vitest')).toBe(true)
  })

  it('sets source.file to the test file path', async () => {
    const connector = new VitestConnector()
    const records = await connector.read({ id: 'vitest', reportFile: FIXTURE }, engine)
    expect(records.every(r => r.source.file.includes('auth.service.test.ts'))).toBe(true)
  })

  it('uses fullName from assertion result', async () => {
    const connector = new VitestConnector()
    const records = await connector.read({ id: 'vitest', reportFile: FIXTURE }, engine)
    const passed = records.find(r => r.status === 'passed')!
    expect(passed.fullName).toBe('AuthService > validates token')
  })
})
