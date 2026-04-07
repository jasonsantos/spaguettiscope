import { describe, it, expect } from 'vitest'
import { circularDepRule } from '../../../analysis/built-in/circular.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { AnalysisContext, FileItem } from '../../../analysis/types.js'
import type { ImportGraph } from '../../../graph/index.js'

function makeCtx(imports: Record<string, string[]>): AnalysisContext {
  const importMap = new Map(Object.entries(imports).map(([k, v]) => [k, new Set(v)]))
  const importedBy = new Map<string, Set<string>>()
  for (const [from, targets] of importMap) {
    for (const to of targets) {
      if (!importedBy.has(to)) importedBy.set(to, new Set())
      importedBy.get(to)!.add(from)
    }
  }
  const graph: ImportGraph = { imports: importMap, importedBy, typeOnlyImports: new Map() }
  return { topology: new Map(), importGraph: graph, cache: createIntermediateCache() }
}

describe('circular-dep rule', () => {
  it('emits violation when file is part of a direct cycle (A → B → A)', () => {
    const ctx = makeCtx({ 'src/a.ts': ['src/b.ts'], 'src/b.ts': ['src/a.ts'] })
    const item: FileItem = { file: 'src/a.ts', dimensions: {} }
    const findings = circularDepRule.run(item, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe('violation')
    expect(findings[0].severity).toBe('warning')
  })

  it('emits violation for longer cycles (A → B → C → A)', () => {
    const ctx = makeCtx({
      'src/a.ts': ['src/b.ts'],
      'src/b.ts': ['src/c.ts'],
      'src/c.ts': ['src/a.ts'],
    })
    const item: FileItem = { file: 'src/a.ts', dimensions: {} }
    const findings = circularDepRule.run(item, ctx)
    expect(findings).toHaveLength(1)
  })

  it('emits no finding when no cycle exists', () => {
    const ctx = makeCtx({ 'src/a.ts': ['src/b.ts'], 'src/b.ts': ['src/c.ts'] })
    const item: FileItem = { file: 'src/a.ts', dimensions: {} }
    const findings = circularDepRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding when file has no imports', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/leaf.ts', dimensions: {} }
    const findings = circularDepRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })
})
