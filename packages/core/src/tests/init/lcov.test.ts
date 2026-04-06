import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { lcovDetector } from '../../init/detectors/lcov.js'

const LCOV_CONTENT = 'SF:src/index.ts\nLF:10\nLH:8\nend_of_record\n'

describe('lcovDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-lcov-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty array when no lcov.info found', () => {
    const results = lcovDetector.detect(dir, dir)
    expect(results).toHaveLength(0)
  })

  it('detects lcov.info in coverage/', () => {
    mkdirSync(join(dir, 'coverage'))
    writeFileSync(join(dir, 'coverage', 'lcov.info'), LCOV_CONTENT)
    const results = lcovDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({
      id: 'lcov',
      lcovFile: 'coverage/lcov.info',
      packageRoot: '.',
    })
  })

  it('detects lcov.info nested inside coverage subdirs', () => {
    mkdirSync(join(dir, 'coverage', 'v8'), { recursive: true })
    writeFileSync(join(dir, 'coverage', 'v8', 'lcov.info'), LCOV_CONTENT)
    const results = lcovDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config.lcovFile).toBe('coverage/v8/lcov.info')
  })

  it('sets packageRoot relative to projectRoot for nested packages', () => {
    const projectRoot = dir
    const pkgRoot = join(dir, 'packages', 'api')
    mkdirSync(join(pkgRoot, 'coverage'), { recursive: true })
    writeFileSync(join(pkgRoot, 'coverage', 'lcov.info'), LCOV_CONTENT)
    const results = lcovDetector.detect(pkgRoot, projectRoot)
    expect(results[0].config).toEqual({
      id: 'lcov',
      lcovFile: 'packages/api/coverage/lcov.info',
      packageRoot: 'packages/api',
    })
  })

  it('detects multiple lcov.info files in different subdirs', () => {
    mkdirSync(join(dir, 'coverage', 'unit'), { recursive: true })
    mkdirSync(join(dir, 'coverage', 'integration'), { recursive: true })
    writeFileSync(join(dir, 'coverage', 'unit', 'lcov.info'), LCOV_CONTENT)
    writeFileSync(join(dir, 'coverage', 'integration', 'lcov.info'), LCOV_CONTENT)
    const results = lcovDetector.detect(dir, dir)
    expect(results).toHaveLength(2)
  })
})
