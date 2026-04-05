import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runAnnotateResolve } from '../../commands/annotate.js'
import { readSkeleton } from '@spaguettiscope/core'

function makeProject(dir: string, skeletonYaml: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'spaguettiscope.config.json'),
    JSON.stringify({ name: 'test', dashboard: { connectors: [] } })
  )
  writeFileSync(join(dir, 'spaguettiscope.skeleton.yaml'), skeletonYaml)
}

describe('runAnnotateResolve', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-annotate-${Date.now()}`)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('resolves ? entry to named dimension', async () => {
    makeProject(dir, `- attributes:\n    "?": auth\n  paths:\n    - src/auth/**\n  draft: true\n`)
    await runAnnotateResolve({ values: ['auth'], all: false, as: 'domain', projectRoot: dir })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'auth' })
    expect((skeleton.entries[0] as any).draft).toBeUndefined()
  })

  it('adds extra attributes during resolution', async () => {
    makeProject(dir, `- attributes:\n    "?": auth\n  paths:\n    - src/auth/**\n  draft: true\n`)
    await runAnnotateResolve({
      values: ['auth'],
      all: false,
      as: 'domain',
      add: 'layer=service,tag=tentative',
      projectRoot: dir,
    })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({
      domain: 'auth',
      layer: 'service',
      tag: 'tentative',
    })
  })

  it('resolves all ? entries when all=true', async () => {
    makeProject(
      dir,
      [
        `- attributes:`,
        `    "?": auth`,
        `  paths:`,
        `    - src/auth/**`,
        `  draft: true`,
        `- attributes:`,
        `    "?": clients`,
        `  paths:`,
        `    - src/clients/**`,
        `  draft: true`,
      ].join('\n')
    )
    await runAnnotateResolve({ values: [], all: true, as: 'domain', projectRoot: dir })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'auth' })
    expect(skeleton.entries[1].attributes).toEqual({ domain: 'clients' })
  })

  it('leaves non-targeted ? entries untouched', async () => {
    makeProject(
      dir,
      [
        `- attributes:`,
        `    "?": auth`,
        `  paths:`,
        `    - src/auth/**`,
        `  draft: true`,
        `- attributes:`,
        `    "?": clients`,
        `  paths:`,
        `    - src/clients/**`,
        `  draft: true`,
      ].join('\n')
    )
    await runAnnotateResolve({ values: ['auth'], all: false, as: 'domain', projectRoot: dir })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'auth' })
    expect(skeleton.entries[1].attributes['?']).toBe('clients')
  })

  it('does not touch already-resolved entries', async () => {
    makeProject(
      dir,
      [`- attributes:`, `    domain: checkout`, `  paths:`, `    - src/checkout/**`].join('\n')
    )
    await runAnnotateResolve({ values: [], all: true, as: 'domain', projectRoot: dir })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'checkout' })
  })
})
