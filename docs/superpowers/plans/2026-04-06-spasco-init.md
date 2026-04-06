# spasco init Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `spasco init` — a CLI command that auto-detects installed tools by scanning the repo
and writes a ready-to-use `spasco.config.json`.

**Architecture:** A new `InitDetector` interface lives in `@spaguettiscope/core/src/init/`. Six
built-in detectors (one per connector) scan the filesystem for well-known output files and return
`ConnectorConfig[]`. The CLI command orchestrates them: discover workspaces → run detectors → write
config. An `--interactive` flag enables a confirmation prompt loop using Node's `readline/promises`.

**Tech Stack:** TypeScript, Node.js `fs`/`path`/`readline/promises`, `commander` (already in CLI),
`vitest` for tests.

---

## File Structure

```
packages/core/src/init/
  interface.ts          ← InitDetector, DetectedConnector interfaces
  detectors/
    vitest.ts           ← finds vitest JSON reporter output files
    lcov.ts             ← finds lcov.info files under coverage/
    playwright.ts       ← finds playwright-report/ dirs
    allure.ts           ← finds allure-results/ dirs
    eslint.ts           ← finds eslint JSON report files
    typescript.ts       ← finds tsconfig.json presence
  index.ts              ← builtInDetectors array + re-exports

packages/core/src/index.ts              ← add: export * from './init/index.js'

packages/core/src/tests/init/
  vitest.test.ts
  lcov.test.ts
  playwright.test.ts
  allure.test.ts
  eslint.test.ts
  typescript.test.ts

packages/cli/src/commands/init.ts       ← runInit() implementation
packages/cli/src/index.ts              ← register init command
packages/cli/src/tests/commands/init.test.ts
```

---

### Task 1: Define `InitDetector` interface

**Files:**

- Create: `packages/core/src/init/interface.ts`

No tests needed — types only.

- [ ] **Step 1: Create the interface file**

```typescript
// packages/core/src/init/interface.ts
import type { ConnectorConfig } from '../config/schema.js'

export interface DetectedConnector {
  config: ConnectorConfig
  source: string // human-readable: "found at .spasco/vitest-core.json"
}

export interface InitDetector {
  readonly connectorId: string
  detect(packageRoot: string, projectRoot: string): DetectedConnector[]
}
```

- [ ] **Step 2: Create barrel (empty for now)**

```typescript
// packages/core/src/init/index.ts
export type { InitDetector, DetectedConnector } from './interface.js'
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/init/interface.ts packages/core/src/init/index.ts
git commit -m "feat(core): add InitDetector interface"
```

---

### Task 2: Vitest detector

**Files:**

- Create: `packages/core/src/init/detectors/vitest.ts`
- Test: `packages/core/src/tests/init/vitest.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/tests/init/vitest.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { vitestDetector } from '../../init/detectors/vitest.js'

describe('vitestDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-vitest-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty array when no vitest config or output found', () => {
    const results = vitestDetector.detect(dir, dir)
    expect(results).toHaveLength(0)
  })

  it('detects vitest JSON output in .spasco/', () => {
    mkdirSync(join(dir, '.spasco'))
    writeFileSync(
      join(dir, '.spasco', 'vitest-report.json'),
      JSON.stringify({ testResults: [], numTotalTestSuites: 0 })
    )
    const results = vitestDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({ id: 'vitest', reportFile: '.spasco/vitest-report.json' })
  })

  it('detects multiple vitest JSON files', () => {
    mkdirSync(join(dir, '.spasco'))
    writeFileSync(join(dir, '.spasco', 'vitest-core.json'), JSON.stringify({ testResults: [] }))
    writeFileSync(join(dir, '.spasco', 'vitest-cli.json'), JSON.stringify({ testResults: [] }))
    const results = vitestDetector.detect(dir, dir)
    expect(results).toHaveLength(2)
    const files = results.map(r => r.config.reportFile as string).sort()
    expect(files).toEqual(['.spasco/vitest-cli.json', '.spasco/vitest-core.json'])
  })

  it('ignores JSON files in .spasco/ that are not vitest format', () => {
    mkdirSync(join(dir, '.spasco'))
    writeFileSync(join(dir, '.spasco', 'summary.json'), JSON.stringify({ overall: { total: 5 } }))
    const results = vitestDetector.detect(dir, dir)
    expect(results).toHaveLength(0)
  })

  it('returns relative paths from projectRoot when package is nested', () => {
    const projectRoot = dir
    const pkgRoot = join(dir, 'packages', 'core')
    mkdirSync(join(pkgRoot, '.spasco'), { recursive: true })
    writeFileSync(join(pkgRoot, '.spasco', 'vitest.json'), JSON.stringify({ testResults: [] }))
    const results = vitestDetector.detect(pkgRoot, projectRoot)
    expect(results[0].config.reportFile).toBe('packages/core/.spasco/vitest.json')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose src/tests/init/vitest.test.ts
```

