import type { AnalysisRule, TestRecord, Finding } from '../types.js'

interface FlakinessEntry {
  pass: number
  fail: number
  total: number
}

type FlakinessIndex = Record<string, FlakinessEntry>

const FLAKY_MIN = 0.1
const FLAKY_MAX = 0.9

export const flakyTestRule: AnalysisRule<'records'> = {
  id: 'built-in:flaky-test',
  severity: 'warning',
  needs: ['testRecords'],
  corpus: 'records',
  run(record: TestRecord, ctx): Finding[] {
    if (!record.historyId) return []

    // Load or initialise the flakiness index from cache.
    const index = (ctx.cache.get<FlakinessIndex>('flakiness-index') ?? {}) as FlakinessIndex
    const entry: FlakinessEntry = index[record.historyId] ?? { pass: 0, fail: 0, total: 0 }

    // Check for flakiness before recording current run (so first-run is never flagged).
    let finding: Finding | null = null
    if (entry.total > 0) {
      const failRatio = entry.fail / entry.total
      if (failRatio > FLAKY_MIN && failRatio < FLAKY_MAX) {
        finding = {
          ruleId: 'built-in:flaky-test',
          kind: 'flakiness',
          severity: 'warning',
          subject: { type: 'slice', dimensions: record.dimensions },
          dimensions: record.dimensions,
          value: failRatio,
          message: `Test is flaky — fails ${Math.round(failRatio * 100)}% of runs`,
        }
      }
    }

    // Update index with current run.
    const isCountable = record.status === 'passed' || record.status === 'failed' || record.status === 'broken'
    if (!isCountable) return finding ? [finding] : []

    const isPassing = record.status === 'passed'
    index[record.historyId] = {
      pass: entry.pass + (isPassing ? 1 : 0),
      fail: entry.fail + (isPassing ? 0 : 1),
      total: entry.total + 1,
    }
    ctx.cache.set('flakiness-index', index)

    return finding ? [finding] : []
  },
}
