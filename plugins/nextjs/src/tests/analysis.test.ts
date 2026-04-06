import { describe, it, expect } from 'vitest'
import { nextjsAnalysisPlugin } from '../analysis.js'
import { createIntermediateCache } from '@spaguettiscope/core'

const ctx = {
  topology: new Map<string, Record<string, string>>(),
  cache: createIntermediateCache(),
}

describe('nextjsAnalysisPlugin', () => {
  it('has id "nextjs-analysis"', () => {
    expect(nextjsAnalysisPlugin.id).toBe('nextjs-analysis')
  })

  it('returns 3 rules', () => {
    expect(nextjsAnalysisPlugin.rules()).toHaveLength(3)
  })

  it('all rules have corpus "edges"', () => {
    const rules = nextjsAnalysisPlugin.rules()
    expect(rules.every(r => r.corpus === 'edges')).toBe(true)
  })

  it('all rules declare needs: []', () => {
    const rules = nextjsAnalysisPlugin.rules()
    expect(rules.every(r => r.needs.length === 0)).toBe(true)
  })
})

describe('nextjs:no-client-imports-server', () => {
  const rule = () =>
    nextjsAnalysisPlugin.rules().find(r => r.id === 'nextjs:no-client-imports-server')!

  it('emits an error violation when a client-component imports a server-action', () => {
    const edge = {
      from: { file: 'components/CheckoutForm.tsx', dimensions: { layer: 'client-component' } },
      to: { file: 'actions/checkout.ts', dimensions: { role: 'server-action' } },
    }
    const findings = rule().run(edge, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].ruleId).toBe('nextjs:no-client-imports-server')
    expect(findings[0].severity).toBe('error')
    expect(findings[0].kind).toBe('violation')
    expect(findings[0].subject).toEqual({
      type: 'edge',
      from: 'components/CheckoutForm.tsx',
      to: 'actions/checkout.ts',
    })
  })

  it('emits nothing when a server component (page) imports a server-action', () => {
    const edge = {
      from: { file: 'app/checkout/page.tsx', dimensions: { role: 'page' } },
      to: { file: 'actions/checkout.ts', dimensions: { role: 'server-action' } },
    }
    expect(rule().run(edge, ctx)).toHaveLength(0)
  })

  it('emits nothing when a client-component imports a non-server-action', () => {
    const edge = {
      from: { file: 'components/Foo.tsx', dimensions: { layer: 'client-component' } },
      to: { file: 'lib/utils.ts', dimensions: { role: 'utility' } },
    }
    expect(rule().run(edge, ctx)).toHaveLength(0)
  })

  it('emits nothing when from has no dimensions', () => {
    const edge = {
      from: { file: 'components/Unknown.tsx', dimensions: {} },
      to: { file: 'actions/auth.ts', dimensions: { role: 'server-action' } },
    }
    expect(rule().run(edge, ctx)).toHaveLength(0)
  })
})

describe('nextjs:no-cross-domain-page', () => {
  const rule = () =>
    nextjsAnalysisPlugin.rules().find(r => r.id === 'nextjs:no-cross-domain-page')!

  it('emits a warning violation when two pages in different domains are coupled', () => {
    const edge = {
      from: { file: 'app/auth/login/page.tsx', dimensions: { role: 'page', domain: 'auth' } },
      to: { file: 'app/checkout/page.tsx', dimensions: { role: 'page', domain: 'checkout' } },
    }
    const findings = rule().run(edge, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].ruleId).toBe('nextjs:no-cross-domain-page')
    expect(findings[0].severity).toBe('warning')
    expect(findings[0].kind).toBe('violation')
    expect(findings[0].subject).toEqual({
      type: 'edge',
      from: 'app/auth/login/page.tsx',
      to: 'app/checkout/page.tsx',
    })
  })

  it('emits nothing when two pages are in the same domain', () => {
    const edge = {
      from: { file: 'app/auth/login/page.tsx', dimensions: { role: 'page', domain: 'auth' } },
      to: { file: 'app/auth/register/page.tsx', dimensions: { role: 'page', domain: 'auth' } },
    }
    expect(rule().run(edge, ctx)).toHaveLength(0)
  })

  it('emits nothing when only the from is a page', () => {
    const edge = {
      from: { file: 'app/auth/login/page.tsx', dimensions: { role: 'page', domain: 'auth' } },
      to: { file: 'components/Button.tsx', dimensions: { layer: 'client-component' } },
    }
    expect(rule().run(edge, ctx)).toHaveLength(0)
  })

  it('emits nothing when either page has no domain', () => {
    const edge = {
      from: { file: 'app/auth/login/page.tsx', dimensions: { role: 'page' } },
      to: { file: 'app/checkout/page.tsx', dimensions: { role: 'page', domain: 'checkout' } },
    }
    expect(rule().run(edge, ctx)).toHaveLength(0)
  })
})

describe('nextjs:bff-layer-boundary', () => {
  const rule = () =>
    nextjsAnalysisPlugin.rules().find(r => r.id === 'nextjs:bff-layer-boundary')!

  it('emits an error violation when a client-component imports a bff module', () => {
    const edge = {
      from: { file: 'components/DataGrid.tsx', dimensions: { layer: 'client-component' } },
      to: { file: 'app/api/data/route.ts', dimensions: { layer: 'bff', role: 'api-endpoint' } },
    }
    const findings = rule().run(edge, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].ruleId).toBe('nextjs:bff-layer-boundary')
    expect(findings[0].severity).toBe('error')
    expect(findings[0].kind).toBe('violation')
    expect(findings[0].subject).toEqual({
      type: 'edge',
      from: 'components/DataGrid.tsx',
      to: 'app/api/data/route.ts',
    })
  })

  it('emits nothing when a server component (page) imports a bff module', () => {
    const edge = {
      from: { file: 'app/dashboard/page.tsx', dimensions: { role: 'page' } },
      to: { file: 'app/api/data/route.ts', dimensions: { layer: 'bff' } },
    }
    expect(rule().run(edge, ctx)).toHaveLength(0)
  })

  it('emits nothing when a client-component imports a non-bff module', () => {
    const edge = {
      from: { file: 'components/Foo.tsx', dimensions: { layer: 'client-component' } },
      to: { file: 'lib/utils.ts', dimensions: { layer: 'shared' } },
    }
    expect(rule().run(edge, ctx)).toHaveLength(0)
  })

  it('emits nothing when to has no layer', () => {
    const edge = {
      from: { file: 'components/Foo.tsx', dimensions: { layer: 'client-component' } },
      to: { file: 'lib/helpers.ts', dimensions: {} },
    }
    expect(rule().run(edge, ctx)).toHaveLength(0)
  })
})
