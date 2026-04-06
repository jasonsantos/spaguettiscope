import { describe, it, expect } from 'vitest'
import { runAnalysis } from '../../analysis/runner.js'
import { createIntermediateCache } from '../../analysis/intermediates.js'
import type { AnalysisRule, Finding, FileItem, EdgeItem } from '../../analysis/types.js'
import type { ImportGraph } from '../../graph/index.js'
import type { DimensionSet } from '../../classification/model.js'

function makeTopology(entries: [string, DimensionSet][]): Map<string, DimensionSet> {
  return new Map(entries)
}

describe('runAnalysis', () => {
  it('returns empty findings when no rules provided', () => {
    const result = runAnalysis({
      files: ['src/auth.ts'],
      topology: makeTopology([['src/auth.ts', { role: 'page' }]]),
      rules: [],
      cache: createIntermediateCache(),
    })
    expect(result).toHaveLength(0)
  })

  it('runs a files-corpus rule against each file', () => {
    const rule: AnalysisRule<'files'> = {
      id: 'test-rule',
      severity: 'warning',
      needs: [],
      corpus: 'files',
      run(item: FileItem) {
        if (item.dimensions.role === 'page') {
          return [
            {
              ruleId: 'test-rule',
              kind: 'metric',
              severity: 'warning',
              subject: { type: 'file', path: item.file },
              dimensions: item.dimensions,
              message: 'found a page',
            },
          ]
        }
        return []
      },
    }

    const result = runAnalysis({
      files: ['src/auth.ts', 'src/util.ts'],
      topology: makeTopology([
        ['src/auth.ts', { role: 'page' }],
        ['src/util.ts', { role: 'hook' }],
      ]),
      rules: [rule],
      cache: createIntermediateCache(),
    })

    expect(result).toHaveLength(1)
    expect(result[0].subject).toEqual({ type: 'file', path: 'src/auth.ts' })
  })

  it('runs an edges-corpus rule against each import edge', () => {
    const importGraph: ImportGraph = {
      imports: new Map([['src/client.tsx', new Set(['src/server.ts'])]]),
      importedBy: new Map([['src/server.ts', new Set(['src/client.tsx'])]]),
    }

    const rule: AnalysisRule<'edges'> = {
      id: 'edge-rule',
      severity: 'error',
      needs: ['importGraph'],
      corpus: 'edges',
      run(item: EdgeItem) {
        if (item.from.dimensions.layer === 'client' && item.to.dimensions.layer === 'server') {
          return [
            {
              ruleId: 'edge-rule',
              kind: 'violation',
              severity: 'error',
              subject: { type: 'edge', from: item.from.file, to: item.to.file },
              dimensions: item.from.dimensions,
              message: 'client imports server',
            },
          ]
        }
        return []
      },
    }

    const result = runAnalysis({
      files: ['src/client.tsx', 'src/server.ts'],
      topology: makeTopology([
        ['src/client.tsx', { layer: 'client' }],
        ['src/server.ts', { layer: 'server' }],
      ]),
      rules: [rule],
      importGraph,
      cache: createIntermediateCache(),
    })

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('violation')
    expect(result[0].subject).toEqual({ type: 'edge', from: 'src/client.tsx', to: 'src/server.ts' })
  })

  it('runs a records-corpus rule against each test record', () => {
    const rule: AnalysisRule<'records'> = {
      id: 'flaky-rule',
      severity: 'warning',
      needs: ['testRecords'],
      corpus: 'records',
      run(item) {
        if (item.status === 'broken') {
          return [
            {
              ruleId: 'flaky-rule',
              kind: 'flakiness',
              severity: 'warning',
              subject: { type: 'slice', dimensions: item.dimensions },
              dimensions: item.dimensions,
              message: 'broken test',
            },
          ]
        }
        return []
      },
    }

    const result = runAnalysis({
      files: [],
      topology: new Map(),
      rules: [rule],
      testRecords: [
        { id: '1', status: 'passed', dimensions: {} },
        { id: '2', status: 'broken', dimensions: { domain: 'auth' } },
      ],
      cache: createIntermediateCache(),
    })

    expect(result).toHaveLength(1)
    expect(result[0].dimensions).toEqual({ domain: 'auth' })
  })

  it('files without topology entries receive empty dimensions', () => {
    const seen: DimensionSet[] = []
    const rule: AnalysisRule<'files'> = {
      id: 'r',
      severity: 'info',
      needs: [],
      corpus: 'files',
      run(item: FileItem) {
        seen.push(item.dimensions)
        return []
      },
    }

    runAnalysis({
      files: ['src/unknown.ts'],
      topology: new Map(),
      rules: [rule],
      cache: createIntermediateCache(),
    })

    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual({})
  })
})
