import { describe, it, expect } from 'vitest'
import { evaluateGraphPredicate } from '../../graph/predicates.js'
import type { ImportGraph } from '../../graph/index.js'
import type { GraphPredicate } from '../../rules/types.js'

function makeGraph(
  imports: Record<string, string[]>,
  importedBy: Record<string, string[]>
): ImportGraph {
  return {
    imports: new Map(Object.entries(imports).map(([k, v]) => [k, new Set(v)])),
    importedBy: new Map(Object.entries(importedBy).map(([k, v]) => [k, new Set(v)])),
    typeOnlyImports: new Map(),
  }
}

describe('evaluateGraphPredicate', () => {
  it('imported-by: true when file is imported by a glob match', () => {
    const graph = makeGraph({}, { 'src/utils.ts': ['src/index.ts'] })
    const p: GraphPredicate = { kind: 'imported-by', glob: 'src/index.ts' }
    expect(evaluateGraphPredicate('src/utils.ts', p, graph)).toBe(true)
  })

  it('imported-by: false when no importer matches', () => {
    const graph = makeGraph({}, { 'src/utils.ts': ['src/other.ts'] })
    const p: GraphPredicate = { kind: 'imported-by', glob: 'src/index.ts' }
    expect(evaluateGraphPredicate('src/utils.ts', p, graph)).toBe(false)
  })

  it('imported-by: false when file has no importers', () => {
    const graph = makeGraph({}, {})
    const p: GraphPredicate = { kind: 'imported-by', glob: 'src/**' }
    expect(evaluateGraphPredicate('src/utils.ts', p, graph)).toBe(false)
  })

  it('imports: true when file imports a glob match', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, {})
    const p: GraphPredicate = { kind: 'imports', glob: 'src/b.ts' }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })

  it('imports: supports glob pattern', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/utils/format.ts'] }, {})
    const p: GraphPredicate = { kind: 'imports', glob: 'src/utils/**' }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })

  it('no-imports: true when file has no imports', () => {
    const graph = makeGraph({ 'src/leaf.ts': [] }, {})
    const p: GraphPredicate = { kind: 'no-imports' }
    expect(evaluateGraphPredicate('src/leaf.ts', p, graph)).toBe(true)
  })

  it('no-imports: false when file has imports', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, {})
    const p: GraphPredicate = { kind: 'no-imports' }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(false)
  })

  it('imports-count: true when import count exceeds N', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts', 'src/c.ts', 'src/d.ts'] }, {})
    const p: GraphPredicate = { kind: 'imports-count', op: '>', n: 2 }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })

  it('imports-count: false when count does not exceed N', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, {})
    const p: GraphPredicate = { kind: 'imports-count', op: '>', n: 2 }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(false)
  })

  it('and: true when all predicates pass', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, { 'src/a.ts': ['src/c.ts'] })
    const p: GraphPredicate = {
      kind: 'and',
      predicates: [
        { kind: 'imports', glob: 'src/b.ts' },
        { kind: 'imported-by', glob: 'src/c.ts' },
      ],
    }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })

  it('and: false when any predicate fails', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, {})
    const p: GraphPredicate = {
      kind: 'and',
      predicates: [
        { kind: 'imports', glob: 'src/b.ts' },
        { kind: 'imported-by', glob: 'src/c.ts' },
      ],
    }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(false)
  })

  it('or: true when at least one predicate passes', () => {
    const graph = makeGraph({ 'src/a.ts': [] }, { 'src/a.ts': ['src/c.ts'] })
    const p: GraphPredicate = {
      kind: 'or',
      predicates: [
        { kind: 'imports', glob: 'src/b.ts' },
        { kind: 'imported-by', glob: 'src/c.ts' },
      ],
    }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })
})
