import type { AnalysisRule, EdgeItem, Finding, AnalysisContext } from '../types.js'

export const layerTypeLeakRule: AnalysisRule<'edges'> = {
  id: 'built-in:layer-type-leak',
  severity: 'warning',
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

    // Only applies to type-only edges
    const isTypeOnly = ctx.importGraph?.typeOnlyImports.get(item.from.file)?.has(item.to.file)
    if (!isTypeOnly) return []

    const policy = ctx.layerPolicy[fromPkg]
    if (!policy) return []

    // Any policy edge (concrete or typeOnly) covers this
    const covered = policy.some(e => e.from === fromLayer && e.to === toLayer)
    if (covered) return []

    return [
      {
        ruleId: 'built-in:layer-type-leak',
        kind: 'layer-violation',
        severity: 'warning',
        subject: { type: 'edge', from: item.from.file, to: item.to.file },
        dimensions: item.from.dimensions,
        message: `Type-only import from ${fromLayer} to ${toLayer} has no policy edge (${item.from.file} → ${item.to.file})`,
      },
    ]
  },
}
