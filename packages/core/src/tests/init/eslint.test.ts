import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { eslintDetector } from '../../init/detectors/eslint.js'

describe('eslintDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-eslint-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty when no eslint report found', () => {
    expect(eslintDetector.detect(dir, dir)).toHaveLength(0)
  })

  it('detects eslint-report.json in root', () => {
    writeFileSync(join(dir, 'eslint-report.json'), '[]')
    const results = eslintDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({ id: 'eslint', reportFile: 'eslint-report.json' })
  })

  it('detects eslint JSON in .spasco/', () => {
    mkdirSync(join(dir, '.spasco'))
    writeFileSync(join(dir, '.spasco', 'eslint.json'), '[]')
    const results = eslintDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config.reportFile).toBe('.spasco/eslint.json')
  })

  it('ignores non-eslint JSON files', () => {
    writeFileSync(join(dir, 'vitest-report.json'), '[]')
    expect(eslintDetector.detect(dir, dir)).toHaveLength(0)
  })
})
