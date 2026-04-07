import { describe, it, expect } from 'vitest'
import { layerViolationRule } from '../../../analysis/built-in/layer-violation.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { EdgeItem, AnalysisContext } from '../../../analysis/types.js'
import type { LayerPolicyEdge } from '../../../skeleton/types.js'

function makeCtx(policy: Record<string, LayerPolicyEdge[]>, draft = false): AnalysisContext {
  return {
    topology: new Map([
      ['pkg/src/views/page.ts', { package: 'pkg', layer: 'views', role: 'component' }],
      ['pkg/src/model/user.ts', { package: 'pkg', layer: 'model', role: 'business-logic' }],
      ['pkg/src/utils/fmt.ts', { package: 'pkg', layer: 'utils', role: 'utility' }],
    ]),
    cache: createIntermediateCache(),
    layerPolicy: policy,
    layerPolicyDraft: draft,
  }
}

describe('built-in:layer-violation', () => {
  it('emits no finding for allowed concrete edge', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] })
    const edge: EdgeItem = {
      from: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
      to: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
    }
    expect(layerViolationRule.run(edge, ctx)).toHaveLength(0)
  })

  it('emits error for unlisted concrete edge', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] })
    const edge: EdgeItem = {
      from: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
      to: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
    }
    const findings = layerViolationRule.run(edge, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('error')
  })

  it('skips when policy is draft', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] }, true)
    const edge: EdgeItem = {
      from: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
      to: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
    }
    expect(layerViolationRule.run(edge, ctx)).toHaveLength(0)
  })

  it('skips when either file has no layer', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] })
    const edge: EdgeItem = {
      from: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
      to: { file: 'pkg/src/other.ts', dimensions: { package: 'pkg' } },
    }
    expect(layerViolationRule.run(edge, ctx)).toHaveLength(0)
  })

  it('skips when files are in different packages', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] })
    const edge: EdgeItem = {
      from: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
      to: { file: 'other/src/model/user.ts', dimensions: { package: 'other', layer: 'model' } },
    }
    expect(layerViolationRule.run(edge, ctx)).toHaveLength(0)
  })
})
