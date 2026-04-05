import type { Rule } from '@spaguettiscope/core'

export const playwrightRules: Rule[] = [
  // ---------------------------------------------------------------------------
  // playwright.config.ts — the orchestration entry point.
  // Named exactly `playwright.config.ts` anywhere in the tree (monorepos may
  // keep it under `apps/e2e/`). The defineConfig( call is the definitive signal.
  // ---------------------------------------------------------------------------
  {
    id: 'playwright:config',
    selector: {
      path: '**/playwright.config.ts',
      content: 'defineConfig\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'playwright-config' },
      { kind: 'concrete', key: 'layer', value: 'test' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Auth-setup files — run as a dedicated Playwright "setup" project and write
  // storageState to disk so subsequent test projects can reuse auth cookies.
  // Real-world names: `auth.setup.ts`, `admin.auth.setup.ts`.
  //
  // Content signal: `test as setup` is the Playwright-recommended alias for the
  // setup task import (documented in the Playwright auth guide). It appears in
  // the first line of every auth setup file and is absent from fixture files
  // (which use `test as base`) and spec files (which import `test` directly).
  // ---------------------------------------------------------------------------
  {
    id: 'playwright:auth-setup',
    selector: {
      path: '**/*.setup.ts',
      content: 'test as setup',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'auth-setup' },
      { kind: 'concrete', key: 'layer', value: 'test' },
    ],
  },

  // ---------------------------------------------------------------------------
  // E2E spec files — enrich generic test files that import @playwright/test
  // with the `layer: e2e` tag. The path predicate narrows to *.spec.ts; the
  // content predicate confirms the Playwright import (always in the first few
  // lines, well within the 200-char window).
  // ---------------------------------------------------------------------------
  {
    id: 'playwright:spec',
    selector: {
      path: '**/*.spec.ts',
      content: "from '@playwright/test'",
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'test' },
      { kind: 'concrete', key: 'layer', value: 'e2e' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Fixture files — files that export an extended test object via test.extend().
  // The fixture wraps page objects with automatic setup/teardown and provides
  // them as named parameters to tests (e.g. `loginPage`, `homePage`).
  // ---------------------------------------------------------------------------
  {
    id: 'playwright:fixture',
    selector: {
      path: '**/*.ts',
      content: 'test\\.extend\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'fixture' },
      { kind: 'concrete', key: 'layer', value: 'test' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Page Object Model files — path-based detection via `*.page.ts` naming.
  // The `<name>.page.ts` convention is the dominant real-world pattern for POM
  // files (login.page.ts, checkout.page.ts, base.page.ts, coupons.page.ts).
  // It cleanly excludes spec files (*.spec.ts) and setup files (*.setup.ts).
  // Content signal `from '@playwright/test'` confirms the file is Playwright
  // code, not an unrelated application module that happens to use `.page.ts`.
  // This rule catches subclass POMs that extend a base class and therefore do
  // not redeclare `readonly page` themselves.
  // ---------------------------------------------------------------------------
  {
    id: 'playwright:page-object-path',
    selector: {
      path: '**/*.page.ts',
      content: "from '@playwright/test'",
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'page-object' },
      { kind: 'concrete', key: 'layer', value: 'test' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Page Object Model files — content-based detection via `readonly page`.
  // Catches POM base classes and top-level POMs that store the Page instance
  // explicitly (e.g. `readonly page: Page` in the constructor). This rule fires
  // even when the file is not named *.page.ts, covering unconventionally named
  // POMs and base classes in projects that don't use the `.page.ts` suffix.
  // ---------------------------------------------------------------------------
  {
    id: 'playwright:page-object-content',
    selector: {
      path: '**/*.ts',
      content: 'readonly page',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'page-object' },
      { kind: 'concrete', key: 'layer', value: 'test' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Page Object Model files — graph-based detection.
  // Catches POMs imported directly by spec files that use neither the
  // `*.page.ts` naming convention nor the `readonly page` pattern (e.g.
  // lightweight helper objects or utility classes used inline in tests).
  // ---------------------------------------------------------------------------
  {
    id: 'playwright:page-object',
    selector: {
      path: '**/*.ts',
      graph: { kind: 'imported-by', glob: '**/*.spec.ts' },
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'page-object' },
      { kind: 'concrete', key: 'layer', value: 'test' },
    ],
  },
]
