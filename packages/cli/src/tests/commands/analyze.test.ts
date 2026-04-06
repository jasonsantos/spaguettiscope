import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runAnalyzeCommand } from '../../commands/analyze.js'

function makeProject(dir: string, skeletonYaml = '') {
  mkdirSync(join(dir, '.spasco'), { recursive: true })
  writeFileSync(
    join(dir, 'spasco.config.json'),
    JSON.stringify({ name: 'test', dashboard: { connectors: [] } })
  )
  if (skeletonYaml) {
    writeFileSync(join(dir, '.spasco', 'skeleton.yaml'), skeletonYaml)
  }
}

describe('runAnalyzeCommand', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-analyze-${Date.now()}`)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('completes without error when skeleton is empty', async () => {
    makeProject(dir, '')
    await expect(runAnalyzeCommand({ projectRoot: dir, ci: true })).resolves.not.toThrow()
  })

  it('returns findings array', async () => {
    makeProject(dir, '- attributes:\n    role: page\n  paths:\n    - src/auth/**\n')
    const result = await runAnalyzeCommand({ projectRoot: dir, ci: true })
    expect(Array.isArray(result.findings)).toBe(true)
  })

  it('returns zero findings for a project with no source files', async () => {
    makeProject(dir, '')
    const result = await runAnalyzeCommand({ projectRoot: dir, ci: true })
    expect(result.findings).toHaveLength(0)
  })

  it('exits with error count in summary', async () => {
    makeProject(dir, '')
    const result = await runAnalyzeCommand({ projectRoot: dir, ci: true })
    expect(typeof result.summary.error).toBe('number')
    expect(typeof result.summary.warning).toBe('number')
    expect(typeof result.summary.info).toBe('number')
  })
})
