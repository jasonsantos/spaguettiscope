import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { typescriptDetector } from '../../init/detectors/typescript.js'

describe('typescriptDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-ts-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty when no tsconfig.json', () => {
    expect(typescriptDetector.detect(dir, dir)).toHaveLength(0)
  })

  it('detects tsconfig.json in package root', () => {
    writeFileSync(join(dir, 'tsconfig.json'), '{}')
    const results = typescriptDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({ id: 'typescript', tsconfigFile: 'tsconfig.json' })
  })

  it('returns relative path from projectRoot for nested package', () => {
    const projectRoot = dir
    const pkgRoot = join(dir, 'packages', 'core')
    mkdirSync(pkgRoot, { recursive: true })
    writeFileSync(join(pkgRoot, 'tsconfig.json'), '{}')
    const results = typescriptDetector.detect(pkgRoot, projectRoot)
    expect(results[0].config.tsconfigFile).toBe('packages/core/tsconfig.json')
  })
})
