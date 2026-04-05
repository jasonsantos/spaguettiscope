# Phase 3b — Analysis Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the analysis engine: types, runner, 4 built-in rules (coverage-gap,
unused-export, circular-dep, flaky-test), Allure connector improvements, and `spasco analyze` /
`spasco check` CLI commands.

**Architecture:** The analysis runner accepts a flat list of `AnalysisRule[]`, iterates each corpus
(`files`, `edges`, `records`), runs matching rules with a shared `AnalysisContext`, and returns
`Finding[]`. Built-in rules live in `@spaguettiscope/core`. A `TestRecord` interface in core
decouples the analysis engine from `NormalizedRunRecord` in `@spaguettiscope/reports` (avoiding a
circular dependency). The CLI maps `NormalizedRunRecord[]` → `TestRecord[]` before invoking the
runner.

**Tech Stack:** TypeScript, vitest, commander (CLI), @spaguettiscope/core, @spaguettiscope/reports

---

## File Structure

| File                                                          | Purpose                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/core/src/analysis/types.ts`                         | `Finding`, `AnalysisRule`, `AnalysisPlugin`, `AnalysisContext`, `TestRecord`, `CorpusItem` |
| `packages/core/src/analysis/intermediates.ts`                 | `IntermediateCache` — in-memory, serialisable to/from JSON                                 |
| `packages/core/src/analysis/runner.ts`                        | `runAnalysis(options) → Finding[]`                                                         |
| `packages/core/src/analysis/built-in/coverage.ts`             | `coverage-gap` rule                                                                        |
| `packages/core/src/analysis/built-in/unused.ts`               | `unused-export` rule                                                                       |
| `packages/core/src/analysis/built-in/circular.ts`             | `circular-dep` rule                                                                        |
| `packages/core/src/analysis/built-in/flakiness.ts`            | `flaky-test` rule                                                                          |
| `packages/core/src/analysis/built-in/index.ts`                | Re-export all built-in rules as `builtInAnalysisRules`                                     |
| `packages/core/src/analysis/index.ts`                         | Re-export everything from analysis module                                                  |
| `packages/core/src/index.ts`                                  | Add `export * from './analysis/index.js'`                                                  |
| `packages/core/src/tests/analysis/runner.test.ts`             | Tests for `runAnalysis`                                                                    |
| `packages/core/src/tests/analysis/built-in/coverage.test.ts`  | Tests for coverage-gap rule                                                                |
| `packages/core/src/tests/analysis/built-in/unused.test.ts`    | Tests for unused-export rule                                                               |
| `packages/core/src/tests/analysis/built-in/circular.test.ts`  | Tests for circular-dep rule                                                                |
| `packages/core/src/tests/analysis/built-in/flakiness.test.ts` | Tests for flaky-test rule                                                                  |
| `packages/reports/src/connectors/allure.ts`                   | Improve file resolution; expose `historyId`, `statusDetails`                               |
| `packages/cli/src/commands/analyze.ts`                        | `spasco analyze` command                                                                   |
| `packages/cli/src/index.ts`                                   | Register `analyze` and `check` commands                                                    |

---

### Task 1: Analysis types

**Files:**

- Create: `packages/core/src/analysis/types.ts`

- [ ] **Step 1: Create `packages/core/src/analysis/types.ts`**

```typescript
import type { DimensionSet } from '../classification/model.js'
import type { ImportGraph } from '../graph/index.js'

// ── Finding ─────────────────────────────────────────────────────────────────

export type FindingKind = 'violation' | 'coverage-gap' | 'flakiness' | 'unused' | 'metric'
export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
  ruleId: string
  kind: FindingKind
  severity: Severity
  subject:
    | { type: 'file'; path: string }
    | { type: 'edge'; from: string; to: string }
    | { type: 'slice'; dimensions: DimensionSet }
  /** Topology dimensions of the subject — enables aggregation by dimension. */
  dimensions: DimensionSet
  /** For metric findings: a ratio, count, or score (0–1 or raw number). */
  value?: number
  message: string
}

// ── Corpus ───────────────────────────────────────────────────────────────────

export type Corpus = 'files' | 'edges' | 'records'
export type DataSource = 'importGraph' | 'testRecords'

export interface FileItem {
  file: string
  dimensions: DimensionSet
}

export interface EdgeItem {
  from: FileItem
  to: FileItem
}

/** Minimal test record consumed by analysis rules. */
export interface TestRecord {
  id: string
  historyId?: string
  status: 'passed' | 'failed' | 'skipped' | 'broken' | 'unknown'
  dimensions: DimensionSet
}

export type RecordItem = TestRecord

export type CorpusItem<C extends Corpus> = C extends 'files'
  ? FileItem
  : C extends 'edges'
    ? EdgeItem
    : C extends 'records'
      ? RecordItem
      : never

// ── Rule ─────────────────────────────────────────────────────────────────────

export interface AnalysisRule<C extends Corpus = Corpus> {
  id: string
  severity: Severity
  needs: DataSource[]
  corpus: C
  run(item: CorpusItem<C>, ctx: AnalysisContext): Finding[]
}

// ── Plugin ───────────────────────────────────────────────────────────────────

export interface AnalysisPlugin {
  id: string
  canApply(packageRoot: string): boolean
  rules(): AnalysisRule[]
}

// ── Context ──────────────────────────────────────────────────────────────────

export interface IntermediateCache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
}

