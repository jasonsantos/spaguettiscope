import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeDashboardData } from '../../renderer/inject.js'
import type { DashboardData } from '../../model/dashboard.js'
import type { Finding } from '../../model/findings.js'

function makeData(): DashboardData {
  return {
    generatedAt: new Date().toISOString(),
    connectors: [],
    overall: { total: 0, passed: 0, failed: 0, skipped: 0, broken: 0, unknown: 0, passRate: 1 },
    dimensions: {},
    history: [],
    byConnector: {},
  }
}

const sampleFinding: Finding = {
  ruleId: 'test-rule',
  kind: 'violation',
  severity: 'error',
  subject: { type: 'file', path: 'src/foo.ts' },
  dimensions: { layer: 'bff' },
  message: 'test finding',
}

describe('writeDashboardData', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-inject-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes findings.json when findings are provided', () => {
    writeDashboardData(dir, makeData(), [], [sampleFinding])
    const raw = JSON.parse(readFileSync(join(dir, 'data', 'findings.json'), 'utf-8'))
    expect(raw).toHaveLength(1)
    expect(raw[0].ruleId).toBe('test-rule')
  })

  it('writes an empty findings.json when no findings are provided', () => {
    writeDashboardData(dir, makeData(), [])
    const raw = JSON.parse(readFileSync(join(dir, 'data', 'findings.json'), 'utf-8'))
    expect(raw).toEqual([])
  })
})
