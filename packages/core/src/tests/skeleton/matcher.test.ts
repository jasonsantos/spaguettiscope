import { describe, it, expect } from 'vitest'
import { matchFile } from '../../skeleton/matcher.js'
import type { SkeletonFile } from '../../skeleton/types.js'

describe('matchFile', () => {
  const projectRoot = '/project'

  it('returns empty object when no entries match', () => {
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] }],
    }
    expect(matchFile('/project/src/other/file.ts', skeleton, projectRoot)).toEqual({})
  })

  it('returns attributes when path matches a glob', () => {
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { domain: 'checkout', layer: 'bff' }, paths: ['src/checkout/**'] }],
    }
    const result = matchFile('/project/src/checkout/service.ts', skeleton, projectRoot)
    expect(result).toEqual({ domain: 'checkout', layer: 'bff' })
  })

  it('merges attributes from multiple matching entries', () => {
    const skeleton: SkeletonFile = {
      entries: [
        { attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] },
        { attributes: { tag: 'utils' }, paths: ['**/utils/**'] },
      ],
    }
    const result = matchFile('/project/src/checkout/utils/format.ts', skeleton, projectRoot)
    expect(result).toEqual({ domain: 'checkout', tag: 'utils' })
  })

  it('skips draft entries', () => {
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { '?': 'auth' }, paths: ['src/auth/**'], draft: true }],
    }
    expect(matchFile('/project/src/auth/service.ts', skeleton, projectRoot)).toEqual({})
  })

  it('works with absolute file path at project root', () => {
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { tag: 'utils' }, paths: ['**/utils/**'] }],
    }
    expect(matchFile('/project/src/utils/format.ts', skeleton, projectRoot)).toEqual({
      tag: 'utils',
    })
  })

  it('throws when absoluteFilePath is not under projectRoot', () => {
    const skeleton: SkeletonFile = { entries: [] }
    expect(() => matchFile('/other/src/file.ts', skeleton, projectRoot)).toThrow(
      'matchFile: absoluteFilePath must be under projectRoot'
    )
  })
})
