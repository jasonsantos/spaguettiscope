import { describe, it, expect } from 'vitest'
import { coverageGapRule } from '../../../analysis/built-in/coverage.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { AnalysisContext, FileItem } from '../../../analysis/types.js'
import type { ImportGraph } from '../../../graph/index.js'

function makeCtx(
  importedBy: Record<string, string[]>,
  topology: Record<string, Record<string, string>> = {}
): AnalysisContext {
  const graph: ImportGraph = {
    imports: new Map(),
    importedBy: new Map(Object.entries(importedBy).map(([k, v]) => [k, new Set(v)])),
  }
  return {
    topology: new Map(Object.entries(topology)),
    importGraph: graph,
    cache: createIntermediateCache(),
  }
}

describe('coverage-gap rule', () => {
  it('emits coverage-gap when a page has no test importing it', () => {
    const ctx = makeCtx({}, { 'src/auth/page.tsx': { role: 'page' } })
    const item: FileItem = { file: 'src/auth/page.tsx', dimensions: { role: 'page' } }
    const findings = coverageGapRule.run(item, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe('coverage-gap')
    expect(findings[0].subject).toEqual({ type: 'file', path: 'src/auth/page.tsx' })
  })

  it('emits no finding when a test imports the file', () => {
    const ctx = makeCtx(
      { 'src/auth/page.tsx': ['src/auth/page.test.ts'] },
      {
        'src/auth/page.tsx': { role: 'page' },
        'src/auth/page.test.ts': { role: 'test' },
      }
    )
    const item: FileItem = { file: 'src/auth/page.tsx', dimensions: { role: 'page' } }
    const findings = coverageGapRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits coverage-gap when only a non-test file imports it', () => {
    const ctx = makeCtx(
      { 'src/auth/page.tsx': ['src/layout.tsx'] },  // layout imports page — not a test
      {
        'src/auth/page.tsx': { role: 'page' },
        'src/layout.tsx': { role: 'layout' },
      }
    )
    const item: FileItem = { file: 'src/auth/page.tsx', dimensions: { role: 'page' } }
    const findings = coverageGapRule.run(item, ctx)
    expect(findings).toHaveLength(1)  // should still flag it — no test importer
  })

  it('emits no finding for files with non-targeted roles', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/util.ts', dimensions: { role: 'utility' } }
    const findings = coverageGapRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding when file has no role', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/index.ts', dimensions: {} }
    const findings = coverageGapRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('targets hook, server-action, repository, schema roles', () => {
    const ctx = makeCtx({})
    const targeted = ['hook', 'server-action', 'repository', 'schema']
    for (const role of targeted) {
      const item: FileItem = { file: `src/thing.ts`, dimensions: { role } }
      const findings = coverageGapRule.run(item, ctx)
      expect(findings).toHaveLength(1)
    }
  })
})
