import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { nextjsPlugin } from '../index.js'
import { runRules } from '@spaguettiscope/core'

describe('nextjsPlugin.canApply', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-nextjs-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when next is in dependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { next: '14.0.0' } })
    )
    expect(nextjsPlugin.canApply(dir)).toBe(true)
  })

  it('returns true when next is in devDependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'web', devDependencies: { next: '14.0.0' } })
    )
    expect(nextjsPlugin.canApply(dir)).toBe(true)
  })

  it('returns false when next is not present', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'api', dependencies: { express: '4.0.0' } })
    )
    expect(nextjsPlugin.canApply(dir)).toBe(false)
  })

  it('returns false when package.json does not exist', () => {
    expect(nextjsPlugin.canApply(dir)).toBe(false)
  })
})

describe('nextjsPlugin.rules', () => {
  it('returns rules array with expected ids', () => {
    const rules = nextjsPlugin.rules()
    const ids = rules.map(r => r.id)
    // Core routing
    expect(ids).toContain('nextjs:api-endpoint')
    expect(ids).toContain('nextjs:route-handler')
    expect(ids).toContain('nextjs:page')
    expect(ids).toContain('nextjs:layout')
    expect(ids).toContain('nextjs:template')
    // Route lifecycle UI
    expect(ids).toContain('nextjs:loading-ui')
    expect(ids).toContain('nextjs:error-boundary')
    expect(ids).toContain('nextjs:global-error')
    expect(ids).toContain('nextjs:not-found')
    expect(ids).toContain('nextjs:forbidden')
    expect(ids).toContain('nextjs:unauthorized')
    expect(ids).toContain('nextjs:parallel-route-default')
    // Metadata
    expect(ids).toContain('nextjs:opengraph-image')
    expect(ids).toContain('nextjs:twitter-image')
    expect(ids).toContain('nextjs:sitemap')
    expect(ids).toContain('nextjs:robots')
    expect(ids).toContain('nextjs:manifest')
    expect(ids).toContain('nextjs:app-icon')
    expect(ids).toContain('nextjs:apple-icon')
    // Root-level
    expect(ids).toContain('nextjs:middleware')
    expect(ids).toContain('nextjs:instrumentation')
    expect(ids).toContain('nextjs:instrumentation-client')
    expect(ids).toContain('nextjs:mdx-components')
    // Rendering model
    expect(ids).toContain('nextjs:client-component')
    expect(ids).toContain('nextjs:server-action')
  })

  it('api-endpoint rule yields role=api-endpoint, layer=bff, domain capture', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:api-endpoint')!
    expect(rule.selector.path).toBe('app/api/($1)/**/route.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'api-endpoint' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'bff' })
    expect(rule.yields).toContainEqual({ kind: 'extracted', key: 'domain', capture: 1 })
  })

  it('route-handler rule yields role=route-handler and layer=bff', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:route-handler')!
    expect(rule.selector.path).toBe('app/**/route.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'route-handler' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'bff' })
  })

  it('loading-ui rule yields role=loading-ui and layer=routing', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:loading-ui')!
    expect(rule.selector.path).toBe('app/**/loading.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'loading-ui' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'routing' })
  })

  it('error-boundary rule yields role=error-boundary and layer=routing', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:error-boundary')!
    expect(rule.selector.path).toBe('app/**/error.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'error-boundary' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'routing' })
  })

  it('global-error rule targets app/global-error.tsx and uses layer=global', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:global-error')!
    expect(rule.selector.path).toBe('app/global-error.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'error-boundary' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'global' })
  })

  it('not-found rule yields role=not-found and layer=routing', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:not-found')!
    expect(rule.selector.path).toBe('app/**/not-found.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'not-found' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'routing' })
  })

  it('forbidden rule yields role=forbidden and layer=routing', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:forbidden')!
    expect(rule.selector.path).toBe('app/**/forbidden.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'forbidden' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'routing' })
  })

  it('unauthorized rule yields role=unauthorized and layer=routing', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:unauthorized')!
    expect(rule.selector.path).toBe('app/**/unauthorized.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'unauthorized' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'routing' })
  })

  it('parallel-route-default rule yields role=parallel-route-default and layer=routing', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:parallel-route-default')!
    expect(rule.selector.path).toBe('app/**/default.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'parallel-route-default' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'routing' })
  })

  it('template rule yields role=template and layer=routing', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:template')!
    expect(rule.selector.path).toBe('app/**/template.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'template' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'routing' })
  })

  it('opengraph-image rule yields role=og-image', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:opengraph-image')!
    expect(rule.selector.path).toBe('app/**/opengraph-image.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'og-image' })
  })

  it('twitter-image rule yields role=og-image', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:twitter-image')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'og-image' })
  })

  it('sitemap rule targets app/sitemap.ts and yields role=sitemap', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:sitemap')!
    expect(rule.selector.path).toBe('app/sitemap.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'sitemap' })
  })

  it('robots rule targets app/robots.ts and yields role=robots', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:robots')!
    expect(rule.selector.path).toBe('app/robots.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'robots' })
  })

  it('manifest rule targets app/manifest.ts and yields role=manifest', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:manifest')!
    expect(rule.selector.path).toBe('app/manifest.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'manifest' })
  })

  it('app-icon rule yields role=app-icon', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:app-icon')!
    expect(rule.selector.path).toBe('app/**/icon.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'app-icon' })
  })

  it('apple-icon rule yields role=app-icon', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:apple-icon')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'app-icon' })
  })

  it('instrumentation rule targets instrumentation.ts at root', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:instrumentation')!
    expect(rule.selector.path).toBe('instrumentation.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'instrumentation' })
  })

  it('instrumentation-client rule targets instrumentation-client.ts at root', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:instrumentation-client')!
    expect(rule.selector.path).toBe('instrumentation-client.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'instrumentation' })
  })

  it('mdx-components rule targets mdx-components.tsx at root', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:mdx-components')!
    expect(rule.selector.path).toBe('mdx-components.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'mdx-components' })
  })

  it('client-component rule has content predicate matching use client (single quotes)', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:client-component')!
    expect(rule.selector.content).toBeDefined()
    // Regex accepts both quote styles: ^['"]use client['"]
    expect(new RegExp(rule.selector.content!).test("'use client'")).toBe(true)
  })

  it('client-component rule content predicate also matches double-quote form', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:client-component')!
    expect(rule.selector.content).toBeDefined()
    expect(new RegExp(rule.selector.content!).test('"use client"')).toBe(true)
  })

  it('server-action rule is present with expected id', () => {
    const rules = nextjsPlugin.rules()
    const ids = rules.map(r => r.id)
    expect(ids).toContain('nextjs:server-action')
  })

  it('server-action rule yields role=server-action and layer=bff', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:server-action')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'server-action' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'bff' })
  })
})

