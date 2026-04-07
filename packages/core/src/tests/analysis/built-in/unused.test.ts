import { describe, it, expect } from 'vitest'
import { unusedExportRule } from '../../../analysis/built-in/unused.js'
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
    typeOnlyImports: new Map(),
  }
  return {
    topology: new Map(Object.entries(topology)),
    importGraph: graph,
    cache: createIntermediateCache(),
  }
}

describe('unused-export rule', () => {
  it('emits unused finding when file has no importers', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/utils/format.ts', dimensions: { role: 'hook' } }
    const findings = unusedExportRule.run(item, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe('unused')
    expect(findings[0].severity).toBe('info')
  })

  it('emits no finding when file has importers', () => {
    const ctx = makeCtx({ 'src/utils/format.ts': ['src/auth/page.tsx'] })
    const item: FileItem = { file: 'src/utils/format.ts', dimensions: {} }
    const findings = unusedExportRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding for entry-point roles', () => {
    const ctx = makeCtx({})
    const entryRoles = ['page', 'middleware', 'route-handler', 'instrumentation']
    for (const role of entryRoles) {
      const item: FileItem = { file: 'src/thing.ts', dimensions: { role } }
      const findings = unusedExportRule.run(item, ctx)
      expect(findings).toHaveLength(0)
    }
  })

  it('emits no finding for test files', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/auth.test.ts', dimensions: { role: 'test' } }
    const findings = unusedExportRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding for files with no dimensions (not in topology)', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/unknown.ts', dimensions: {} }
    const findings = unusedExportRule.run(item, ctx)
    // files with no role are not analysed to avoid false positives
    expect(findings).toHaveLength(0)
  })
})
