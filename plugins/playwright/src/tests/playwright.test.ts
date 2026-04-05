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

describe('playwrightRules — config detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-pw-config-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches playwright.config.ts containing defineConfig(', () => {
    writeFileSync(
      join(projectRoot, 'playwright.config.ts'),
      "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ testDir: './tests' })"
    )
    const result = runRules(['playwright.config.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:config')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('playwright-config')
    expect(candidate!.attributes.layer).toBe('test')
  })

  it('matches playwright.config.ts in a nested monorepo package', () => {
    mkdirSync(join(projectRoot, 'apps', 'e2e'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'apps', 'e2e', 'playwright.config.ts'),
      "import { defineConfig } from '@playwright/test'\nexport default defineConfig({})"
    )
    const result = runRules(['apps/e2e/playwright.config.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:config')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('playwright-config')
  })

  it('does not match a playwright.config.ts without defineConfig(', () => {
    writeFileSync(
      join(projectRoot, 'playwright.config.ts'),
      "// empty config\nexport default {}"
    )
    const result = runRules(['playwright.config.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:config')
    expect(candidate).toBeUndefined()
  })

  it('does not match a non-config ts file even if it contains defineConfig(', () => {
    writeFileSync(
      join(projectRoot, 'vite.config.ts'),
      "import { defineConfig } from 'vite'\nexport default defineConfig({})"
    )
    const result = runRules(['vite.config.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:config')
    expect(candidate).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------

describe('playwrightRules — auth-setup detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-pw-auth-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches auth.setup.ts containing "test as setup"', () => {
    writeFileSync(
      join(projectRoot, 'auth.setup.ts'),
      "import { expect, test as setup } from '@playwright/test'\nconst authFile = '.auth/user.json'\nsetup('authenticate', async ({ page }) => { await page.context().storageState({ path: authFile }) })"
    )
    const result = runRules(['auth.setup.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:auth-setup')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('auth-setup')
    expect(candidate!.attributes.layer).toBe('test')
  })

  it('matches admin.auth.setup.ts containing "test as setup"', () => {
    mkdirSync(join(projectRoot, 'tests'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'tests', 'admin.auth.setup.ts'),
      "import { expect, test as setup } from '@playwright/test'\nsetup('authenticate admin', async ({ page }) => {})"
    )
    const result = runRules(['tests/admin.auth.setup.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:auth-setup')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('auth-setup')
  })

  it('does not match a setup file that does not contain "test as setup"', () => {
    writeFileSync(
      join(projectRoot, 'global.setup.ts'),
      "export default async function globalSetup() { console.log('setup') }"
    )
    const result = runRules(['global.setup.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:auth-setup')
    expect(candidate).toBeUndefined()
  })

  it('does not match a fixture file that uses "test as base"', () => {
    writeFileSync(
      join(projectRoot, 'fixtures.ts'),
      "import { test as base } from '@playwright/test'\nexport const test = base.extend({})"
    )
    const result = runRules(['fixtures.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:auth-setup')
    expect(candidate).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------

describe('playwrightRules — spec (e2e layer) detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-pw-spec-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('marks a *.spec.ts importing @playwright/test as role:test layer:e2e', () => {
    mkdirSync(join(projectRoot, 'tests'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'tests', 'login.spec.ts'),
      "import { test, expect } from '@playwright/test'\ntest('login', async ({ page }) => {})"
    )
    const result = runRules(['tests/login.spec.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:spec')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('test')
    expect(candidate!.attributes.layer).toBe('e2e')
  })

  it('does not match a *.spec.ts that does not import @playwright/test', () => {
    mkdirSync(join(projectRoot, 'src'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'src', 'utils.spec.ts'),
      "import { describe, it } from 'vitest'\ndescribe('utils', () => { it('works', () => {}) })"
    )
    const result = runRules(['src/utils.spec.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:spec')
    expect(candidate).toBeUndefined()
  })

  it('does not match a non-spec ts file that imports @playwright/test', () => {
    writeFileSync(
      join(projectRoot, 'helpers.ts'),
      "import { expect } from '@playwright/test'\nexport function assertVisible() {}"
    )
    const result = runRules(['helpers.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:spec')
    expect(candidate).toBeUndefined()
  })
})

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

// ---------------------------------------------------------------------------

describe('playwrightRules — page-object-path detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-pw-pom-path-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches login.page.ts that imports from @playwright/test (subclass POM)', () => {
    mkdirSync(join(projectRoot, 'pages'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'pages', 'login.page.ts'),
      "import type { Locator, Page } from '@playwright/test'\nimport { expect } from '@playwright/test'\nimport { BasePage } from './base.page'\nexport class LoginPage extends BasePage {}"
    )
    const result = runRules(['pages/login.page.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:page-object-path')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('page-object')
    expect(candidate!.attributes.layer).toBe('test')
  })

  it('matches base.page.ts that declares readonly page: Page', () => {
    mkdirSync(join(projectRoot, 'pages'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'pages', 'base.page.ts'),
      "import type { Page } from '@playwright/test'\nexport class BasePage { readonly page: Page; constructor(page: Page) { this.page = page } }"
    )
    const result = runRules(['pages/base.page.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:page-object-path')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('page-object')
  })

  it('matches a nested admin page object (pages/admin/coupons.page.ts)', () => {
    mkdirSync(join(projectRoot, 'pages', 'admin'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'pages', 'admin', 'coupons.page.ts'),
      "import type { Page } from '@playwright/test'\nimport { expect } from '@playwright/test'\nexport class AdminCouponsPage { readonly page: Page; constructor(page: Page) { this.page = page } }"
    )
    const result = runRules(['pages/admin/coupons.page.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:page-object-path')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('page-object')
  })

  it('does not match a *.page.ts file that does not import @playwright/test', () => {
    mkdirSync(join(projectRoot, 'app'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'app', 'home.page.ts'),
      "// Next.js page\nexport default function HomePage() { return null }"
    )
    const result = runRules(['app/home.page.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:page-object-path')
    expect(candidate).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------

describe('playwrightRules — page-object-content detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-pw-pom-content-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches a file with "readonly page" in first 200 chars', () => {
    writeFileSync(
      join(projectRoot, 'MyPage.ts'),
      "import type { Page } from '@playwright/test'\nexport class MyPage { readonly page: Page; constructor(page: Page) { this.page = page } }"
    )
    const result = runRules(['MyPage.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:page-object-content')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('page-object')
    expect(candidate!.attributes.layer).toBe('test')
  })

  it('does not match a file without "readonly page"', () => {
    writeFileSync(
      join(projectRoot, 'util.ts'),
      "export function helper() { return 42 }"
    )
    const result = runRules(['util.ts'], playwrightRules, projectRoot)
    const candidate = result.find(c => c.source === 'playwright:page-object-content')
    expect(candidate).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------

describe('playwrightRules — page-object graph detection', () => {
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
