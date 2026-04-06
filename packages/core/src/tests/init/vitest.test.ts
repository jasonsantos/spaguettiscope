import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { vitestDetector } from '../../init/detectors/vitest.js'

describe('vitestDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-vitest-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty array when no vitest config or output found', () => {
    const results = vitestDetector.detect(dir, dir)
    expect(results).toHaveLength(0)
  })

  it('detects vitest JSON output in .spasco/', () => {
    mkdirSync(join(dir, '.spasco'))
    writeFileSync(
      join(dir, '.spasco', 'vitest-report.json'),
      JSON.stringify({ testResults: [], numTotalTestSuites: 0 })
    )
    const results = vitestDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({ id: 'vitest', reportFile: '.spasco/vitest-report.json' })
  })

  it('detects multiple vitest JSON files', () => {
    mkdirSync(join(dir, '.spasco'))
    writeFileSync(join(dir, '.spasco', 'vitest-core.json'), JSON.stringify({ testResults: [] }))
    writeFileSync(join(dir, '.spasco', 'vitest-cli.json'), JSON.stringify({ testResults: [] }))
    const results = vitestDetector.detect(dir, dir)
    expect(results).toHaveLength(2)
    const files = results.map(r => r.config.reportFile as string).sort()
    expect(files).toEqual(['.spasco/vitest-cli.json', '.spasco/vitest-core.json'])
  })

  it('ignores JSON files in .spasco/ that are not vitest format', () => {
    mkdirSync(join(dir, '.spasco'))
    writeFileSync(join(dir, '.spasco', 'summary.json'), JSON.stringify({ overall: { total: 5 } }))
    const results = vitestDetector.detect(dir, dir)
    expect(results).toHaveLength(0)
  })

  it('returns relative paths from projectRoot when package is nested', () => {
    const projectRoot = dir
    const pkgRoot = join(dir, 'packages', 'core')
    mkdirSync(join(pkgRoot, '.spasco'), { recursive: true })
    writeFileSync(join(pkgRoot, '.spasco', 'vitest.json'), JSON.stringify({ testResults: [] }))
    const results = vitestDetector.detect(pkgRoot, projectRoot)
    expect(results[0].config.reportFile).toBe('packages/core/.spasco/vitest.json')
  })
})
