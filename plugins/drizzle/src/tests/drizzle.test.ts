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
  })

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
})
