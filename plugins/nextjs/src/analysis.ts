import type { AnalysisPlugin, AnalysisRule, Finding, EdgeItem, AnalysisContext } from '@spaguettiscope/core'
import { canApply } from './detect.js'

const noClientImportsServer: AnalysisRule<'edges'> = {
  id: 'nextjs:no-client-imports-server',
  severity: 'error',
  needs: [],
  corpus: 'edges',
  run(item: EdgeItem, _ctx: AnalysisContext): Finding[] {
    if (item.from.dimensions.layer !== 'client-component') return []
    if (item.to.dimensions.role !== 'server-action') return []
    return [
      {
        ruleId: 'nextjs:no-client-imports-server',
        kind: 'violation',
        severity: 'error',
        subject: { type: 'edge', from: item.from.file, to: item.to.file },
        dimensions: item.from.dimensions,
        message: `Client component imports server-action directly — this throws at runtime in Next.js`,
      },
    ]
  },
}

const noCrossDomainPage: AnalysisRule<'edges'> = {
  id: 'nextjs:no-cross-domain-page',
  severity: 'warning',
  needs: [],
  corpus: 'edges',
  run(item: EdgeItem, _ctx: AnalysisContext): Finding[] {
    if (item.from.dimensions.role !== 'page') return []
    if (item.to.dimensions.role !== 'page') return []
    const fromDomain = item.from.dimensions.domain
    const toDomain = item.to.dimensions.domain
    if (!fromDomain || !toDomain) return []
    if (fromDomain === toDomain) return []
    return [
      {
        ruleId: 'nextjs:no-cross-domain-page',
        kind: 'violation',
        severity: 'warning',
        subject: { type: 'edge', from: item.from.file, to: item.to.file },
        dimensions: item.from.dimensions,
        message: `Page in domain "${fromDomain}" imports page in domain "${toDomain}" — pages should not couple across domain boundaries`,
      },
    ]
  },
}

const bffLayerBoundary: AnalysisRule<'edges'> = {
  id: 'nextjs:bff-layer-boundary',
  severity: 'error',
  needs: [],
  corpus: 'edges',
  run(item: EdgeItem, _ctx: AnalysisContext): Finding[] {
    if (item.from.dimensions.layer !== 'client-component') return []
    if (item.to.dimensions.layer !== 'bff') return []
    return [
      {
        ruleId: 'nextjs:bff-layer-boundary',
        kind: 'violation',
        severity: 'error',
        subject: { type: 'edge', from: item.from.file, to: item.to.file },
        dimensions: item.from.dimensions,
        message: `Client component imports BFF module — BFF route handlers are server-only and cannot be imported by client components`,
      },
    ]
  },
}

export const nextjsAnalysisPlugin: AnalysisPlugin = {
  id: 'nextjs-analysis',
  canApply,
  rules: () => [noClientImportsServer, noCrossDomainPage, bffLayerBoundary],
}
