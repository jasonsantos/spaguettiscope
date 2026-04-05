import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readSkeleton, writeSkeleton } from '../../skeleton/io.js'
import type { SkeletonFile } from '../../skeleton/types.js'

describe('skeleton IO', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-io-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('returns empty skeleton when file does not exist', () => {
    const result = readSkeleton(join(dir, 'missing.yaml'))
    expect(result).toEqual({ entries: [] })
  })

  it('round-trips a resolved entry', () => {
    const path = join(dir, 'skeleton.yaml')
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { domain: 'checkout', layer: 'bff' }, paths: ['app/api/checkout/**'] }]
    }
    writeSkeleton(path, skeleton)
    const read = readSkeleton(path)
    expect(read.entries).toHaveLength(1)
    expect(read.entries[0].attributes).toEqual({ domain: 'checkout', layer: 'bff' })
    expect(read.entries[0].paths).toEqual(['app/api/checkout/**'])
  })

  it('round-trips a draft entry with ? key', () => {
    const path = join(dir, 'skeleton.yaml')
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { '?': 'auth' }, paths: ['src/auth/**'], draft: true, source: 'test-rule' }]
    }
    writeSkeleton(path, skeleton)
    const read = readSkeleton(path)
    expect((read.entries[0] as any).draft).toBe(true)
    expect(read.entries[0].attributes['?']).toBe('auth')
    expect((read.entries[0] as any).source).toBe('test-rule')
  })

  it('round-trips a stale entry', () => {
    const path = join(dir, 'skeleton.yaml')
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { domain: 'old' }, paths: ['src/old/**'], stale: true }]
    }
    writeSkeleton(path, skeleton)
    const read = readSkeleton(path)
    expect((read.entries[0] as any).stale).toBe(true)
  })

  it('throws a descriptive error for malformed YAML', () => {
    const path = join(dir, 'bad.yaml')
    writeFileSync(path, 'not: valid: yaml: content:\n  broken: [unclosed')
    expect(() => readSkeleton(path)).toThrow(/Failed to parse skeleton file/)
  })
})
