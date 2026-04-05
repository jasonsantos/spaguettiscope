import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { drizzlePlugin } from '../index.js'

describe('drizzlePlugin.canApply', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-drizzle-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when drizzle-orm is in dependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'api', dependencies: { 'drizzle-orm': '0.30.0' } })
    )
    expect(drizzlePlugin.canApply(dir)).toBe(true)
  })

  it('returns true when drizzle-orm is in devDependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'api', devDependencies: { 'drizzle-orm': '0.30.0' } })
    )
    expect(drizzlePlugin.canApply(dir)).toBe(true)
  })

  it('returns false when drizzle-orm is not present', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'api', dependencies: { express: '4.0.0' } })
    )
    expect(drizzlePlugin.canApply(dir)).toBe(false)
  })

  it('returns false when package.json does not exist', () => {
    expect(drizzlePlugin.canApply(dir)).toBe(false)
  })
})

describe('drizzlePlugin.rules', () => {
  it('returns rules array with expected ids', () => {
    const rules = drizzlePlugin.rules()
    const ids = rules.map(r => r.id)
    expect(ids).toContain('drizzle:schema')
    expect(ids).toContain('drizzle:migration-sql')
    expect(ids).toContain('drizzle:migration-ts')
    expect(ids).toContain('drizzle:config')
    expect(ids).toContain('drizzle:db-client')
    expect(ids).toContain('drizzle:repository')
    expect(ids).toContain('drizzle:seed')
    expect(ids).toContain('drizzle:seed-dir')
  })

  // ── Schema ──────────────────────────────────────────────────────────────────

  it('schema rule has content predicate matching pgTable(', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:schema')!
    expect(rule.selector.content).toBeDefined()
    expect(new RegExp(rule.selector.content!).test('pgTable(')).toBe(true)
  })

  it('schema rule has content predicate matching mysqlTable(', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:schema')!
    expect(new RegExp(rule.selector.content!).test('mysqlTable(')).toBe(true)
  })

  it('schema rule has content predicate matching sqliteTable(', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:schema')!
    expect(new RegExp(rule.selector.content!).test('sqliteTable(')).toBe(true)
  })

  it('schema rule yields role=schema and layer=data', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:schema')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'schema' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── Migrations ───────────────────────────────────────────────────────────────

  it('migration-sql rule has correct path selector and yields role=migration, layer=data', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:migration-sql')!
    expect(rule.selector.path).toBe('**/migrations/**/*.sql')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'migration' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  it('migration-ts rule has correct path selector and yields role=migration, layer=data', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:migration-ts')!
    expect(rule.selector.path).toBe('**/migrations/**/*.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'migration' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── Config ───────────────────────────────────────────────────────────────────

  it('config rule matches drizzle.config.ts path', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:config')!
    expect(rule.selector.path).toMatch(/drizzle\.config/)
  })

  it('config rule content predicate matches defineConfig(', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:config')!
    expect(rule.selector.content).toBeDefined()
    expect(new RegExp(rule.selector.content!).test('defineConfig(')).toBe(true)
  })

  it('config rule yields role=drizzle-config and layer=data', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:config')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'drizzle-config' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── DB client ─────────────────────────────────────────────────────────────────

  it('db-client rule content predicate matches drizzle( call', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:db-client')!
    expect(rule.selector.content).toBeDefined()
    expect(new RegExp(rule.selector.content!).test('drizzle(')).toBe(true)
  })

  it('db-client rule yields role=db-client and layer=data', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:db-client')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'db-client' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── Repository ────────────────────────────────────────────────────────────────

  it('repository rule content predicate matches drizzle-orm import', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:repository')!
    expect(rule.selector.content).toBeDefined()
    expect(new RegExp(rule.selector.content!).test("from 'drizzle-orm'")).toBe(true)
    expect(new RegExp(rule.selector.content!).test('from "drizzle-orm"')).toBe(true)
  })

  it('repository rule has graph predicate importing from schema', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:repository')!
    expect(rule.selector.graph).toBeDefined()
    expect(rule.selector.graph).toMatchObject({ kind: 'imports', glob: '**/schema/**' })
  })

  it('repository rule yields role=repository and layer=data', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:repository')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'repository' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── Seeds ─────────────────────────────────────────────────────────────────────

  it('seed rule matches **/seed.ts path', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:seed')!
    expect(rule.selector.path).toBe('**/seed.ts')
  })

  it('seed rule yields role=seed and layer=data', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:seed')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'seed' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  it('seed-dir rule matches files inside a seeds/ directory', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:seed-dir')!
    expect(rule.selector.path).toBe('**/seeds/**/*.{ts,js,cjs,mjs}')
  })

  it('seed-dir rule yields role=seed and layer=data', () => {
    const rules = drizzlePlugin.rules()
    const rule = rules.find(r => r.id === 'drizzle:seed-dir')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'seed' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })
})
