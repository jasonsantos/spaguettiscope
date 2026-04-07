import { describe, it, expect } from 'vitest'
import { analyzeLayerDirections } from '../../graph/layers.js'
import type { ImportGraph } from '../../graph/index.js'
import type { LayerPolicyEdge } from '../../skeleton/types.js'

function makeGraph(edges: Array<{ from: string; to: string; typeOnly?: boolean }>): ImportGraph {
  const imports = new Map<string, Set<string>>()
  const importedBy = new Map<string, Set<string>>()
  const typeOnlyImports = new Map<string, Set<string>>()

  for (const { from, to, typeOnly } of edges) {
    if (!imports.has(from)) imports.set(from, new Set())
    imports.get(from)!.add(to)
    if (!importedBy.has(to)) importedBy.set(to, new Set())
    importedBy.get(to)!.add(from)
    if (typeOnly) {
      if (!typeOnlyImports.has(from)) typeOnlyImports.set(from, new Set())
      typeOnlyImports.get(from)!.add(to)
    }
  }

  return { imports, importedBy, typeOnlyImports }
}

describe('analyzeLayerDirections', () => {
  it('detects one-directional concrete dependency', () => {
    const graph = makeGraph([
      { from: 'pkg/src/views/page.ts', to: 'pkg/src/model/user.ts' },
      { from: 'pkg/src/views/list.ts', to: 'pkg/src/model/item.ts' },
    ])

    const policy = analyzeLayerDirections(graph, 'pkg', [
      'pkg/src/views/page.ts',
      'pkg/src/views/list.ts',
      'pkg/src/model/user.ts',
      'pkg/src/model/item.ts',
    ])

    expect(policy).toContainEqual({ from: 'views', to: 'model', kind: 'concrete' })
  })

  it('detects type-only dependency when all imports are type-only', () => {
    const graph = makeGraph([
      { from: 'pkg/src/connectors/a.ts', to: 'pkg/src/renderer/types.ts', typeOnly: true },
      { from: 'pkg/src/connectors/b.ts', to: 'pkg/src/renderer/other.ts', typeOnly: true },
    ])

    const policy = analyzeLayerDirections(graph, 'pkg', [
      'pkg/src/connectors/a.ts',
      'pkg/src/connectors/b.ts',
      'pkg/src/renderer/types.ts',
      'pkg/src/renderer/other.ts',
    ])

    expect(policy).toContainEqual({ from: 'connectors', to: 'renderer', kind: 'typeOnly' })
  })

  it('skips pairs with bidirectional concrete imports (peers)', () => {
    const graph = makeGraph([
      { from: 'pkg/src/a/x.ts', to: 'pkg/src/b/y.ts' },
      { from: 'pkg/src/a/z.ts', to: 'pkg/src/b/w.ts' },
      { from: 'pkg/src/b/y.ts', to: 'pkg/src/a/x.ts' },
      { from: 'pkg/src/b/w.ts', to: 'pkg/src/a/z.ts' },
    ])

    const policy = analyzeLayerDirections(graph, 'pkg', [
      'pkg/src/a/x.ts',
      'pkg/src/a/z.ts',
      'pkg/src/b/y.ts',
      'pkg/src/b/w.ts',
    ])

    const aToB = policy.find(e => e.from === 'a' && e.to === 'b')
    const bToA = policy.find(e => e.from === 'b' && e.to === 'a')
    expect(aToB && bToA).toBeFalsy()
  })

  it('skips pairs with fewer than 2 total imports', () => {
    const graph = makeGraph([{ from: 'pkg/src/a/x.ts', to: 'pkg/src/b/y.ts' }])

    const policy = analyzeLayerDirections(graph, 'pkg', ['pkg/src/a/x.ts', 'pkg/src/b/y.ts'])

    expect(policy).toHaveLength(0)
  })

  it('ignores files not under src/', () => {
    const graph = makeGraph([{ from: 'pkg/scripts/build.ts', to: 'pkg/src/model/user.ts' }])

    const policy = analyzeLayerDirections(graph, 'pkg', [
      'pkg/scripts/build.ts',
      'pkg/src/model/user.ts',
    ])

    expect(policy).toHaveLength(0)
  })
})