Expected: FAIL — `Cannot find module '../../init/detectors/vitest.js'`

- [ ] **Step 3: Implement vitest detector**

```typescript
// packages/core/src/init/detectors/vitest.ts
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

const SCAN_DIRS = ['.spasco', 'test-results']

function isVitestJson(filePath: string): boolean {
  try {
    const obj = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
    return Array.isArray(obj.testResults)
  } catch {
    return false
  }
}

export const vitestDetector: InitDetector = {
  connectorId: 'vitest',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const results: DetectedConnector[] = []
    for (const scanDir of SCAN_DIRS) {
      const absDir = join(packageRoot, scanDir)
      if (!existsSync(absDir)) continue
      let entries: string[]
      try {
        entries = readdirSync(absDir)
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue
        const absFile = join(absDir, entry)
        if (!isVitestJson(absFile)) continue
        const relFile = relative(projectRoot, absFile)
        results.push({
          config: { id: 'vitest', reportFile: relFile },
          source: `found at ${relFile}`,
        })
      }
    }
    return results
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose src/tests/init/vitest.test.ts
```

Expected: 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/init/detectors/vitest.ts packages/core/src/tests/init/vitest.test.ts
git commit -m "feat(core): add vitest InitDetector"
```

---

### Task 3: Lcov detector

**Files:**

- Create: `packages/core/src/init/detectors/lcov.ts`
- Test: `packages/core/src/tests/init/lcov.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/tests/init/lcov.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { lcovDetector } from '../../init/detectors/lcov.js'

const LCOV_CONTENT = 'SF:src/index.ts\nLF:10\nLH:8\nend_of_record\n'

describe('lcovDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-lcov-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty array when no lcov.info found', () => {
    const results = lcovDetector.detect(dir, dir)
    expect(results).toHaveLength(0)
  })

  it('detects lcov.info in coverage/', () => {
    mkdirSync(join(dir, 'coverage'))
    writeFileSync(join(dir, 'coverage', 'lcov.info'), LCOV_CONTENT)
    const results = lcovDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({
      id: 'lcov',
      lcovFile: 'coverage/lcov.info',
      packageRoot: '.',
    })
  })

  it('detects lcov.info nested inside coverage subdirs', () => {
    mkdirSync(join(dir, 'coverage', 'v8'), { recursive: true })
    writeFileSync(join(dir, 'coverage', 'v8', 'lcov.info'), LCOV_CONTENT)
    const results = lcovDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config.lcovFile).toBe('coverage/v8/lcov.info')
  })

  it('sets packageRoot relative to projectRoot for nested packages', () => {
    const projectRoot = dir
    const pkgRoot = join(dir, 'packages', 'api')
    mkdirSync(join(pkgRoot, 'coverage'), { recursive: true })
    writeFileSync(join(pkgRoot, 'coverage', 'lcov.info'), LCOV_CONTENT)
    const results = lcovDetector.detect(pkgRoot, projectRoot)
    expect(results[0].config).toEqual({
      id: 'lcov',
      lcovFile: 'packages/api/coverage/lcov.info',
      packageRoot: 'packages/api',
    })
  })

  it('detects multiple lcov.info files in different subdirs', () => {
    mkdirSync(join(dir, 'coverage', 'unit'), { recursive: true })
    mkdirSync(join(dir, 'coverage', 'integration'), { recursive: true })
    writeFileSync(join(dir, 'coverage', 'unit', 'lcov.info'), LCOV_CONTENT)
    writeFileSync(join(dir, 'coverage', 'integration', 'lcov.info'), LCOV_CONTENT)
    const results = lcovDetector.detect(dir, dir)
    expect(results).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose src/tests/init/lcov.test.ts
```

Expected: FAIL — `Cannot find module '../../init/detectors/lcov.js'`

- [ ] **Step 3: Implement lcov detector**

```typescript
// packages/core/src/init/detectors/lcov.ts
import { existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Dirent } from 'node:fs'
import type { InitDetector, DetectedConnector } from '../interface.js'

function findLcovFiles(dir: string): string[] {
  const results: string[] = []
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  for (const entry of entries) {
    const absPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findLcovFiles(absPath))
    } else if (entry.name === 'lcov.info') {
      results.push(absPath)
    }
  }
  return results
}

