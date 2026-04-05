import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { nextjsPlugin } from '../index.js'

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
    expect(ids).toContain('nextjs:api-endpoint')
    expect(ids).toContain('nextjs:page')
    expect(ids).toContain('nextjs:layout')
    expect(ids).toContain('nextjs:client-component')
    expect(ids).toContain('nextjs:middleware')
  })

  it('api-endpoint rule yields role=api-endpoint, layer=bff, domain capture', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:api-endpoint')!
    expect(rule.selector.path).toBe('app/api/($1)/**/route.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'api-endpoint' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'bff' })
    expect(rule.yields).toContainEqual({ kind: 'extracted', key: 'domain', capture: 1 })
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
})
