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

  it('filters out entries missing attributes or paths', () => {
    const path = join(dir, 'skeleton.yaml')
    const raw = `- attributes:\n    domain: checkout\n  paths:\n    - src/checkout/**\n- notAnEntry: true\n- attributes:\n    domain: auth\n`
    writeFileSync(path, raw)
    const read = readSkeleton(path)
    // Only the first entry is valid (has both attributes and paths)
    expect(read.entries).toHaveLength(1)
    expect(read.entries[0].attributes.domain).toBe('checkout')
  })

  it('throws a descriptive error for malformed YAML', () => {
    const path = join(dir, 'bad.yaml')
    writeFileSync(path, 'not: valid: yaml: content:\n  broken: [unclosed')
    expect(() => readSkeleton(path)).toThrow(/Failed to parse skeleton file/)
  })

  describe('layerPolicy IO', () => {
    it('round-trips layerPolicy through write and read', () => {
      const path = join(dir, 'skeleton-lp.yaml')
      const skeleton: SkeletonFile = {
        entries: [{ attributes: { role: 'test' }, paths: ['src/**/*.test.ts'] }],
        layerPolicy: {
          'packages/core': [
            { from: 'rules', to: 'graph', kind: 'concrete' as const },
            { from: 'analysis', to: 'graph', kind: 'typeOnly' as const },
          ],
        },
        layerPolicyDraft: true,
      }

      writeSkeleton(path, skeleton)
      const loaded = readSkeleton(path)

      expect(loaded.layerPolicy).toEqual(skeleton.layerPolicy)
      expect(loaded.layerPolicyDraft).toBe(true)
    })

    it('reads skeleton without layerPolicy (backwards compat)', () => {
      const path = join(dir, 'skeleton-legacy.yaml')
      writeFileSync(path, '- attributes:\n    role: test\n  paths:\n    - "src/**"\n')
      const loaded = readSkeleton(path)

      expect(loaded.entries).toHaveLength(1)
      expect(loaded.layerPolicy).toBeUndefined()
      expect(loaded.layerPolicyDraft).toBeUndefined()
    })

    it('round-trips layerPolicy without draft flag', () => {
      const path = join(dir, 'skeleton-lp2.yaml')
      const skeleton: SkeletonFile = {
        entries: [],
        layerPolicy: {
          'packages/reports': [
            { from: 'renderer', to: 'model', kind: 'concrete' as const },
            { from: 'connectors', to: 'renderer', kind: 'typeOnly' as const },
          ],
        },
      }

      writeSkeleton(path, skeleton)
      const loaded = readSkeleton(path)

      expect(loaded.layerPolicy!['packages/reports']).toEqual(
        skeleton.layerPolicy!['packages/reports']
      )
      expect(loaded.layerPolicyDraft).toBeUndefined()
    })
  })
})