export const lcovDetector: InitDetector = {
  connectorId: 'lcov',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const coverageDir = join(packageRoot, 'coverage')
    if (!existsSync(coverageDir)) return []

    const pkgRel = relative(projectRoot, packageRoot) || '.'
    return findLcovFiles(coverageDir).map(absFile => {
      const relFile = relative(projectRoot, absFile)
      return {
        config: { id: 'lcov', lcovFile: relFile, packageRoot: pkgRel },
        source: `found at ${relFile}`,
      }
    })
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose src/tests/init/lcov.test.ts
```

Expected: 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/init/detectors/lcov.ts packages/core/src/tests/init/lcov.test.ts
git commit -m "feat(core): add lcov InitDetector"
```

---

### Task 4: Playwright detector

**Files:**

- Create: `packages/core/src/init/detectors/playwright.ts`
- Test: `packages/core/src/tests/init/playwright.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/tests/init/playwright.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose src/tests/init/playwright.test.ts
```

Expected: FAIL — `Cannot find module '../../init/detectors/playwright.js'`

- [ ] **Step 3: Implement playwright detector**

```typescript
// packages/core/src/init/detectors/playwright.ts
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

const CONFIG_FILES = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']

export const playwrightDetector: InitDetector = {
  connectorId: 'playwright',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const hasConfig = CONFIG_FILES.some(f => existsSync(join(packageRoot, f)))

    // playwright-report/ is always checked (default output dir)
    const reportDir = join(packageRoot, 'playwright-report')
    if (existsSync(reportDir)) {
      const rel = relative(projectRoot, reportDir)
      return [{ config: { id: 'playwright', resultsDir: rel }, source: `found at ${rel}` }]
    }

    // test-results/ only if playwright.config.* exists (avoid false positives)
    if (hasConfig) {
      const testResultsDir = join(packageRoot, 'test-results')
      if (existsSync(testResultsDir)) {
        const rel = relative(projectRoot, testResultsDir)
        return [{ config: { id: 'playwright', resultsDir: rel }, source: `found at ${rel}` }]
      }
    }

    return []
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose src/tests/init/playwright.test.ts
```

Expected: 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/init/detectors/playwright.ts packages/core/src/tests/init/playwright.test.ts
git commit -m "feat(core): add playwright InitDetector"
```

---

### Task 5: Allure, ESLint, and TypeScript detectors

These three detectors are simple existence checks. One test file each, implemented together.

**Files:**

- Create: `packages/core/src/init/detectors/allure.ts`
- Create: `packages/core/src/init/detectors/eslint.ts`
- Create: `packages/core/src/init/detectors/typescript.ts`
- Test: `packages/core/src/tests/init/allure.test.ts`
- Test: `packages/core/src/tests/init/eslint.test.ts`
- Test: `packages/core/src/tests/init/typescript.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/tests/init/allure.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { allureDetector } from '../../init/detectors/allure.js'

describe('allureDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-allure-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty when no allure-results dir', () => {
    expect(allureDetector.detect(dir, dir)).toHaveLength(0)
  })

  it('detects allure-results/ directory', () => {
    mkdirSync(join(dir, 'allure-results'))
    writeFileSync(join(dir, 'allure-results', 'test-001.json'), '{}')
    const results = allureDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({ id: 'allure', resultsDir: 'allure-results' })
  })

  it('returns relative path from projectRoot for nested package', () => {
    const projectRoot = dir
    const pkgRoot = join(dir, 'apps', 'web')
    mkdirSync(join(pkgRoot, 'allure-results'), { recursive: true })
    writeFileSync(join(pkgRoot, 'allure-results', 'result.json'), '{}')
    const results = allureDetector.detect(pkgRoot, projectRoot)
    expect(results[0].config.resultsDir).toBe('apps/web/allure-results')
  })
})
```

```typescript
// packages/core/src/tests/init/eslint.test.ts
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
```

```typescript
// packages/core/src/tests/init/typescript.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { typescriptDetector } from '../../init/detectors/typescript.js'

