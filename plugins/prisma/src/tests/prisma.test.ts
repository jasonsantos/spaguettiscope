import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { prismaPlugin } from '../index.js'

describe('prismaPlugin.canApply', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-prisma-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when @prisma/client is in dependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'api', dependencies: { '@prisma/client': '5.0.0' } })
    )
    expect(prismaPlugin.canApply(dir)).toBe(true)
  })

  it('returns true when prisma is in devDependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'api', devDependencies: { prisma: '5.0.0' } })
    )
    expect(prismaPlugin.canApply(dir)).toBe(true)
  })

  it('returns true when both @prisma/client and prisma are present', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'api',
        dependencies: { '@prisma/client': '5.0.0' },
        devDependencies: { prisma: '5.0.0' },
      })
    )
    expect(prismaPlugin.canApply(dir)).toBe(true)
  })

  it('returns false when neither @prisma/client nor prisma is present', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'api', dependencies: { express: '4.0.0' } })
    )
    expect(prismaPlugin.canApply(dir)).toBe(false)
  })

  it('returns false when package.json does not exist', () => {
    expect(prismaPlugin.canApply(dir)).toBe(false)
  })
})

describe('prismaPlugin.rules', () => {
  it('returns rules array with expected ids', () => {
    const rules = prismaPlugin.rules()
    const ids = rules.map(r => r.id)
    expect(ids).toContain('prisma:schema')
    expect(ids).toContain('prisma:migration')
    expect(ids).toContain('prisma:seed')
    expect(ids).toContain('prisma:db-client')
    expect(ids).toContain('prisma:db-middleware')
    expect(ids).toContain('prisma:repository')
  })

  // ── Schema ──────────────────────────────────────────────────────────────────

  it('schema rule has correct path selector and yields role=schema, layer=data', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:schema')!
    expect(rule.selector.path).toBe('**/schema.prisma')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'schema' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── Migration ────────────────────────────────────────────────────────────────

  it('migration rule has correct path selector and yields role=migration, layer=data', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:migration')!
    expect(rule.selector.path).toBe('**/migrations/**')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'migration' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── DB client ─────────────────────────────────────────────────────────────────

  it('db-client rule has a content predicate', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:db-client')!
    expect(rule.selector.content).toBeDefined()
  })

  it('db-client rule content predicate matches PrismaClient import', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:db-client')!
    expect(new RegExp(rule.selector.content!).test("import { PrismaClient } from '@prisma/client'")).toBe(true)
  })

  it('db-client rule content predicate matches PrismaClient in globalThis singleton pattern', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:db-client')!
    expect(new RegExp(rule.selector.content!).test('const globalForPrisma = global as unknown as { prisma: PrismaClient }')).toBe(true)
  })

  it('db-client rule yields role=db-client and layer=data', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:db-client')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'db-client' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── DB middleware ─────────────────────────────────────────────────────────────

  it('db-middleware rule has a content predicate', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:db-middleware')!
    expect(rule.selector.content).toBeDefined()
  })

  it('db-middleware rule content predicate matches $extends( call', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:db-middleware')!
    expect(new RegExp(rule.selector.content!).test('prisma.$extends({')).toBe(true)
  })

  it('db-middleware rule content predicate matches $use( call', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:db-middleware')!
    expect(new RegExp(rule.selector.content!).test('prisma.$use(async (params, next) => {')).toBe(true)
  })

  it('db-middleware rule content predicate does not match unrelated content', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:db-middleware')!
    expect(new RegExp(rule.selector.content!).test("import { PrismaClient } from '@prisma/client'")).toBe(false)
  })

  it('db-middleware rule yields role=db-middleware and layer=data', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:db-middleware')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'db-middleware' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── Repository ────────────────────────────────────────────────────────────────

  it('repository rule has a content predicate', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:repository')!
    expect(rule.selector.content).toBeDefined()
  })

  it('repository rule content predicate matches single-quote @prisma/client import', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:repository')!
    expect(new RegExp(rule.selector.content!).test("import { User, Post } from '@prisma/client'")).toBe(true)
  })

  it('repository rule content predicate matches double-quote @prisma/client import', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:repository')!
    expect(new RegExp(rule.selector.content!).test('import { User } from "@prisma/client"')).toBe(true)
  })

  it('repository rule content predicate does not match unrelated import', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:repository')!
    expect(new RegExp(rule.selector.content!).test("import { something } from './utils'")).toBe(false)
  })

  it('repository rule yields role=repository and layer=data', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:repository')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'repository' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  // ── Seed ─────────────────────────────────────────────────────────────────────

  it('seed rule has correct path selector and yields role=seed, layer=data', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:seed')!
    expect(rule.selector.path).toBe('**/seed.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'seed' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })
})
