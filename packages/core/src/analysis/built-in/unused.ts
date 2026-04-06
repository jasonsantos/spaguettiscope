import type { AnalysisRule, FileItem, Finding } from '../types.js'

// These roles are entry points — they are "used" by the runtime, not by imports.
const ENTRY_POINT_ROLES = new Set([
  'page',
  'middleware',
  'route-handler',
  'instrumentation',
  'test',
  'spec',
  'e2e',
  'bdd-spec',
  'auth-setup',
])

export const unusedExportRule: AnalysisRule<'files'> = {
  id: 'built-in:unused-export',
  severity: 'info',
  needs: ['importGraph'],
  corpus: 'files',
  run(item: FileItem, ctx): Finding[] {
    const role = item.dimensions.role
    // Only analyse files with a known role (in topology) to avoid noise.
    if (!role) return []
    if (ENTRY_POINT_ROLES.has(role)) return []

    const importers = ctx.importGraph?.importedBy.get(item.file)
    if (importers && importers.size > 0) return []

    return [
      {
        ruleId: 'built-in:unused-export',
        kind: 'unused',
        severity: 'info',
        subject: { type: 'file', path: item.file },
        dimensions: item.dimensions,
        message: `File is not imported by any other file (role: ${role})`,
      },
    ]
  },
}
