import type { AnalysisRule, FileItem, Finding } from '../types.js'
import type { ImportGraph } from '../../graph/index.js'

/** Returns true if `start` can be reached by following imports from `start`. */
function hasCycle(start: string, graph: ImportGraph): boolean {
  const visited = new Set<string>()
  const stack: string[] = [start]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    const deps = graph.imports.get(current)
    if (!deps) continue
    for (const dep of deps) {
      if (dep === start) return true
      if (!visited.has(dep)) stack.push(dep)
    }
  }
  return false
}

export const circularDepRule: AnalysisRule<'files'> = {
  id: 'built-in:circular-dep',
  severity: 'warning',
  needs: ['importGraph'],
  corpus: 'files',
  run(item: FileItem, ctx): Finding[] {
    if (!ctx.importGraph) return []
    if (!ctx.importGraph.imports.has(item.file)) return []
    if (!hasCycle(item.file, ctx.importGraph)) return []

    return [
      {
        ruleId: 'built-in:circular-dep',
        kind: 'violation',
        severity: 'warning',
        subject: { type: 'file', path: item.file },
        dimensions: item.dimensions,
        message: `File is part of a circular import chain`,
      },
    ]
  },
}
