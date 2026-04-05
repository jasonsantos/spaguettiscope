import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverWorkspaces } from '../../workspace/index.js'

function makePackage(root: string, name: string) {
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name }))
}

describe('discoverWorkspaces', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-ws-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns single-package fallback when no workspace config', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'root' }))
    const packages = discoverWorkspaces(dir)
    expect(packages).toHaveLength(1)
    expect(packages[0].rel).toBe('.')
    expect(packages[0].root).toBe(dir)
    expect(packages[0].name).toBe('root')
  })

  it('reads pnpm-workspace.yaml to discover packages', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'monorepo' }))
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
    makePackage(join(dir, 'packages/web'), '@acme/web')
    makePackage(join(dir, 'packages/api'), '@acme/api')

    const packages = discoverWorkspaces(dir)
    const names = packages.map(p => p.name).sort()
    expect(names).toContain('@acme/web')
    expect(names).toContain('@acme/api')
  })

  it('falls back to package.json workspaces field', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['apps/*'] })
    )
    makePackage(join(dir, 'apps/frontend'), '@acme/frontend')

    const packages = discoverWorkspaces(dir)
    const names = packages.map(p => p.name)
    expect(names).toContain('@acme/frontend')
  })

  it('sets rel as relative path from project root', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'monorepo' }))
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
    makePackage(join(dir, 'packages/web'), '@acme/web')

    const packages = discoverWorkspaces(dir)
    const web = packages.find(p => p.name === '@acme/web')!
    expect(web.rel).toBe('packages/web')
  })
})
