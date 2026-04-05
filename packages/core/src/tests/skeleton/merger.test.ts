import { describe, it, expect } from 'vitest'
import { mergeSkeleton } from '../../skeleton/merger.js'
import type { SkeletonFile } from '../../skeleton/types.js'

describe('mergeSkeleton', () => {
  it('adds new candidate to empty skeleton', () => {
    const { skeleton, added } = mergeSkeleton(
      { entries: [] },
      [{ attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] }],
      ['src/checkout/service.ts']
    )
    expect(added).toBe(1)
    expect(skeleton.entries).toHaveLength(1)
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'checkout' })
  })

  it('skips candidates already covered by existing entries', () => {
    const existing: SkeletonFile = {
      entries: [{ attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] }]
    }
    const { added, unchanged } = mergeSkeleton(
      existing,
      [{ attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] }],
      ['src/checkout/service.ts']
    )
    expect(added).toBe(0)
    expect(unchanged).toBe(1)
  })

  it('marks resolved entries stale when no files match their paths', () => {
    const existing: SkeletonFile = {
      entries: [{ attributes: { domain: 'old' }, paths: ['src/old/**'] }]
    }
    const { skeleton, markedStale } = mergeSkeleton(
      existing,
      [],
      ['src/checkout/service.ts']
    )
    expect(markedStale).toBe(1)
    expect((skeleton.entries[0] as any).stale).toBe(true)
  })

  it('does not mark draft entries stale', () => {
    const existing: SkeletonFile = {
      entries: [{ attributes: { '?': 'auth' }, paths: ['src/auth/**'], draft: true }]
    }
    const { markedStale } = mergeSkeleton(existing, [], [])
    expect(markedStale).toBe(0)
  })

  it('marks uncertain candidates as draft entries', () => {
    const { skeleton } = mergeSkeleton(
      { entries: [] },
      [{ attributes: { '?': 'auth' }, paths: ['src/auth/**'], source: 'test-rule' }],
      ['src/auth/service.ts']
    )
    const entry = skeleton.entries[0] as any
    expect(entry.draft).toBe(true)
    expect(entry.attributes['?']).toBe('auth')
    expect(entry.source).toBe('test-rule')
  })

  it('preserves existing annotated entry and does not mark stale if files exist', () => {
    const existing: SkeletonFile = {
      entries: [{ attributes: { domain: 'auth', layer: 'service' }, paths: ['src/auth/**'] }]
    }
    const { skeleton, markedStale } = mergeSkeleton(
      existing,
      [],
      ['src/auth/service.ts', 'src/auth/types.ts']
    )
    expect(markedStale).toBe(0)
    expect((skeleton.entries[0] as any).stale).toBeUndefined()
  })
})
