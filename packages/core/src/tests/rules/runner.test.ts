import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRules } from '../../rules/runner.js'
import type { Rule } from '../../rules/types.js'

describe('runRules', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-rules-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('returns empty when no rules match', () => {
    const rules: Rule[] = [
      {
        id: 'r1',
        selector: { path: 'src/checkout/**' },
        yields: [{ kind: 'concrete', key: 'domain', value: 'checkout' }],
      },
    ]
    expect(runRules(['src/other/file.ts'], rules, projectRoot)).toHaveLength(0)
  })

  it('returns concrete yield for matching path', () => {
    const rules: Rule[] = [
      {
        id: 'utils',
        selector: { path: '**/utils/**' },
        yields: [{ kind: 'concrete', key: 'tag', value: 'utils' }],
      },
    ]
    const result = runRules(['src/auth/utils/format.ts'], rules, projectRoot)
    expect(result).toHaveLength(1)
    expect(result[0].attributes).toEqual({ tag: 'utils' })
    expect(result[0].isUncertain).toBe(false)
  })

  it('extracts capture group into dimension value', () => {
    const rules: Rule[] = [
      {
        id: 'api',
        selector: { path: 'app/api/($1)/**/route.ts' },
        yields: [
          { kind: 'concrete', key: 'role', value: 'api-endpoint' },
          { kind: 'extracted', key: 'domain', capture: 1 },
        ],
      },
    ]
    const result = runRules(
      ['app/api/checkout/route.ts', 'app/api/payments/route.ts'],
      rules,
      projectRoot
    )
    expect(result).toHaveLength(2)
    const checkout = result.find(r => r.attributes.domain === 'checkout')!
    expect(checkout.attributes).toEqual({ role: 'api-endpoint', domain: 'checkout' })
    expect(checkout.pathPattern).toBe('app/api/checkout/**')
  })

  it('produces uncertain candidate with ? key', () => {
    const rules: Rule[] = [
      {
        id: 'modules',
        selector: { path: 'src/($1)/**' },
        yields: [{ kind: 'uncertain', capture: 1 }],
      },
    ]
    const result = runRules(['src/auth/service.ts', 'src/auth/types.ts'], rules, projectRoot)
    expect(result).toHaveLength(1)
    expect(result[0].attributes['?']).toBe('auth')
    expect(result[0].isUncertain).toBe(true)
    expect(result[0].source).toBe('modules')
  })

  it('collapses multiple files into one candidate per rule+captured value', () => {
    const rules: Rule[] = [
      {
        id: 'dom',
        selector: { path: 'src/checkout/**' },
        yields: [{ kind: 'concrete', key: 'domain', value: 'checkout' }],
      },
    ]
    const result = runRules(
      ['src/checkout/service.ts', 'src/checkout/types.ts'],
      rules,
      projectRoot
    )
    expect(result).toHaveLength(1)
  })

  it('skips disabled rules', () => {
    const rules: Rule[] = [
      {
        id: 'skip-me',
        selector: { path: '**/*.ts' },
        yields: [{ kind: 'concrete', key: 'tag', value: 'ts' }],
      },
    ]
    expect(runRules(['src/index.ts'], rules, projectRoot, new Set(['skip-me']))).toHaveLength(0)
  })

  it('applies content predicate — only matches files with matching content', () => {
    writeFileSync(
      join(projectRoot, 'Button.tsx'),
      "'use client'\nexport default function Button() {}"
    )
    writeFileSync(join(projectRoot, 'Page.tsx'), 'export default function Page() {}')

    const rules: Rule[] = [
      {
        id: 'client',
        selector: { path: '**/*.tsx', content: "^'use client'" },
        yields: [{ kind: 'concrete', key: 'layer', value: 'client-component' }],
      },
    ]
    const result = runRules(['Button.tsx', 'Page.tsx'], rules, projectRoot)
    expect(result).toHaveLength(1)
    expect(result[0].attributes.layer).toBe('client-component')
  })
})