describe('typescriptDetector', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-ts-det-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty when no tsconfig.json', () => {
    expect(typescriptDetector.detect(dir, dir)).toHaveLength(0)
  })

  it('detects tsconfig.json in package root', () => {
    writeFileSync(join(dir, 'tsconfig.json'), '{}')
    const results = typescriptDetector.detect(dir, dir)
    expect(results).toHaveLength(1)
    expect(results[0].config).toEqual({ id: 'typescript', tsconfigFile: 'tsconfig.json' })
  })

  it('returns relative path from projectRoot for nested package', () => {
    const projectRoot = dir
    const pkgRoot = join(dir, 'packages', 'core')
    mkdirSync(pkgRoot, { recursive: true })
    writeFileSync(join(pkgRoot, 'tsconfig.json'), '{}')
    const results = typescriptDetector.detect(pkgRoot, projectRoot)
    expect(results[0].config.tsconfigFile).toBe('packages/core/tsconfig.json')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && pnpm test -- --reporter=verbose src/tests/init/allure.test.ts src/tests/init/eslint.test.ts src/tests/init/typescript.test.ts
```

Expected: FAIL — `Cannot find module` for all three

- [ ] **Step 3: Implement all three detectors**

```typescript
// packages/core/src/init/detectors/allure.ts
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

export const allureDetector: InitDetector = {
  connectorId: 'allure',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const absDir = join(packageRoot, 'allure-results')
    if (!existsSync(absDir)) return []
    const rel = relative(projectRoot, absDir)
    return [{ config: { id: 'allure', resultsDir: rel }, source: `found at ${rel}` }]
  },
}
```

```typescript
// packages/core/src/init/detectors/eslint.ts
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

// Common file names and directories to scan
const CANDIDATES: Array<{ dir?: string; filename: string }> = [
  { filename: 'eslint-report.json' },
  { filename: 'eslint-results.json' },
  { dir: '.spasco', filename: 'eslint.json' },
  { dir: '.spasco', filename: 'eslint-report.json' },
]

export const eslintDetector: InitDetector = {
  connectorId: 'eslint',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    for (const { dir, filename } of CANDIDATES) {
      const absFile = dir ? join(packageRoot, dir, filename) : join(packageRoot, filename)
      if (existsSync(absFile)) {
        const rel = relative(projectRoot, absFile)
        return [{ config: { id: 'eslint', reportFile: rel }, source: `found at ${rel}` }]
      }
    }
    return []
  },
}
```

```typescript
// packages/core/src/init/detectors/typescript.ts
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

