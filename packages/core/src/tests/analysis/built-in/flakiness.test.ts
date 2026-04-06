import { describe, it, expect } from 'vitest'
import { flakyTestRule } from '../../../analysis/built-in/flakiness.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { AnalysisContext, TestRecord } from '../../../analysis/types.js'

function makeCtx(): AnalysisContext {
  return { topology: new Map(), cache: createIntermediateCache() }
}

function makeRecord(id: string, historyId: string, status: TestRecord['status']): TestRecord {
  return { id, historyId, status, dimensions: { domain: 'auth' } }
}

describe('flaky-test rule', () => {
  it('emits no finding on first pass (only one data point)', () => {
    const ctx = makeCtx()
    const record = makeRecord('r1', 'h1', 'failed')
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits flakiness finding when failure rate is between 0.1 and 0.9', () => {
    const ctx = makeCtx()
    // Simulate 5 previous runs: 3 passed, 2 failed → ratio 0.4
    ctx.cache.set('flakiness-index', { h1: { pass: 3, fail: 2, total: 5 } })
    const record = makeRecord('r1', 'h1', 'passed')
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe('flakiness')
    expect(findings[0].value).toBeCloseTo(2 / 5)
  })

  it('emits no finding when failure rate is below 0.1 (reliably passing)', () => {
    const ctx = makeCtx()
    ctx.cache.set('flakiness-index', { h1: { pass: 10, fail: 0, total: 10 } })
    const record = makeRecord('r1', 'h1', 'passed')
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding when failure rate is above 0.9 (reliably failing)', () => {
    const ctx = makeCtx()
    ctx.cache.set('flakiness-index', { h1: { pass: 0, fail: 10, total: 10 } })
    const record = makeRecord('r1', 'h1', 'failed')
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(0)
  })

  it('updates the cache with each run result', () => {
    const ctx = makeCtx()
    flakyTestRule.run(makeRecord('r1', 'h1', 'passed'), ctx)
    flakyTestRule.run(makeRecord('r2', 'h1', 'failed'), ctx)
    const index =
      ctx.cache.get<Record<string, { pass: number; fail: number; total: number }>>(
        'flakiness-index'
      )
    expect(index?.h1.pass).toBe(1)
    expect(index?.h1.fail).toBe(1)
    expect(index?.h1.total).toBe(2)
  })

  it('emits no finding when record has no historyId', () => {
    const ctx = makeCtx()
    const record: TestRecord = { id: 'r1', status: 'failed', dimensions: {} }
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(0)
  })
})
