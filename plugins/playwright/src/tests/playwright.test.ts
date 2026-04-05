import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRules } from '@spaguettiscope/core'
import type { ImportGraph } from '@spaguettiscope/core'
import { canApply } from '../detect.js'
import { playwrightRules } from '../rules.js'

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

describe('canApply', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-pw-detect-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when @playwright/test is in dependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { '@playwright/test': '^1.40.0' } })
    )
    expect(canApply(dir)).toBe(true)
  })

  it('returns true when @playwright/test is in devDependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { '@playwright/test': '^1.40.0' } })
    )
    expect(canApply(dir)).toBe(true)
  })

  it('returns false when @playwright/test is absent', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^1.0.0' } })
    )
    expect(canApply(dir)).toBe(false)
  })

  it('returns false when package.json does not exist', () => {
    expect(canApply(join(dir, 'nonexistent'))).toBe(false)
  })

  it('returns false when package.json is malformed', () => {
    writeFileSync(join(dir, 'package.json'), 'not json')
    expect(canApply(dir)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

describe('playwrightRules — fixture detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-pw-rules-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches a file containing test.extend(', () => {
    writeFileSync(
      join(projectRoot, 'fixtures.ts'),
      "import { test } from '@playwright/test'\nexport const myTest = test.extend({ page: async ({}, use) => { await use(null as any) } })"
    )
    const result = runRules(['fixtures.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:fixture')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('fixture')
    expect(candidate!.attributes.layer).toBe('test')
  })

  it('does not match a file that does not contain test.extend(', () => {
    writeFileSync(join(projectRoot, 'helpers.ts'), 'export function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }')
    const result = runRules(['helpers.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:fixture')
    expect(candidate).toBeUndefined()
  })

  it('matches fixture in a nested directory', () => {
    mkdirSync(join(projectRoot, 'e2e', 'fixtures'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'e2e', 'fixtures', 'auth.ts'),
      "import { test } from '@playwright/test'\nexport const authTest = test.extend({})"
    )
    const result = runRules(['e2e/fixtures/auth.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:fixture')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('fixture')
  })
})

describe('playwrightRules — page-object detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-pw-pom-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('marks a .ts file as page-object when imported by a .spec.ts file', () => {
    const graph: ImportGraph = {
      imports: new Map([['e2e/login.spec.ts', new Set(['e2e/pages/LoginPage.ts'])]]),
      importedBy: new Map([['e2e/pages/LoginPage.ts', new Set(['e2e/login.spec.ts'])]]),
    }
    const result = runRules(
      ['e2e/pages/LoginPage.ts', 'e2e/login.spec.ts'],
      playwrightRules,
      projectRoot,
      { importGraph: graph }
    )
    const candidate = result.find(c => c.source === 'playwright:page-object')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('page-object')
    expect(candidate!.attributes.layer).toBe('test')
  })

  it('does not mark a .ts file as page-object when not imported by any spec', () => {
    const graph: ImportGraph = {
      imports: new Map(),
      importedBy: new Map(),
    }
    const result = runRules(['src/utils.ts'], playwrightRules, projectRoot, { importGraph: graph })
    const candidate = result.find(c => c.source === 'playwright:page-object')
    expect(candidate).toBeUndefined()
  })

  it('skips page-object rule when no import graph is provided', () => {
    const result = runRules(['e2e/pages/DashboardPage.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:page-object')
    expect(candidate).toBeUndefined()
  })
})
