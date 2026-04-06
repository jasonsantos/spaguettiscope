import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { playwrightDetector } from '../../init/detectors/playwright.js'

describe('playwrightDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-pw-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty array when no playwright output found', () => {
    const results = playwrightDetector.detect(dir, dir)
    expect(results).toHaveLength(0)
  })

  it('detects playwright-report/ directory', () => {
    mkdirSync(join(dir, 'playwright-report'))
    writeFileSync(join(dir, 'playwright-report', 'index.html'), '<html/>')
    const results = playwrightDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({ id: 'playwright', resultsDir: 'playwright-report' })
  })

  it('detects test-results/ directory when playwright.config.ts exists', () => {
    mkdirSync(join(dir, 'test-results'))
    writeFileSync(join(dir, 'playwright.config.ts'), 'export default {}')
    const results = playwrightDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({ id: 'playwright', resultsDir: 'test-results' })
  })

  it('returns relative path from projectRoot for nested package', () => {
    const projectRoot = dir
    const pkgRoot = join(dir, 'apps', 'e2e')
    mkdirSync(join(pkgRoot, 'playwright-report'), { recursive: true })
    writeFileSync(join(pkgRoot, 'playwright-report', 'index.html'), '<html/>')
    const results = playwrightDetector.detect(pkgRoot, projectRoot)
    expect(results[0].config.resultsDir).toBe('apps/e2e/playwright-report')
  })
})