describe('nextjsPlugin server-action rule — content matching', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-nextjs-sa-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('assigns role=server-action and layer=bff to a .ts file starting with \'use server\'', () => {
    writeFileSync(
      join(dir, 'actions.ts'),
      "'use server'\nexport async function createUser() {}"
    )
    const rules = nextjsPlugin.rules()
    const r = runRules(['actions.ts'], rules, dir)
    expect(r.some(c => c.attributes.role === 'server-action')).toBe(true)
    expect(r.some(c => c.attributes.layer === 'bff')).toBe(true)
  })

  it('does NOT assign server-action to a .ts file without \'use server\' at the top', () => {
    writeFileSync(
      join(dir, 'service.ts'),
      "export async function createUser() {}"
    )
    const rules = nextjsPlugin.rules()
    const r = runRules(['service.ts'], rules, dir)
    expect(r.some(c => c.attributes.role === 'server-action')).toBe(false)
  })
})

describe('nextjsPlugin route lifecycle UI rules — path matching', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-nextjs-routing-${Date.now()}`)
    mkdirSync(join(dir, 'app', 'dashboard'), { recursive: true })
    mkdirSync(join(dir, 'app', 'products', '[slug]'), { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('assigns role=loading-ui and layer=routing to app/**/loading.tsx', () => {
    writeFileSync(join(dir, 'app', 'dashboard', 'loading.tsx'), 'export default function Loading() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/dashboard/loading.tsx'], rules, dir)
    expect(r.some(c => c.attributes.role === 'loading-ui')).toBe(true)
    expect(r.some(c => c.attributes.layer === 'routing')).toBe(true)
  })

  it('assigns role=error-boundary and layer=routing to app/**/error.tsx', () => {
    writeFileSync(join(dir, 'app', 'dashboard', 'error.tsx'), '"use client"\nexport default function Error() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/dashboard/error.tsx'], rules, dir)
    expect(r.some(c => c.attributes.role === 'error-boundary')).toBe(true)
    expect(r.some(c => c.attributes.layer === 'routing')).toBe(true)
  })

  it('assigns role=error-boundary and layer=global to app/global-error.tsx', () => {
    writeFileSync(join(dir, 'app', 'global-error.tsx'), '"use client"\nexport default function GlobalError() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/global-error.tsx'], rules, dir)
    const candidates = r.filter(c => c.source === 'nextjs:global-error')
    expect(candidates.some(c => c.attributes.role === 'error-boundary')).toBe(true)
    expect(candidates.some(c => c.attributes.layer === 'global')).toBe(true)
  })

  it('assigns role=not-found and layer=routing to app/**/not-found.tsx', () => {
    writeFileSync(join(dir, 'app', 'products', '[slug]', 'not-found.tsx'), 'export default function NotFound() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/products/[slug]/not-found.tsx'], rules, dir)
    expect(r.some(c => c.attributes.role === 'not-found')).toBe(true)
    expect(r.some(c => c.attributes.layer === 'routing')).toBe(true)
  })

  it('assigns role=template and layer=routing to app/**/template.tsx', () => {
    writeFileSync(join(dir, 'app', 'dashboard', 'template.tsx'), 'export default function Template() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/dashboard/template.tsx'], rules, dir)
    expect(r.some(c => c.attributes.role === 'template')).toBe(true)
    expect(r.some(c => c.attributes.layer === 'routing')).toBe(true)
  })

  it('assigns role=parallel-route-default and layer=routing to app/**/default.tsx', () => {
    writeFileSync(join(dir, 'app', 'dashboard', 'default.tsx'), 'export default function Default() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/dashboard/default.tsx'], rules, dir)
    expect(r.some(c => c.attributes.role === 'parallel-route-default')).toBe(true)
    expect(r.some(c => c.attributes.layer === 'routing')).toBe(true)
  })
})

describe('nextjsPlugin metadata and root-level rules — path matching', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-nextjs-meta-${Date.now()}`)
    mkdirSync(join(dir, 'app'), { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('assigns role=sitemap to app/sitemap.ts', () => {
    writeFileSync(join(dir, 'app', 'sitemap.ts'), 'export default function sitemap() { return [] }')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/sitemap.ts'], rules, dir)
    expect(r.some(c => c.attributes.role === 'sitemap')).toBe(true)
  })

  it('assigns role=robots to app/robots.ts', () => {
    writeFileSync(join(dir, 'app', 'robots.ts'), 'export default function robots() { return {} }')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/robots.ts'], rules, dir)
    expect(r.some(c => c.attributes.role === 'robots')).toBe(true)
  })

  it('assigns role=manifest to app/manifest.ts', () => {
    writeFileSync(join(dir, 'app', 'manifest.ts'), 'export default function manifest() { return {} }')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/manifest.ts'], rules, dir)
    expect(r.some(c => c.attributes.role === 'manifest')).toBe(true)
  })

  it('assigns role=og-image to app/**/opengraph-image.tsx', () => {
    writeFileSync(join(dir, 'app', 'opengraph-image.tsx'), 'export default function OgImage() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/opengraph-image.tsx'], rules, dir)
    expect(r.some(c => c.attributes.role === 'og-image')).toBe(true)
  })

  it('assigns role=og-image to app/**/twitter-image.tsx', () => {
    writeFileSync(join(dir, 'app', 'twitter-image.tsx'), 'export default function TwitterImage() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/twitter-image.tsx'], rules, dir)
    expect(r.some(c => c.attributes.role === 'og-image')).toBe(true)
  })

  it('assigns role=instrumentation to instrumentation.ts at root', () => {
    writeFileSync(join(dir, 'instrumentation.ts'), 'export async function register() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['instrumentation.ts'], rules, dir)
    expect(r.some(c => c.attributes.role === 'instrumentation')).toBe(true)
  })

  it('assigns role=instrumentation to instrumentation-client.ts at root', () => {
    writeFileSync(join(dir, 'instrumentation-client.ts'), 'export function onRouterTransitionStart() {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['instrumentation-client.ts'], rules, dir)
    expect(r.some(c => c.attributes.role === 'instrumentation')).toBe(true)
  })

  it('assigns role=mdx-components to mdx-components.tsx at root', () => {
    writeFileSync(join(dir, 'mdx-components.tsx'), 'export function useMDXComponents(components) { return components }')
    const rules = nextjsPlugin.rules()
    const r = runRules(['mdx-components.tsx'], rules, dir)
    expect(r.some(c => c.attributes.role === 'mdx-components')).toBe(true)
  })

  it('assigns role=route-handler and layer=bff to a route.ts outside app/api/', () => {
    mkdirSync(join(dir, 'app', 'webhooks'), { recursive: true })
    writeFileSync(join(dir, 'app', 'webhooks', 'route.ts'), 'export async function POST(req: Request) {}')
    const rules = nextjsPlugin.rules()
    const r = runRules(['app/webhooks/route.ts'], rules, dir)
    expect(r.some(c => c.attributes.role === 'route-handler')).toBe(true)
    expect(r.some(c => c.attributes.layer === 'bff')).toBe(true)
  })
})
