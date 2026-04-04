import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { InferenceEngine, defaultDefinitions } from '@spaguettiscope/core'
import { LcovConnector } from '../../connectors/lcov.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, 'fixtures/lcov.info')
const engine = new InferenceEngine(defaultDefinitions, '/project')

describe('LcovConnector', () => {
  it('produces one record per SF entry', async () => {
    const connector = new LcovConnector()
    const records = await connector.read({ id: 'lcov', lcovFile: FIXTURE }, engine)
    expect(records).toHaveLength(4)
  })

  it('marks file as passed when coverage meets default threshold (80%)', async () => {
    const connector = new LcovConnector()
    const records = await connector.read({ id: 'lcov', lcovFile: FIXTURE }, engine)
    // auth.service.ts: 18/20 = 90% → passed
    const passed = records.find(r => r.source.file === '/project/src/auth/auth.service.ts')!
    expect(passed.status).toBe('passed')
  })

  it('marks file as failed when coverage is below threshold', async () => {
    const connector = new LcovConnector()
    const records = await connector.read({ id: 'lcov', lcovFile: FIXTURE }, engine)
    // auth.utils.ts: 5/10 = 50% → failed
    const failed = records.find(r => r.source.file === '/project/src/auth/auth.utils.ts')!
    expect(failed.status).toBe('failed')
  })

  it('marks file as skipped when LF is zero (no executable lines)', async () => {
    const connector = new LcovConnector()
    const records = await connector.read({ id: 'lcov', lcovFile: FIXTURE }, engine)
    // types/index.ts: LF=0 → skipped
    const skipped = records.find(r => r.source.file === '/project/src/types/index.ts')!
    expect(skipped.status).toBe('skipped')
  })

  it('marks fully-uncovered file as failed when LF > 0', async () => {
    const connector = new LcovConnector()
    const records = await connector.read({ id: 'lcov', lcovFile: FIXTURE }, engine)
    // payment.service.ts: 0/15 = 0% → failed
    const failed = records.find(r => r.source.file === '/project/src/payments/payment.service.ts')!
    expect(failed.status).toBe('failed')
  })

  it('stores linesFound and linesHit in metadata', async () => {
    const connector = new LcovConnector()
    const records = await connector.read({ id: 'lcov', lcovFile: FIXTURE }, engine)
    const r = records.find(r => r.source.file === '/project/src/auth/auth.service.ts')!
    const meta = r.metadata as { linesFound: number; linesHit: number }
    expect(meta.linesFound).toBe(20)
    expect(meta.linesHit).toBe(18)
  })

  it('respects custom threshold', async () => {
    const connector = new LcovConnector()
    // auth.service.ts: 90% — should fail at threshold=95
    const records = await connector.read({ id: 'lcov', lcovFile: FIXTURE, threshold: 95 }, engine)
    const r = records.find(r => r.source.file === '/project/src/auth/auth.service.ts')!
    expect(r.status).toBe('failed')
  })
})
