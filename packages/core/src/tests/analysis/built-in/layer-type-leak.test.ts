import { describe, it, expect } from 'vitest'
import { layerTypeLeakRule } from '../../../analysis/built-in/layer-type-leak.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { EdgeItem, AnalysisContext } from '../../../analysis/types.js'
import type { LayerPolicyEdge } from '../../../skeleton/types.js'

function makeCtx(
  policy: Record<string, LayerPolicyEdge[]>,
  typeOnlyEdges: Array<[string, string]>,
  draft = false
): AnalysisContext {
  const typeOnlyImports = new Map<string, Set<string>>()
  for (const [from, to] of typeOnlyEdges) {
    if (!typeOnlyImports.has(from)) typeOnlyImports.set(from, new Set())
    typeOnlyImports.get(from)!.add(to)
  }
  return {
    topology: new Map(),
    cache: createIntermediateCache(),
    layerPolicy: policy,
    layerPolicyDraft: draft,
    importGraph: {
      imports: new Map(),
      importedBy: new Map(),
      typeOnlyImports,
    },
  }
}

describe('built-in:layer-type-leak', () => {
  it('emits no finding when type-only edge has ~ policy', () => {
    const ctx = makeCtx({ pkg: [{ from: 'connectors', to: 'renderer', kind: 'typeOnly' }] }, [
      ['pkg/src/connectors/a.ts', 'pkg/src/renderer/types.ts'],
    ])
    const edge: EdgeItem = {
      from: { file: 'pkg/src/connectors/a.ts', dimensions: { package: 'pkg', layer: 'connectors' } },
      to: { file: 'pkg/src/renderer/types.ts', dimensions: { package: 'pkg', layer: 'renderer' } },
    }
    expect(layerTypeLeakRule.run(edge, ctx)).toHaveLength(0)
  })

  it('emits no finding when type-only edge has -> policy (concrete allows type too)', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] }, [
      ['pkg/src/views/page.ts', 'pkg/src/model/user.ts'],
    ])
    const edge: EdgeItem = {
      from: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
      to: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
    }
    expect(layerTypeLeakRule.run(edge, ctx)).toHaveLength(0)
  })

  it('emits warning when type-only edge has no policy edge', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] }, [
      ['pkg/src/model/user.ts', 'pkg/src/views/page.ts'],
    ])
    const edge: EdgeItem = {
      from: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
      to: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
    }
    const findings = layerTypeLeakRule.run(edge, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('warning')
  })

  it('skips when policy is draft', () => {
    const ctx = makeCtx({ pkg: [] }, [['pkg/src/model/user.ts', 'pkg/src/views/page.ts']], true)
    const edge: EdgeItem = {
      from: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
      to: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
    }
    expect(layerTypeLeakRule.run(edge, ctx)).toHaveLength(0)
  })
})
