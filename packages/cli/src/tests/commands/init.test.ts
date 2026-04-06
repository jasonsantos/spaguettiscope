import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runInit } from '../../commands/init.js'

describe('runInit', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-init-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-project' }))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('throws when spasco.config.json already exists', async () => {
    writeFileSync(join(dir, 'spasco.config.json'), '{}')
    await expect(runInit({ projectRoot: dir })).rejects.toThrow('spasco.config.json already exists')
  })

  it('throws when spaguettiscope.config.json already exists', async () => {
    writeFileSync(join(dir, 'spaguettiscope.config.json'), '{}')
    await expect(runInit({ projectRoot: dir })).rejects.toThrow('spasco.config.json already exists')
  })

  it('writes spasco.config.json with project name from package.json', async () => {
    await runInit({ projectRoot: dir })
    expect(existsSync(join(dir, 'spasco.config.json'))).toBe(true)
    const config = JSON.parse(readFileSync(join(dir, 'spasco.config.json'), 'utf-8'))
    expect(config.name).toBe('my-project')
    expect(Array.isArray(config.dashboard.connectors)).toBe(true)
  })

  it('writes config with empty connectors when nothing detected', async () => {
    await runInit({ projectRoot: dir })
    const config = JSON.parse(readFileSync(join(dir, 'spasco.config.json'), 'utf-8'))
    expect(config.dashboard.connectors).toHaveLength(0)
  })

  it('detects vitest JSON files and includes them as connectors', async () => {
    mkdirSync(join(dir, '.spasco'))
    writeFileSync(join(dir, '.spasco', 'vitest.json'), JSON.stringify({ testResults: [] }))
    await runInit({ projectRoot: dir })
    const config = JSON.parse(readFileSync(join(dir, 'spasco.config.json'), 'utf-8'))
    expect(config.dashboard.connectors).toHaveLength(1)
    expect(config.dashboard.connectors[0]).toEqual({
      id: 'vitest',
      reportFile: '.spasco/vitest.json',
    })
  })

  it('detects lcov.info and includes it with packageRoot', async () => {
    mkdirSync(join(dir, 'coverage'))
    writeFileSync(
      join(dir, 'coverage', 'lcov.info'),
      'SF:src/index.ts\nLF:10\nLH:8\nend_of_record\n'
    )
    await runInit({ projectRoot: dir })
    const config = JSON.parse(readFileSync(join(dir, 'spasco.config.json'), 'utf-8'))
    expect(config.dashboard.connectors).toHaveLength(1)
    expect(config.dashboard.connectors[0]).toEqual({
      id: 'lcov',
      lcovFile: 'coverage/lcov.info',
      packageRoot: '.',
    })
  })

  it('omits name field when no package.json at projectRoot', async () => {
    rmSync(join(dir, 'package.json'))
    await runInit({ projectRoot: dir })
    const config = JSON.parse(readFileSync(join(dir, 'spasco.config.json'), 'utf-8'))
    expect(config.name).toBeUndefined()
  })
})
