import { describe, it, expect } from 'vitest'
import { aggregateByConnector } from '../../aggregator/index.js'
import type { NormalizedRunRecord } from '../../model/normalized.js'

function makeRecord(overrides: Partial<NormalizedRunRecord>): NormalizedRunRecord {
  return {
    id: 'id',
    connectorId: 'allure',
    runAt: '2026-01-01T00:00:00.000Z',
    name: 'test',
    fullName: 'suite > test',
    status: 'passed',
    duration: 10,
    dimensions: { role: 'business-logic', domain: 'auth' },
    source: { file: '/src/foo.ts', connectorId: 'allure' },
    ...overrides,
  }
}

describe('aggregateByConnector', () => {
  it('returns empty object for empty records', () => {
    expect(aggregateByConnector([], {})).toEqual({})
  })

  it('groups records by connectorId', () => {
    const records = [
      makeRecord({ connectorId: 'allure' }),
      makeRecord({ connectorId: 'playwright' }),
      makeRecord({ connectorId: 'playwright' }),
    ]
    const categoryMap = { allure: 'testing', playwright: 'testing' } as const
    const result = aggregateByConnector(records, categoryMap)
    expect(Object.keys(result).sort()).toEqual(['allure', 'playwright'])
    expect(result['allure'].overall.total).toBe(1)
    expect(result['playwright'].overall.total).toBe(2)
  })

  it('includes category from categoryMap in each group', () => {
    const records = [
      makeRecord({ connectorId: 'lcov', dimensions: {} }),
      makeRecord({ connectorId: 'eslint', dimensions: {} }),
    ]
    const categoryMap = { lcov: 'coverage', eslint: 'lint' } as const
    const result = aggregateByConnector(records, categoryMap)
    expect(result['lcov'].category).toBe('coverage')
    expect(result['eslint'].category).toBe('lint')
  })

  it('defaults category to testing when not in categoryMap', () => {
    const records = [makeRecord({ connectorId: 'vitest', dimensions: {} })]
    const result = aggregateByConnector(records, {})
    expect(result['vitest'].category).toBe('testing')
  })

  it('each group has overall and dimensions', () => {
    const records = [
      makeRecord({ connectorId: 'vitest', status: 'passed' }),
      makeRecord({ connectorId: 'vitest', status: 'failed' }),
    ]
    const result = aggregateByConnector(records, { vitest: 'testing' })
    expect(result['vitest'].overall.passed).toBe(1)
    expect(result['vitest'].overall.failed).toBe(1)
    expect(result['vitest'].dimensions).toHaveProperty('role')
    expect(result['vitest'].dimensions).toHaveProperty('domain')
  })
})
