import type { AnalysisRule, EdgeItem, Finding, AnalysisContext } from '../types.js'

export const layerViolationRule: AnalysisRule<'edges'> = {
  id: 'built-in:layer-violation',
  severity: 'error',
  needs: ['importGraph'],
  corpus: 'edges',
  run(item: EdgeItem, ctx: AnalysisContext): Finding[] {
    if (!ctx.layerPolicy || ctx.layerPolicyDraft) return []

    const fromLayer = item.from.dimensions.layer
    const toLayer = item.to.dimensions.layer
    if (!fromLayer || !toLayer) return []
    if (fromLayer === toLayer) return []

    const fromPkg = item.from.dimensions.package
    const toPkg = item.to.dimensions.package
    if (!fromPkg || fromPkg !== toPkg) return []

    const policy = ctx.layerPolicy[fromPkg]
    if (!policy) return []

    // Skip type-only edges (handled by layer-type-leak rule)
    const typeOnly = ctx.importGraph?.typeOnlyImports.get(item.from.file)?.has(item.to.file)
    if (typeOnly) return []

    const allowed = policy.some(
      e => e.from === fromLayer && e.to === toLayer && e.kind === 'concrete'
    )
    if (allowed) return []

    return [
      {
        ruleId: 'built-in:layer-violation',
        kind: 'layer-violation',
        severity: 'error',
        subject: { type: 'edge', from: item.from.file, to: item.to.file },
        dimensions: item.from.dimensions,
        message: `Concrete import from ${fromLayer} to ${toLayer} violates layer policy (${item.from.file} → ${item.to.file})`,
      },
    ]
  },
}
