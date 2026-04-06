import type { AnalysisRule, FileItem, Finding } from '../types.js'

const TARGETED_ROLES = new Set(['page', 'hook', 'server-action', 'repository', 'schema'])

export const coverageGapRule: AnalysisRule<'files'> = {
  id: 'built-in:coverage-gap',
  severity: 'warning',
  needs: ['importGraph'],
  corpus: 'files',
  run(item: FileItem, ctx): Finding[] {
    if (!TARGETED_ROLES.has(item.dimensions.role ?? '')) return []

    const importers = ctx.importGraph?.importedBy.get(item.file)
    if (importers && importers.size > 0) return []

    return [
      {
        ruleId: 'built-in:coverage-gap',
        kind: 'coverage-gap',
        severity: 'warning',
        subject: { type: 'file', path: item.file },
        dimensions: item.dimensions,
        message: `No test directly imports this file (role: ${item.dimensions.role})`,
      },
    ]
  },
}
