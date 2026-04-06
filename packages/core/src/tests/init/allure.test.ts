import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { allureDetector } from '../../init/detectors/allure.js'

describe('allureDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-allure-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty when no allure-results dir', () => {
    expect(allureDetector.detect(dir, dir)).toHaveLength(0)
  })

  it('detects allure-results/ directory', () => {
    mkdirSync(join(dir, 'allure-results'))
    writeFileSync(join(dir, 'allure-results', 'test-001.json'), '{}')
    const results = allureDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({ id: 'allure', resultsDir: 'allure-results' })
  })

  it('returns relative path from projectRoot for nested package', () => {
    const projectRoot = dir
    const pkgRoot = join(dir, 'apps', 'web')
    mkdirSync(join(pkgRoot, 'allure-results'), { recursive: true })
    writeFileSync(join(pkgRoot, 'allure-results', 'result.json'), '{}')
    const results = allureDetector.detect(pkgRoot, projectRoot)
    expect(results[0].config.resultsDir).toBe('apps/web/allure-results')
  })
})