export const typescriptDetector: InitDetector = {
  connectorId: 'typescript',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const absFile = join(packageRoot, 'tsconfig.json')
    if (!existsSync(absFile)) return []
    const rel = relative(projectRoot, absFile)
    return [{ config: { id: 'typescript', tsconfigFile: rel }, source: `found at ${rel}` }]
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose src/tests/init/allure.test.ts src/tests/init/eslint.test.ts src/tests/init/typescript.test.ts
```

Expected: all 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/init/detectors/ packages/core/src/tests/init/allure.test.ts packages/core/src/tests/init/eslint.test.ts packages/core/src/tests/init/typescript.test.ts
git commit -m "feat(core): add allure, eslint, typescript InitDetectors"
```

---

### Task 6: Wire `builtInDetectors` and export from core

**Files:**

- Modify: `packages/core/src/init/index.ts`
- Modify: `packages/core/src/index.ts`

No new tests — covered by detector tests.

- [ ] **Step 1: Update `packages/core/src/init/index.ts`**

```typescript
// packages/core/src/init/index.ts
export type { InitDetector, DetectedConnector } from './interface.js'
export { vitestDetector } from './detectors/vitest.js'
export { lcovDetector } from './detectors/lcov.js'
export { playwrightDetector } from './detectors/playwright.js'
export { allureDetector } from './detectors/allure.js'
export { eslintDetector } from './detectors/eslint.js'
export { typescriptDetector } from './detectors/typescript.js'

import { vitestDetector } from './detectors/vitest.js'
import { lcovDetector } from './detectors/lcov.js'
import { playwrightDetector } from './detectors/playwright.js'
import { allureDetector } from './detectors/allure.js'
import { eslintDetector } from './detectors/eslint.js'
import { typescriptDetector } from './detectors/typescript.js'
import type { InitDetector } from './interface.js'

export const builtInDetectors: InitDetector[] = [
  vitestDetector,
  lcovDetector,
  playwrightDetector,
  allureDetector,
  eslintDetector,
  typescriptDetector,
]
```

- [ ] **Step 2: Add export to `packages/core/src/index.ts`**

```typescript
// packages/core/src/index.ts — add one line at the end:
export * from './init/index.js'
```

- [ ] **Step 3: Build core to verify no TypeScript errors**

```bash
cd packages/core && pnpm build
```

Expected: exits 0, `dist/` updated

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/init/index.ts packages/core/src/index.ts
git commit -m "feat(core): export builtInDetectors from core"
```

---

### Task 7: `runInit` command (non-interactive) + integration test

**Files:**

- Create: `packages/cli/src/commands/init.ts`
- Test: `packages/cli/src/tests/commands/init.test.ts`

- [ ] **Step 1: Write the failing integration test**

```typescript
// packages/cli/src/tests/commands/init.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/cli && pnpm test -- --reporter=verbose src/tests/commands/init.test.ts
```

Expected: FAIL — `Cannot find module '../../commands/init.js'`

- [ ] **Step 3: Implement `runInit`**

```typescript
// packages/cli/src/commands/init.ts
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import {
  discoverWorkspaces,
  builtInDetectors,
  type InitDetector,
  type DetectedConnector,
} from '@spaguettiscope/core'
import { printWarning, printSuccess } from '../formatter/index.js'

export interface InitOptions {
  interactive?: boolean
  plugins?: string // comma-separated module IDs
  projectRoot?: string
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()

  // Guard: refuse if config already exists
  if (
    existsSync(join(projectRoot, 'spasco.config.json')) ||
    existsSync(join(projectRoot, 'spaguettiscope.config.json'))
  ) {
    throw new Error('spasco.config.json already exists. Remove it first to re-initialize.')
  }

  // Resolve project name from root package.json
  let projectName: string | undefined
  try {
    const rootPkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8')) as Record<
      string,
      unknown
    >
    if (typeof rootPkg.name === 'string') projectName = rootPkg.name
  } catch {
    // no root package.json — fine
  }

  // Discover workspaces
  const packages = discoverWorkspaces(projectRoot)

  // Collect all detectors
  const allDetectors: InitDetector[] = [...builtInDetectors]
  if (options.plugins) {
    for (const pluginId of options.plugins
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)) {
      try {
        const mod = (await import(pluginId)) as Record<string, unknown>
        const det = mod.detector
        if (det && typeof (det as InitDetector).detect === 'function') {
          allDetectors.push(det as InitDetector)
        }
      } catch {
        printWarning(`Failed to load plugin detector: ${pluginId}`)
      }
    }
  }

  // Run detectors across all workspaces
  let detected: DetectedConnector[] = []
  for (const pkg of packages) {
    for (const detector of allDetectors) {
      try {
        const results = detector.detect(pkg.root, projectRoot)
        detected.push(...results)
      } catch {
        // detector error — skip silently
      }
    }
  }

  // Interactive confirmation
  if (options.interactive && process.stdout.isTTY) {
    detected = await promptConfirmConnectors(detected, projectName)
    projectName = await promptProjectName(projectName)
  }

  // Build config
  const config: Record<string, unknown> = {
    ...(projectName !== undefined ? { name: projectName } : {}),
    dashboard: { connectors: detected.map(d => d.config) },
  }

  // Write
  const configPath = join(projectRoot, 'spasco.config.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')

  if (detected.length === 0) {
    printWarning('No connectors detected. Edit spasco.config.json to add them manually.')
  } else {
    printSuccess(
      `Detected ${detected.length} connector(s):\n` +
        detected.map(d => `  • ${d.source}`).join('\n')
    )
  }
  printSuccess(`Config written → ${configPath}\nRun: spasco dashboard`)
}

