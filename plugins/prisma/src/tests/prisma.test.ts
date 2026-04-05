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
  })

  it('schema rule has correct path selector and yields role=schema, layer=data', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:schema')!
    expect(rule.selector.path).toBe('**/schema.prisma')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'schema' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  it('migration rule has correct path selector and yields role=migration, layer=data', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:migration')!
    expect(rule.selector.path).toBe('**/migrations/**')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'migration' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })

  it('seed rule has correct path selector and yields role=seed, layer=data', () => {
    const rules = prismaPlugin.rules()
    const rule = rules.find(r => r.id === 'prisma:seed')!
    expect(rule.selector.path).toBe('**/seed.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'seed' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'data' })
  })
})
