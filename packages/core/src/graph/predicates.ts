import { minimatch } from 'minimatch'
import type { ImportGraph } from './index.js'
import type { GraphPredicate } from '../rules/types.js'

export function evaluateGraphPredicate(
  filePath: string,
  predicate: GraphPredicate,
  graph: ImportGraph
): boolean {
  switch (predicate.kind) {
    case 'imported-by': {
      const importers = graph.importedBy.get(filePath)
      if (!importers) return false
      return Array.from(importers).some(f => minimatch(f, predicate.glob, { dot: true }))
    }
    case 'imports': {
      const deps = graph.imports.get(filePath)
      if (!deps) return false
      return Array.from(deps).some(f => minimatch(f, predicate.glob, { dot: true }))
    }
    case 'no-imports': {
      const deps = graph.imports.get(filePath)
      return !deps || deps.size === 0
    }
    case 'imports-count': {
      const count = graph.imports.get(filePath)?.size ?? 0
      return count > predicate.n
    }
    case 'and':
      return predicate.predicates.every(p => evaluateGraphPredicate(filePath, p, graph))
    case 'or':
      return predicate.predicates.some(p => evaluateGraphPredicate(filePath, p, graph))
  }
}
