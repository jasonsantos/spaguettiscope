import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse } from 'yaml'
import { runScan } from '../../commands/scan.js'

function makeProject(dir: string, files: Record<string, string> = {}) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'spaguettiscope.config.json'),
    JSON.stringify({ name: 'test-project', dashboard: { connectors: [] } })
  )
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(abs.substring(0, abs.lastIndexOf('/')), { recursive: true })
    writeFileSync(abs, content)
  }
}

describe('runScan', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-scan-${Date.now()}`)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates skeleton file with draft entry for test files', async () => {
    makeProject(dir, { 'src/auth/auth.test.ts': '// test' })
    await runScan({ projectRoot: dir })
    const skeletonPath = join(dir, 'spaguettiscope.skeleton.yaml')
    expect(existsSync(skeletonPath)).toBe(true)
    const entries = parse(readFileSync(skeletonPath, 'utf-8')) as any[]
    const testEntry = entries.find((e: any) => e.attributes?.role === 'test')
    expect(testEntry).toBeDefined()
  })

  it('does not overwrite existing annotated entries on re-scan', async () => {
    makeProject(dir, { 'src/auth/auth.test.ts': '// test' })
    // First scan
    await runScan({ projectRoot: dir })
    // Manually annotate skeleton
    const skeletonPath = join(dir, 'spaguettiscope.skeleton.yaml')
    writeFileSync(
      skeletonPath,
      `- attributes:\n    domain: auth\n    layer: service\n  paths:\n    - src/auth/**\n`
    )
    // Second scan — should not remove the annotated entry
    await runScan({ projectRoot: dir })
    const entries = parse(readFileSync(skeletonPath, 'utf-8')) as any[]
    const authEntry = entries.find((e: any) => e.attributes?.domain === 'auth')
    expect(authEntry).toBeDefined()
    expect(authEntry.attributes.layer).toBe('service')
  })

  it('marks entries stale when their paths no longer exist', async () => {
    makeProject(dir, {})
    // Start with a skeleton entry for a path that has no files
    const skeletonPath = join(dir, 'spaguettiscope.skeleton.yaml')
    writeFileSync(skeletonPath, `- attributes:\n    domain: old\n  paths:\n    - src/old/**\n`)
    await runScan({ projectRoot: dir })
    const entries = parse(readFileSync(skeletonPath, 'utf-8')) as any[]
    const oldEntry = entries.find((e: any) => e.attributes?.domain === 'old')
    expect(oldEntry?.stale).toBe(true)
  })
})