export interface AnalysisContext {
  /** Full skeleton as a flat map: relative file path → DimensionSet. */
  topology: Map<string, DimensionSet>
  /** Present only if at least one active rule declared 'importGraph' in needs. */
  importGraph?: ImportGraph
  /** Present only if at least one active rule declared 'testRecords' in needs. */
  testRecords?: TestRecord[]
  cache: IntermediateCache
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd packages/core && pnpm build
```

Expected: builds successfully.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/analysis/types.ts
git commit -m "feat: Add analysis engine types (Finding, AnalysisRule, AnalysisPlugin, AnalysisContext)"
```

---

### Task 2: IntermediateCache

**Files:**

- Create: `packages/core/src/analysis/intermediates.ts`
- Create: `packages/core/src/tests/analysis/intermediates.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/tests/analysis/intermediates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createIntermediateCache,
  loadIntermediateCache,
  saveIntermediateCache,
} from '../../analysis/intermediates.js'

describe('IntermediateCache', () => {
  it('returns undefined for unknown keys', () => {
    const cache = createIntermediateCache()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('stores and retrieves a value', () => {
    const cache = createIntermediateCache()
    cache.set('my-key', { count: 42 })
    expect(cache.get('my-key')).toEqual({ count: 42 })
  })

  it('overwrites an existing key', () => {
    const cache = createIntermediateCache()
    cache.set('k', 'first')
    cache.set('k', 'second')
    expect(cache.get('k')).toBe('second')
  })
})

describe('loadIntermediateCache / saveIntermediateCache', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `spasco-cache-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty cache when file does not exist', () => {
    const cache = loadIntermediateCache(join(tmpDir, 'intermediates.json'))
    expect(cache.get('x')).toBeUndefined()
  })

  it('round-trips values through save and load', () => {
    const path = join(tmpDir, 'intermediates.json')
    const cache = createIntermediateCache()
    cache.set('coverage-matrix', { 'src/auth.ts': ['src/auth.test.ts'] })
    saveIntermediateCache(path, cache)
    const loaded = loadIntermediateCache(path)
    expect(loaded.get('coverage-matrix')).toEqual({ 'src/auth.ts': ['src/auth.test.ts'] })
  })

  it('creates parent directory when saving to a nested path', () => {
    const path = join(tmpDir, 'nested', 'intermediates.json')
    const cache = createIntermediateCache()
    cache.set('k', 1)
    saveIntermediateCache(path, cache)
    expect(existsSync(path)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "IntermediateCache\|loadIntermediate"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/analysis/intermediates.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { IntermediateCache } from './types.js'

export function createIntermediateCache(): IntermediateCache & {
  toJSON(): Record<string, unknown>
} {
  const store = new Map<string, unknown>()

  return {
    get<T>(key: string): T | undefined {
      return store.get(key) as T | undefined
    },
    set<T>(key: string, value: T): void {
      store.set(key, value)
    },
    toJSON(): Record<string, unknown> {
      return Object.fromEntries(store)
    },
  }
}

export function loadIntermediateCache(
  filePath: string
): IntermediateCache & { toJSON(): Record<string, unknown> } {
  const cache = createIntermediateCache()
  if (!existsSync(filePath)) return cache
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
    for (const [k, v] of Object.entries(raw)) {
      cache.set(k, v)
    }
  } catch {
    // corrupted cache — start fresh
  }
  return cache
}

export function saveIntermediateCache(
  filePath: string,
  cache: IntermediateCache & { toJSON(): Record<string, unknown> }
): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(cache.toJSON(), null, 2))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "IntermediateCache\|loadIntermediate"
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analysis/intermediates.ts packages/core/src/tests/analysis/intermediates.test.ts
git commit -m "feat: Add IntermediateCache with JSON persistence"
```

---

### Task 3: Analysis runner

**Files:**

- Create: `packages/core/src/analysis/runner.ts`
- Create: `packages/core/src/tests/analysis/runner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/tests/analysis/runner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { runAnalysis } from '../../analysis/runner.js'
import { createIntermediateCache } from '../../analysis/intermediates.js'
import type { AnalysisRule, Finding, FileItem, EdgeItem } from '../../analysis/types.js'
import type { ImportGraph } from '../../graph/index.js'
import type { DimensionSet } from '../../classification/model.js'

function makeTopology(entries: [string, DimensionSet][]): Map<string, DimensionSet> {
  return new Map(entries)
}

describe('runAnalysis', () => {
  it('returns empty findings when no rules provided', () => {
    const result = runAnalysis({
      files: ['src/auth.ts'],
      topology: makeTopology([['src/auth.ts', { role: 'page' }]]),
      rules: [],
      cache: createIntermediateCache(),
    })
    expect(result).toHaveLength(0)
  })

  it('runs a files-corpus rule against each file', () => {
    const rule: AnalysisRule<'files'> = {
      id: 'test-rule',
      severity: 'warning',
      needs: [],
      corpus: 'files',
      run(item: FileItem) {
        if (item.dimensions.role === 'page') {
          return [
            {
              ruleId: 'test-rule',
              kind: 'metric',
              severity: 'warning',
              subject: { type: 'file', path: item.file },
              dimensions: item.dimensions,
              message: 'found a page',
            },
          ]
        }
        return []
      },
    }

    const result = runAnalysis({
      files: ['src/auth.ts', 'src/util.ts'],
      topology: makeTopology([
        ['src/auth.ts', { role: 'page' }],
        ['src/util.ts', { role: 'hook' }],
      ]),
      rules: [rule],
      cache: createIntermediateCache(),
    })

    expect(result).toHaveLength(1)
    expect(result[0].subject).toEqual({ type: 'file', path: 'src/auth.ts' })
  })

  it('runs an edges-corpus rule against each import edge', () => {
    const importGraph: ImportGraph = {
      imports: new Map([['src/client.tsx', new Set(['src/server.ts'])]]),
      importedBy: new Map([['src/server.ts', new Set(['src/client.tsx'])]]),
    }

    const rule: AnalysisRule<'edges'> = {
      id: 'edge-rule',
      severity: 'error',
      needs: ['importGraph'],
      corpus: 'edges',
      run(item: EdgeItem) {
        if (item.from.dimensions.layer === 'client' && item.to.dimensions.layer === 'server') {
          return [
            {
              ruleId: 'edge-rule',
              kind: 'violation',
              severity: 'error',
              subject: { type: 'edge', from: item.from.file, to: item.to.file },
              dimensions: item.from.dimensions,
              message: 'client imports server',
            },
          ]
        }
        return []
      },
    }

    const result = runAnalysis({
      files: ['src/client.tsx', 'src/server.ts'],
      topology: makeTopology([
        ['src/client.tsx', { layer: 'client' }],
        ['src/server.ts', { layer: 'server' }],
      ]),
      rules: [rule],
      importGraph,
      cache: createIntermediateCache(),
    })

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('violation')
    expect(result[0].subject).toEqual({ type: 'edge', from: 'src/client.tsx', to: 'src/server.ts' })
  })

  it('runs a records-corpus rule against each test record', () => {
    const rule: AnalysisRule<'records'> = {
      id: 'flaky-rule',
      severity: 'warning',
      needs: ['testRecords'],
      corpus: 'records',
      run(item) {
        if (item.status === 'broken') {
          return [
            {
              ruleId: 'flaky-rule',
              kind: 'flakiness',
              severity: 'warning',
              subject: { type: 'slice', dimensions: item.dimensions },
              dimensions: item.dimensions,
              message: 'broken test',
            },
          ]
        }
        return []
      },
    }

    const result = runAnalysis({
      files: [],
      topology: new Map(),
      rules: [rule],
      testRecords: [
        { id: '1', status: 'passed', dimensions: {} },
        { id: '2', status: 'broken', dimensions: { domain: 'auth' } },
      ],
      cache: createIntermediateCache(),
    })

    expect(result).toHaveLength(1)
    expect(result[0].dimensions).toEqual({ domain: 'auth' })
  })

  it('files without topology entries receive empty dimensions', () => {
    const seen: DimensionSet[] = []
    const rule: AnalysisRule<'files'> = {
      id: 'r',
      severity: 'info',
      needs: [],
      corpus: 'files',
      run(item: FileItem) {
        seen.push(item.dimensions)
        return []
      },
    }

    runAnalysis({
      files: ['src/unknown.ts'],
      topology: new Map(),
      rules: [rule],
      cache: createIntermediateCache(),
    })

    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "runAnalysis"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/analysis/runner.ts`**

```typescript
import type {
  AnalysisRule,
  AnalysisContext,
  Finding,
  FileItem,
  EdgeItem,
  TestRecord,
  IntermediateCache,
} from './types.js'
import type { DimensionSet } from '../classification/model.js'
import type { ImportGraph } from '../graph/index.js'

export interface RunAnalysisOptions {
  /** All project file paths (relative to project root). */
  files: string[]
  /** Flat map of file path → dimensions from the skeleton. */
  topology: Map<string, DimensionSet>
  rules: AnalysisRule[]
  importGraph?: ImportGraph
  testRecords?: TestRecord[]
  cache: IntermediateCache
}

export function runAnalysis(options: RunAnalysisOptions): Finding[] {
  const { files, topology, rules, importGraph, testRecords, cache } = options

  const ctx: AnalysisContext = { topology, importGraph, testRecords, cache }
  const findings: Finding[] = []

  // ── Files corpus ─────────────────────────────────────────────────────────
  const fileRules = rules.filter(r => r.corpus === 'files')
  if (fileRules.length > 0) {
    for (const file of files) {
      const dimensions = topology.get(file) ?? {}
      const item: FileItem = { file, dimensions }
      for (const rule of fileRules) {
        findings.push(...rule.run(item as never, ctx))
      }
    }
  }

  // ── Edges corpus ─────────────────────────────────────────────────────────
  const edgeRules = rules.filter(r => r.corpus === 'edges')
  if (edgeRules.length > 0 && importGraph) {
    for (const [fromFile, targets] of importGraph.imports) {
      const fromDimensions = topology.get(fromFile) ?? {}
      for (const toFile of targets) {
        const toDimensions = topology.get(toFile) ?? {}
        const item: EdgeItem = {
          from: { file: fromFile, dimensions: fromDimensions },
          to: { file: toFile, dimensions: toDimensions },
        }
        for (const rule of edgeRules) {
          findings.push(...rule.run(item as never, ctx))
        }
      }
    }
  }

  // ── Records corpus ────────────────────────────────────────────────────────
  const recordRules = rules.filter(r => r.corpus === 'records')
  if (recordRules.length > 0 && testRecords) {
    for (const record of testRecords) {
      for (const rule of recordRules) {
        findings.push(...rule.run(record as never, ctx))
      }
    }
  }

  return findings
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "runAnalysis"
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analysis/runner.ts packages/core/src/tests/analysis/runner.test.ts
git commit -m "feat: Add analysis runner — iterates file/edge/record corpora"
```

---

### Task 4: `coverage-gap` built-in rule

**Files:**

- Create: `packages/core/src/analysis/built-in/coverage.ts`
- Create: `packages/core/src/tests/analysis/built-in/coverage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/tests/analysis/built-in/coverage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { coverageGapRule } from '../../../analysis/built-in/coverage.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { AnalysisContext, FileItem } from '../../../analysis/types.js'
import type { ImportGraph } from '../../../graph/index.js'

function makeCtx(
  importedBy: Record<string, string[]>,
  topology: Record<string, Record<string, string>> = {}
): AnalysisContext {
  const graph: ImportGraph = {
    imports: new Map(),
    importedBy: new Map(Object.entries(importedBy).map(([k, v]) => [k, new Set(v)])),
  }
  return {
    topology: new Map(Object.entries(topology)),
    importGraph: graph,
    cache: createIntermediateCache(),
  }
}

describe('coverage-gap rule', () => {
  it('emits coverage-gap when a page has no test importing it', () => {
    const ctx = makeCtx({}, { 'src/auth/page.tsx': { role: 'page' } })
    const item: FileItem = { file: 'src/auth/page.tsx', dimensions: { role: 'page' } }
    const findings = coverageGapRule.run(item, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe('coverage-gap')
    expect(findings[0].subject).toEqual({ type: 'file', path: 'src/auth/page.tsx' })
  })

  it('emits no finding when a test imports the file', () => {
    const ctx = makeCtx(
      { 'src/auth/page.tsx': ['src/auth/page.test.ts'] },
      {
        'src/auth/page.tsx': { role: 'page' },
        'src/auth/page.test.ts': { role: 'test' },
      }
    )
    const item: FileItem = { file: 'src/auth/page.tsx', dimensions: { role: 'page' } }
    const findings = coverageGapRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding for files with non-targetted roles', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/util.ts', dimensions: { role: 'utility' } }
    const findings = coverageGapRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding when file has no role', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/index.ts', dimensions: {} }
    const findings = coverageGapRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('targets hook, server-action, repository, schema roles', () => {
    const ctx = makeCtx({})
    const targeted = ['hook', 'server-action', 'repository', 'schema']
    for (const role of targeted) {
      const item: FileItem = { file: `src/thing.ts`, dimensions: { role } }
      const findings = coverageGapRule.run(item, ctx)
      expect(findings).toHaveLength(1)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "coverage-gap rule"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/analysis/built-in/coverage.ts`**

```typescript
import type { AnalysisRule, FileItem, Finding } from '../types.js'

const TARGETED_ROLES = new Set(['page', 'hook', 'server-action', 'repository', 'schema'])

export const coverageGapRule: AnalysisRule<'files'> = {
  id: 'built-in:coverage-gap',
  severity: 'warning',
  needs: ['importGraph'],
  corpus: 'files',
  run(item: FileItem, ctx): Finding[] {
    if (!TARGETED_ROLES.has(item.dimensions.role ?? '')) return []

    const importers = ctx.importGraph?.importedBy.get(item.file)
    if (importers && importers.size > 0) return []

    return [
      {
        ruleId: 'built-in:coverage-gap',
        kind: 'coverage-gap',
        severity: 'warning',
        subject: { type: 'file', path: item.file },
        dimensions: item.dimensions,
        message: `No test directly imports this file (role: ${item.dimensions.role})`,
      },
    ]
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "coverage-gap rule"
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analysis/built-in/coverage.ts packages/core/src/tests/analysis/built-in/coverage.test.ts
git commit -m "feat: Add coverage-gap built-in analysis rule"
```

---

### Task 5: `unused-export` built-in rule

**Files:**

- Create: `packages/core/src/analysis/built-in/unused.ts`
- Create: `packages/core/src/tests/analysis/built-in/unused.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/tests/analysis/built-in/unused.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { unusedExportRule } from '../../../analysis/built-in/unused.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { AnalysisContext, FileItem } from '../../../analysis/types.js'
import type { ImportGraph } from '../../../graph/index.js'

function makeCtx(
  importedBy: Record<string, string[]>,
  topology: Record<string, Record<string, string>> = {}
): AnalysisContext {
  const graph: ImportGraph = {
    imports: new Map(),
    importedBy: new Map(Object.entries(importedBy).map(([k, v]) => [k, new Set(v)])),
  }
  return {
    topology: new Map(Object.entries(topology)),
    importGraph: graph,
    cache: createIntermediateCache(),
  }
}

describe('unused-export rule', () => {
  it('emits unused finding when file has no importers', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/utils/format.ts', dimensions: { role: 'hook' } }
    const findings = unusedExportRule.run(item, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe('unused')
    expect(findings[0].severity).toBe('info')
  })

  it('emits no finding when file has importers', () => {
    const ctx = makeCtx({ 'src/utils/format.ts': ['src/auth/page.tsx'] })
    const item: FileItem = { file: 'src/utils/format.ts', dimensions: {} }
    const findings = unusedExportRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding for entry-point roles', () => {
    const ctx = makeCtx({})
    const entryRoles = ['page', 'middleware', 'route-handler', 'instrumentation']
    for (const role of entryRoles) {
      const item: FileItem = { file: 'src/thing.ts', dimensions: { role } }
      const findings = unusedExportRule.run(item, ctx)
      expect(findings).toHaveLength(0)
    }
  })

  it('emits no finding for test files', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/auth.test.ts', dimensions: { role: 'test' } }
    const findings = unusedExportRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding for files with no dimensions (not in topology)', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/unknown.ts', dimensions: {} }
    const findings = unusedExportRule.run(item, ctx)
    // files with no role are not analysed to avoid false positives
    expect(findings).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "unused-export rule"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/analysis/built-in/unused.ts`**

```typescript
import type { AnalysisRule, FileItem, Finding } from '../types.js'

// These roles are entry points — they are "used" by the runtime, not by imports.
const ENTRY_POINT_ROLES = new Set([
  'page',
  'middleware',
  'route-handler',
  'instrumentation',
  'test',
  'spec',
  'e2e',
  'bdd-spec',
  'auth-setup',
])

export const unusedExportRule: AnalysisRule<'files'> = {
  id: 'built-in:unused-export',
  severity: 'info',
  needs: ['importGraph'],
  corpus: 'files',
  run(item: FileItem, ctx): Finding[] {
    const role = item.dimensions.role
    // Only analyse files with a known role (in topology) to avoid noise.
    if (!role) return []
    if (ENTRY_POINT_ROLES.has(role)) return []

    const importers = ctx.importGraph?.importedBy.get(item.file)
    if (importers && importers.size > 0) return []

    return [
      {
        ruleId: 'built-in:unused-export',
        kind: 'unused',
        severity: 'info',
        subject: { type: 'file', path: item.file },
        dimensions: item.dimensions,
        message: `File is not imported by any other file (role: ${role})`,
      },
    ]
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "unused-export rule"
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analysis/built-in/unused.ts packages/core/src/tests/analysis/built-in/unused.test.ts
git commit -m "feat: Add unused-export built-in analysis rule"
```

---

### Task 6: `circular-dep` built-in rule

**Files:**

- Create: `packages/core/src/analysis/built-in/circular.ts`
- Create: `packages/core/src/tests/analysis/built-in/circular.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/tests/analysis/built-in/circular.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { circularDepRule } from '../../../analysis/built-in/circular.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { AnalysisContext, FileItem } from '../../../analysis/types.js'
import type { ImportGraph } from '../../../graph/index.js'

function makeCtx(imports: Record<string, string[]>): AnalysisContext {
  const importMap = new Map(Object.entries(imports).map(([k, v]) => [k, new Set(v)]))
  const importedBy = new Map<string, Set<string>>()
  for (const [from, targets] of importMap) {
    for (const to of targets) {
      if (!importedBy.has(to)) importedBy.set(to, new Set())
      importedBy.get(to)!.add(from)
    }
  }
  const graph: ImportGraph = { imports: importMap, importedBy }
  return { topology: new Map(), importGraph: graph, cache: createIntermediateCache() }
}

describe('circular-dep rule', () => {
  it('emits violation when file is part of a direct cycle (A → B → A)', () => {
    const ctx = makeCtx({ 'src/a.ts': ['src/b.ts'], 'src/b.ts': ['src/a.ts'] })
    const item: FileItem = { file: 'src/a.ts', dimensions: {} }
    const findings = circularDepRule.run(item, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe('violation')
    expect(findings[0].severity).toBe('warning')
  })

  it('emits violation for longer cycles (A → B → C → A)', () => {
    const ctx = makeCtx({
      'src/a.ts': ['src/b.ts'],
      'src/b.ts': ['src/c.ts'],
      'src/c.ts': ['src/a.ts'],
    })
    const item: FileItem = { file: 'src/a.ts', dimensions: {} }
    const findings = circularDepRule.run(item, ctx)
    expect(findings).toHaveLength(1)
  })

  it('emits no finding when no cycle exists', () => {
    const ctx = makeCtx({ 'src/a.ts': ['src/b.ts'], 'src/b.ts': ['src/c.ts'] })
    const item: FileItem = { file: 'src/a.ts', dimensions: {} }
    const findings = circularDepRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding when file has no imports', () => {
    const ctx = makeCtx({})
    const item: FileItem = { file: 'src/leaf.ts', dimensions: {} }
    const findings = circularDepRule.run(item, ctx)
    expect(findings).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "circular-dep rule"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/analysis/built-in/circular.ts`**

```typescript
import type { AnalysisRule, FileItem, Finding } from '../types.js'
import type { ImportGraph } from '../../graph/index.js'

/** Returns true if `start` can be reached by following imports from `start`. */
function hasCycle(start: string, graph: ImportGraph): boolean {
  const visited = new Set<string>()
  const stack: string[] = [start]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    const deps = graph.imports.get(current)
    if (!deps) continue
    for (const dep of deps) {
      if (dep === start) return true
      if (!visited.has(dep)) stack.push(dep)
    }
  }
  return false
}

export const circularDepRule: AnalysisRule<'files'> = {
  id: 'built-in:circular-dep',
  severity: 'warning',
  needs: ['importGraph'],
  corpus: 'files',
  run(item: FileItem, ctx): Finding[] {
    if (!ctx.importGraph) return []
    if (!ctx.importGraph.imports.has(item.file)) return []
    if (!hasCycle(item.file, ctx.importGraph)) return []

    return [
      {
        ruleId: 'built-in:circular-dep',
        kind: 'violation',
        severity: 'warning',
        subject: { type: 'file', path: item.file },
        dimensions: item.dimensions,
        message: `File is part of a circular import chain`,
      },
    ]
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "circular-dep rule"
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analysis/built-in/circular.ts packages/core/src/tests/analysis/built-in/circular.test.ts
git commit -m "feat: Add circular-dep built-in analysis rule"
```

---

### Task 7: `flaky-test` built-in rule + Allure connector improvements

**Files:**

- Create: `packages/core/src/analysis/built-in/flakiness.ts`
- Create: `packages/core/src/tests/analysis/built-in/flakiness.test.ts`
- Modify: `packages/reports/src/connectors/allure.ts`

- [ ] **Step 1: Write failing tests for the flaky-test rule**

Create `packages/core/src/tests/analysis/built-in/flakiness.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { flakyTestRule } from '../../../analysis/built-in/flakiness.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { AnalysisContext, TestRecord } from '../../../analysis/types.js'

function makeCtx(): AnalysisContext {
  return { topology: new Map(), cache: createIntermediateCache() }
}

function makeRecord(id: string, historyId: string, status: TestRecord['status']): TestRecord {
  return { id, historyId, status, dimensions: { domain: 'auth' } }
}

describe('flaky-test rule', () => {
  it('emits no finding on first pass (only one data point)', () => {
    const ctx = makeCtx()
    const record = makeRecord('r1', 'h1', 'failed')
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits flakiness finding when failure rate is between 0.1 and 0.9', () => {
    const ctx = makeCtx()
    // Simulate 5 previous runs: 3 passed, 2 failed → ratio 0.4
    ctx.cache.set('flakiness-index', { h1: { pass: 3, fail: 2, total: 5 } })
    const record = makeRecord('r1', 'h1', 'passed')
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe('flakiness')
    expect(findings[0].value).toBeCloseTo(2 / 5)
  })

  it('emits no finding when failure rate is below 0.1 (reliably passing)', () => {
    const ctx = makeCtx()
    ctx.cache.set('flakiness-index', { h1: { pass: 10, fail: 0, total: 10 } })
    const record = makeRecord('r1', 'h1', 'passed')
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(0)
  })

  it('emits no finding when failure rate is above 0.9 (reliably failing)', () => {
    const ctx = makeCtx()
    ctx.cache.set('flakiness-index', { h1: { pass: 0, fail: 10, total: 10 } })
    const record = makeRecord('r1', 'h1', 'failed')
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(0)
  })

  it('updates the cache with each run result', () => {
    const ctx = makeCtx()
    flakyTestRule.run(makeRecord('r1', 'h1', 'passed'), ctx)
    flakyTestRule.run(makeRecord('r2', 'h1', 'failed'), ctx)
    const index =
      ctx.cache.get<Record<string, { pass: number; fail: number; total: number }>>(
        'flakiness-index'
      )
    expect(index?.h1.pass).toBe(1)
    expect(index?.h1.fail).toBe(1)
    expect(index?.h1.total).toBe(2)
  })

  it('emits no finding when record has no historyId', () => {
    const ctx = makeCtx()
    const record: TestRecord = { id: 'r1', status: 'failed', dimensions: {} }
    const findings = flakyTestRule.run(record, ctx)
    expect(findings).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "flaky-test rule"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/analysis/built-in/flakiness.ts`**

```typescript
import type { AnalysisRule, TestRecord, Finding } from '../types.js'

interface FlakinessEntry {
  pass: number
  fail: number
  total: number
}

type FlakinessIndex = Record<string, FlakinessEntry>

const FLAKY_MIN = 0.1
const FLAKY_MAX = 0.9

export const flakyTestRule: AnalysisRule<'records'> = {
  id: 'built-in:flaky-test',
  severity: 'warning',
  needs: ['testRecords'],
  corpus: 'records',
  run(record: TestRecord, ctx): Finding[] {
    if (!record.historyId) return []

    // Load or initialise the flakiness index from cache.
    const index = (ctx.cache.get<FlakinessIndex>('flakiness-index') ?? {}) as FlakinessIndex
    const entry: FlakinessEntry = index[record.historyId] ?? { pass: 0, fail: 0, total: 0 }

    // Check for flakiness before recording current run (so first-run is never flagged).
    let finding: Finding | null = null
    if (entry.total > 0) {
      const failRatio = entry.fail / entry.total
      if (failRatio > FLAKY_MIN && failRatio < FLAKY_MAX) {
        finding = {
          ruleId: 'built-in:flaky-test',
          kind: 'flakiness',
          severity: 'warning',
          subject: { type: 'slice', dimensions: record.dimensions },
          dimensions: record.dimensions,
          value: failRatio,
          message: `Test is flaky — fails ${Math.round(failRatio * 100)}% of runs`,
        }
      }
    }

    // Update index with current run.
    const isPassing = record.status === 'passed'
    index[record.historyId] = {
      pass: entry.pass + (isPassing ? 1 : 0),
      fail: entry.fail + (isPassing ? 0 : 1),
      total: entry.total + 1,
    }
    ctx.cache.set('flakiness-index', index)

    return finding ? [finding] : []
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "flaky-test rule"
```

Expected: all 6 tests pass.

- [ ] **Step 5: Update Allure connector to expose `historyId`, better file resolution,
      `statusDetails`**

In `packages/reports/src/connectors/allure.ts`, update the `AllureResult` interface and the `read`
method:

Replace:

```typescript
interface AllureResult {
  uuid: string
  name: string
  fullName?: string
  status: string
  start?: number
  stop?: number
  labels?: AllureLabel[]
}
```

With:

```typescript
interface AllureResult {
  uuid: string
  name: string
  fullName?: string
  historyId?: string
  status: string
  start?: number
  stop?: number
  labels?: AllureLabel[]
  statusDetails?: { message?: string; trace?: string }
}
```

Then find the block that resolves `sourceFile`:

```typescript
const sourceFile = getLabel('testSourceFile')
```

Replace with:

```typescript
const sourceFile =
  getLabel('testSourceFile') ??
  (raw.fullName?.includes('#') ? raw.fullName.split('#')[0] : undefined) ??
  getLabel('package')?.replace(/\./g, '/')
```

Then find the `records.push` call and update it to include `historyId` and `statusDetails` in
metadata:

```typescript
records.push({
  id: raw.uuid ?? randomUUID(),
  connectorId: this.id,
  runAt: raw.start ? new Date(raw.start).toISOString() : new Date().toISOString(),
  name: raw.name,
  fullName: raw.fullName ?? raw.name,
  status: ALLURE_STATUS_MAP[raw.status] ?? 'unknown',
  duration: raw.start && raw.stop ? raw.stop - raw.start : 0,
  dimensions,
  source: { file: filePath, connectorId: this.id },
  metadata: {
    labels,
    historyId: raw.historyId,
    statusDetails: raw.statusDetails,
  },
})
```

- [ ] **Step 6: Run reports tests**

```bash
cd packages/reports && pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/analysis/built-in/flakiness.ts packages/core/src/tests/analysis/built-in/flakiness.test.ts packages/reports/src/connectors/allure.ts
git commit -m "feat: Add flaky-test rule; improve Allure connector file resolution and historyId"
```

---

### Task 8: Wire up exports and build

**Files:**

- Create: `packages/core/src/analysis/built-in/index.ts`
- Create: `packages/core/src/analysis/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/src/analysis/built-in/index.ts`**

```typescript
export { coverageGapRule } from './coverage.js'
export { unusedExportRule } from './unused.js'
export { circularDepRule } from './circular.js'
export { flakyTestRule } from './flakiness.js'

import { coverageGapRule } from './coverage.js'
import { unusedExportRule } from './unused.js'
import { circularDepRule } from './circular.js'
import { flakyTestRule } from './flakiness.js'
import type { AnalysisRule } from '../types.js'

export const builtInAnalysisRules: AnalysisRule[] = [
  coverageGapRule,
  unusedExportRule,
  circularDepRule,
  flakyTestRule,
]
```

- [ ] **Step 2: Create `packages/core/src/analysis/index.ts`**

```typescript
export * from './types.js'
export * from './runner.js'
export * from './intermediates.js'
export * from './built-in/index.js'
```

- [ ] **Step 3: Update `packages/core/src/index.ts`**

Add the export:

```typescript
export * from './analysis/index.js'
```

- [ ] **Step 4: Build and verify**

```bash
cd /Users/jasonsantos/personal/spaguettiscope/spaguettiscope && pnpm build
```

Expected: 11 tasks, all succeed.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/analysis/built-in/index.ts packages/core/src/analysis/index.ts packages/core/src/index.ts
git commit -m "feat: Export analysis engine from @spaguettiscope/core"
```

---

### Task 9: `spasco analyze` and `spasco check` CLI commands

**Files:**

- Create: `packages/cli/src/commands/analyze.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/src/tests/commands/analyze.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/cli/src/tests/commands/analyze.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/cli && pnpm test --reporter=verbose 2>&1 | grep -A3 "runAnalyzeCommand"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/cli/src/commands/analyze.ts`**

```typescript
import { resolve } from 'node:path'
import ora from 'ora'
import {
  loadConfig,
  readSkeleton,
  matchFile,
  discoverWorkspaces,
  buildImportGraph,
  mergeImportGraphs,
  runAnalysis,
  builtInAnalysisRules,
  loadIntermediateCache,
  saveIntermediateCache,
  InferenceEngine,
  defaultDefinitions,
  type AnalysisRule,
  type TestRecord,
  type Finding,
} from '@spaguettiscope/core'
import { walkFiles } from '../utils/files.js'
import { AllureConnector } from '@spaguettiscope/reports'
import { printSuccess, printWarning } from '../formatter/index.js'

export interface AnalyzeOptions {
  projectRoot?: string
  ci?: boolean
}

export interface AnalyzeResult {
  findings: Finding[]
  summary: { error: number; warning: number; info: number }
}

export async function runAnalyzeCommand(options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const intermediatesPath = resolve(projectRoot, config.analysis.intermediates)

  // 1. Read topology from skeleton
  const skeleton = readSkeleton(skeletonPath)
  const topology = new Map<string, Record<string, string>>()
  const allFiles = walkFiles(projectRoot, projectRoot)
  for (const file of allFiles) {
    const match = matchFile(file, skeleton)
    if (match) topology.set(file, match)
  }

  // 2. Build import graph
  const graphSpinner = ora('Building import graph…').start()
  const packages = discoverWorkspaces(projectRoot)
  const filesByPackage = new Map<string, string[]>()
  for (const pkg of packages) filesByPackage.set(pkg.rel, [])
  for (const f of allFiles) {
    const matchingPkg = packages.find(pkg => pkg.rel === '.' || f.startsWith(pkg.rel + '/'))
    if (matchingPkg) filesByPackage.get(matchingPkg.rel)!.push(f)
  }
  const importGraph = mergeImportGraphs(
    packages.map(pkg => buildImportGraph(pkg.root, filesByPackage.get(pkg.rel) ?? [], projectRoot))
  )
  graphSpinner.succeed('Import graph built')

  // 3. Load test records from connectors
  let testRecords: TestRecord[] = []
  if (config.dashboard.connectors.length > 0) {
    const recSpinner = ora('Loading test records…').start()
    const connector = new AllureConnector()
    const engine = new InferenceEngine(skeleton, defaultDefinitions)
    for (const connectorConfig of config.dashboard.connectors) {
      if (connectorConfig.id === 'allure') {
        try {
          const records = await connector.read(connectorConfig, engine)
          testRecords.push(
            ...records.map(r => ({
              id: r.id,
              historyId: r.metadata?.historyId as string | undefined,
              status: r.status,
              dimensions: r.dimensions,
            }))
          )
        } catch {
          // connector error — skip
        }
      }
    }
    recSpinner.succeed(`Loaded ${testRecords.length} test records`)
  }

  // 4. Load analysis plugins from config
  const pluginRules: AnalysisRule[] = []
  for (const pluginId of config.analysisPlugins) {
    try {
      const mod = (await import(pluginId)) as Record<string, unknown>
      const plugin = (mod.default ?? Object.values(mod)[0]) as {
        id: string
        canApply(r: string): boolean
        rules(): AnalysisRule[]
      }
      if (plugin && typeof plugin.canApply === 'function') {
        for (const pkg of packages) {
          if (!plugin.canApply(pkg.root)) continue
          pluginRules.push(...plugin.rules())
        }
      }
    } catch {
      printWarning(`Failed to load analysis plugin: ${pluginId}`)
    }
  }

  // 5. Run analysis
  const analysisSpinner = ora('Running analysis rules…').start()
  const cache = loadIntermediateCache(intermediatesPath)
  const allRules: AnalysisRule[] = [...builtInAnalysisRules, ...pluginRules]
  const findings = runAnalysis({
    files: allFiles,
    topology,
    rules: allRules,
    importGraph,
    testRecords: testRecords.length > 0 ? testRecords : undefined,
    cache,
  })
  saveIntermediateCache(intermediatesPath, cache)
  analysisSpinner.succeed(`Analysis complete — ${findings.length} findings`)

  // 6. Summarise
  const summary = { error: 0, warning: 0, info: 0 }
  for (const f of findings) summary[f.severity]++

  if (!options.ci) {
    printAnalysisSummary(findings, summary)
  }

  printSuccess(
    `Analysis complete — ${summary.error} errors, ${summary.warning} warnings, ${summary.info} info`
  )

  return { findings, summary }
}

function printAnalysisSummary(
  findings: Finding[],
  summary: { error: number; warning: number; info: number }
): void {
  const byKind = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!byKind.has(f.kind)) byKind.set(f.kind, [])
    byKind.get(f.kind)!.push(f)
  }
  for (const [kind, group] of byKind) {
    console.log(`\n  ${kind} (${group.length})`)
    for (const f of group.slice(0, 10)) {
      const subj =
        f.subject.type === 'file'
          ? f.subject.path
          : f.subject.type === 'edge'
            ? `${f.subject.from} → ${f.subject.to}`
            : JSON.stringify(f.subject.dimensions)
      console.log(`  ├─ ${subj}`)
    }
    if (group.length > 10) console.log(`  └─ …and ${group.length - 10} more`)
  }
}
```

- [ ] **Step 4: Register `analyze` and `check` commands in `packages/cli/src/index.ts`**

Add after the existing imports:

```typescript
import { runAnalyzeCommand } from './commands/analyze.js'
```

Add after the existing `annotate` command block:

```typescript
program
  .command('analyze')
  .description('Run analysis rules and surface findings')
  .option('--ci', 'CI mode: no HTML output, just terminal summary')
  .action(async options => {
    try {
      await runAnalyzeCommand({ ci: options.ci })
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('check')
  .description('Run analysis rules and exit 1 if any error-severity findings exist')
  .option('--severity <level>', 'Treat this severity and above as errors', 'error')
  .action(async options => {
    try {
      const { summary } = await runAnalyzeCommand({ ci: true })
      const hasErrors =
        options.severity === 'warning' ? summary.error + summary.warning > 0 : summary.error > 0
      if (hasErrors) process.exit(1)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/cli && pnpm test
```

Expected: all tests pass including the new analyze tests.

- [ ] **Step 6: Build everything**

```bash
cd /Users/jasonsantos/personal/spaguettiscope/spaguettiscope && pnpm build
```

Expected: all 11 tasks succeed.

- [ ] **Step 7: Smoke test on pharmacy-online**

```bash
cd /Users/jasonsantos/work/pharmacy-online && node /Users/jasonsantos/personal/spaguettiscope/spaguettiscope/packages/cli/dist/index.js analyze 2>&1
```

Expected: runs without error, prints summary of findings. `.spasco/intermediates.json` is created.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/commands/analyze.ts packages/cli/src/index.ts packages/cli/src/tests/commands/analyze.test.ts
git commit -m "feat: Add spasco analyze and spasco check commands"
```