async function promptProjectName(current: string | undefined): Promise<string | undefined> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`Project name [${current ?? ''}]: `)
  rl.close()
  return answer.trim() || current
}

async function promptConfirmConnectors(
  detected: DetectedConnector[],
  _projectName: string | undefined
): Promise<DetectedConnector[]> {
  if (detected.length === 0) return []
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const kept: DetectedConnector[] = []
  for (const d of detected) {
    const answer = await rl.question(`Include ${d.source}? [Y/n] `)
    if (answer.trim().toLowerCase() !== 'n') kept.push(d)
  }
  rl.close()
  return kept
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/cli && pnpm test -- --reporter=verbose src/tests/commands/init.test.ts
```

Expected: 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/tests/commands/init.test.ts
git commit -m "feat(cli): add runInit command"
```

---

### Task 8: Register `init` in CLI and build

**Files:**

- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Add import and register the command**

In `packages/cli/src/index.ts`, add after the existing imports:

```typescript
import { runInit } from './commands/init.js'
```

Then add the command registration before `program.parse()`:

```typescript
program
  .command('init')
  .description('Auto-detect CI tools and generate spasco.config.json')
  .option('--interactive', 'Prompt to confirm each detected connector')
  .option('--plugins <ids>', 'Comma-separated plugin module IDs to load detectors from')
  .action(async (options: { interactive?: boolean; plugins?: string }) => {
    try {
      await runInit({ interactive: options.interactive, plugins: options.plugins })
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })
```

- [ ] **Step 2: Build the full project** (run from repo root)

```bash
pnpm build
```

Expected: exits 0

- [ ] **Step 3: Smoke-test the command**

```bash
node packages/cli/dist/index.js init --help
```

Expected output contains:

```
Usage: spasco init [options]

Auto-detect CI tools and generate spasco.config.json

Options:
  --interactive  Prompt to confirm each detected connector
  --plugins <ids>  Comma-separated plugin module IDs
```

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): register spasco init command"
```

---

### Task 9: Update docs

**Files:**

- Modify: `CLAUDE.md` — add `spasco init` to CLI Commands section
- Modify: `README.md` — add `spasco init` to CLI Commands section

- [ ] **Step 1: Add `spasco init` to `CLAUDE.md`**

In the `## CLI Commands` section, after the `### spasco dashboard` block, add:

````markdown
### `spasco init`

Auto-detects installed tools (vitest, lcov, playwright, allure, eslint, typescript) by scanning the
repository and writes a ready-to-use `spasco.config.json`. Refuses if a config already exists.

```bash
spasco init                          # auto-detect, write config
spasco init --interactive            # confirm each detected connector
spasco init --plugins @my/plugin     # also run detectors from a plugin
```
````

- [ ] **Step 2: Add `spasco init` to `README.md`**

Same entry — find the CLI commands section and add the `spasco init` block in the same style as the
existing entries.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document spasco init command"
```
