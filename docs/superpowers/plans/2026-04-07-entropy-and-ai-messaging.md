# Entropy Score Revival & AI-Friendly CLI Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring back the entropy score as a 0-10 composite metric computed per-package and overall,
display it in the dashboard with a yellow/gold accent, and rewrite all CLI command output to include
context-aware guidance that teaches the operator what to do next.

**Architecture:** The entropy engine lives in `packages/core/src/entropy/` as pure functions that
take existing analysis data (records, graph, findings, skeleton) and return `EntropyResult`. The CLI
commands call it after analysis, store results in `DashboardData` and `history.jsonl`, and the React
renderer displays it. A new `packages/cli/src/formatter/guidance.ts` module builds context-aware
post-command messages. All `--help` descriptions are rewritten to orient AI operators.

**Tech Stack:** TypeScript, Vitest (testing), React + Recharts (dashboard renderer), Commander.js
(CLI), Chalk + Ora (terminal output)

**Spec:** `docs/superpowers/specs/2026-04-07-entropy-and-ai-messaging-design.md`

---

## File Structure

### New files

| File                                                | Responsibility                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/core/src/entropy/index.ts`                | `computeEntropy()` — orchestrates subscores, handles weight redistribution, per-package |
| `packages/core/src/entropy/types.ts`                | `EntropyResult`, `EntropySubscore`, `EntropyInput`, classification thresholds           |
| `packages/core/src/entropy/subscores.ts`            | 5 subscore functions: stability, boundaries, coverage, violations, classification       |
| `packages/core/src/tests/entropy/entropy.test.ts`   | Tests for entropy engine                                                                |
| `packages/cli/src/formatter/guidance.ts`            | Context-aware post-command guidance builder                                             |
| `packages/cli/src/tests/formatter/guidance.test.ts` | Tests for guidance messages                                                             |

### Modified files

| File                                                           | Change                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/core/src/index.ts`                                   | Export entropy module                                                      |
| `packages/reports/src/model/dashboard.ts`                      | Add `entropy` field to `DashboardData`                                     |
| `packages/reports/src/model/history.ts`                        | Add `entropyScore`, `entropyByPackage` to `HistoryEntry`                   |
| `packages/reports/src/renderer/inject.ts`                      | Pass entropy data through to renderer                                      |
| `packages/reports/src/renderer/html/index.html`                | Add `--c-entropy` CSS custom property                                      |
| `packages/reports/src/renderer/html/src/shared.tsx`            | Add `entropyHealth()`, entropy color constant                              |
| `packages/reports/src/renderer/html/src/derive.ts`             | Add entropy to `PackageInfo`, derive from summary                          |
| `packages/reports/src/renderer/html/src/views/Observatory.tsx` | 5th card, sparkline, dimension column                                      |
| `packages/reports/src/renderer/html/src/App.tsx`               | Thread entropy data                                                        |
| `packages/cli/src/commands/analyze.ts`                         | Compute entropy, print in output                                           |
| `packages/cli/src/commands/dashboard.ts`                       | Compute entropy, store in history, pass to renderer                        |
| `packages/cli/src/commands/scan.ts`                            | Add post-command guidance                                                  |
| `packages/cli/src/commands/init.ts`                            | Add post-command guidance                                                  |
| `packages/cli/src/commands/annotate.ts`                        | Add post-command guidance                                                  |
| `packages/cli/src/index.ts`                                    | Rewrite help descriptions, add `--max-entropy`, update program description |
| `packages/cli/src/formatter/index.ts`                          | Update banner tagline                                                      |

---

### Task 1: Entropy Engine — Types, Subscores, and Composition

**Files:**

- Create: `packages/core/src/entropy/types.ts`
- Create: `packages/core/src/entropy/subscores.ts`
- Create: `packages/core/src/entropy/index.ts`
- Create: `packages/core/src/tests/entropy/entropy.test.ts`
- Modify: `packages/core/src/index.ts`

**Context:** The entropy engine is a pure functional module. It takes data the tool already collects
— test records, import graph, findings, skeleton classification — and computes a 0-10 score from 5
weighted subscores. Each subscore is independently testable. When a subscore has no data (e.g., no
test records for a package), its weight redistributes proportionally.

The import graph type is defined in `packages/core/src/graph/index.ts`:

```typescript
interface ImportGraph {
  imports: Map<string, Set<string>>
  importedBy: Map<string, Set<string>>
  typeOnlyImports: Map<string, Set<string>>
}
```

The Finding type is in `packages/core/src/analysis/types.ts`:

```typescript
interface Finding {
  ruleId: string
  kind: FindingKind
  severity: 'error' | 'warning' | 'info'
  subject:
    | { type: 'file'; path: string }
    | { type: 'edge'; from: string; to: string }
    | { type: 'slice'; dimensions: DimensionSet }
  dimensions: DimensionSet
  value?: number
  message: string
}
```

- [ ] **Step 1: Write the entropy types**

```typescript
// packages/core/src/entropy/types.ts

export interface EntropySubscore {
  score: number // 0-10
  available: boolean // false if no data for this subscore
}

export interface EntropyResult {
  score: number // 0-10 weighted composite
  classification: 'excellent' | 'good' | 'moderate' | 'poor' | 'critical'
  subscores: {
    stability: EntropySubscore
    boundaries: EntropySubscore
    coverage: EntropySubscore
    violations: EntropySubscore
    classification: EntropySubscore
  }
}

export interface EntropyInput {
  /** Total source files in scope */
  fileCount: number
  /** Test pass rate 0-1 (undefined if no test records) */
  passRate?: number
  /** Ratio of flaky tests (10-90% failure) to total tests, 0-1 */
  flakyRatio?: number
  /** Number of files involved in circular import cycles */
  circularDepFiles: number
  /** Total import edges in scope */
  edgeCount: number
  /** Max fan-out (imports from a single file) */
  maxFanOut: number
  /** Number of files with no importers and not entry points */
  unusedExports: number
  /** LCov coverage rate 0-1 (undefined if no lcov data) */
  lcovCoverage?: number
  /** Number of coverage-gap findings */
  coverageGaps: number
  /** Findings by severity */
  findingsByWeight: number // error*3 + warning*1 + info*0.5
  /** Ratio of skeleton entries with all dimensions resolved (not draft, not ?) */
  resolvedRatio: number
}

export const ENTROPY_THRESHOLDS = {
  excellent: 3.0,
  good: 5.0,
  moderate: 7.0,
  poor: 9.0,
} as const

export const SUBSCORE_WEIGHTS = {
  stability: 0.25,
  boundaries: 0.25,
  coverage: 0.2,
  violations: 0.15,
  classification: 0.15,
} as const

export function classifyEntropy(score: number): EntropyResult['classification'] {
  if (score < ENTROPY_THRESHOLDS.excellent) return 'excellent'
  if (score < ENTROPY_THRESHOLDS.good) return 'good'
  if (score < ENTROPY_THRESHOLDS.moderate) return 'moderate'
  if (score < ENTROPY_THRESHOLDS.poor) return 'poor'
  return 'critical'
}
```

- [ ] **Step 2: Write the subscore functions**

```typescript
// packages/core/src/entropy/subscores.ts

import type { EntropyInput, EntropySubscore } from './types.js'

/**
 * Stability: 10 × (1 - passRate) + flakiness penalty.
 * Unavailable if no test records (passRate undefined).
 */
export function stabilitySubscore(input: EntropyInput): EntropySubscore {
  if (input.passRate === undefined) return { score: 0, available: false }
  const base = 10 * (1 - input.passRate)
  const flakyPenalty = (input.flakyRatio ?? 0) * 5 // up to 5 points for 100% flaky
  return { score: Math.min(10, base + flakyPenalty), available: true }
}

/**
 * Boundaries: circular dep ratio + graph density + fan-out outliers + unused export ratio.
 * Always available (0 if no graph edges).
 */
export function boundariesSubscore(input: EntropyInput): EntropySubscore {
  if (input.fileCount === 0) return { score: 0, available: true }

  // Circular dep ratio: what fraction of files are in cycles
  const circularRatio = input.circularDepFiles / input.fileCount
  const circularScore = Math.min(10, circularRatio * 20) // 50% files in cycles = 10

  // Graph density: actual edges / possible edges (n*(n-1))
  const possibleEdges = input.fileCount * (input.fileCount - 1)
  const density = possibleEdges > 0 ? input.edgeCount / possibleEdges : 0
  const densityScore = Math.min(10, density * 100) // 10% density = 10

  // Fan-out: how extreme is the worst file
  const avgFanOut = input.fileCount > 0 ? input.edgeCount / input.fileCount : 0
  const fanOutRatio = avgFanOut > 0 ? input.maxFanOut / (avgFanOut * 3) : 0 // 3x avg = score 10
  const fanOutScore = Math.min(10, fanOutRatio * 10)

  // Unused export ratio
  const unusedRatio = input.unusedExports / input.fileCount
  const unusedScore = Math.min(10, unusedRatio * 20) // 50% unused = 10

  return {
    score: circularScore * 0.35 + densityScore * 0.2 + fanOutScore * 0.25 + unusedScore * 0.2,
    available: true,
  }
}

/**
 * Coverage: 10 × (1 - lcovCoverage) + coverage gap penalty.
 * Unavailable if no lcov data.
 */
export function coverageSubscore(input: EntropyInput): EntropySubscore {
  if (input.lcovCoverage === undefined) return { score: 0, available: false }
  const base = 10 * (1 - input.lcovCoverage)
  const gapPenalty = input.fileCount > 0 ? (input.coverageGaps / input.fileCount) * 5 : 0
  return { score: Math.min(10, base + gapPenalty), available: true }
}

/**
 * Violations: weighted finding count / file count, capped at 10.
 * Always available (0 if no findings).
 */
export function violationsSubscore(input: EntropyInput): EntropySubscore {
  if (input.fileCount === 0) return { score: 0, available: true }
  const rate = input.findingsByWeight / input.fileCount
  return { score: Math.min(10, rate * 2), available: true } // 5 weighted findings per file = 10
}

/**
 * Classification: 10 × (1 - resolvedRatio).
 * Always available.
 */
export function classificationSubscore(input: EntropyInput): EntropySubscore {
  return { score: 10 * (1 - input.resolvedRatio), available: true }
}
```

- [ ] **Step 3: Write the composition function**

```typescript
// packages/core/src/entropy/index.ts

export {
  type EntropyResult,
  type EntropySubscore,
  type EntropyInput,
  ENTROPY_THRESHOLDS,
  SUBSCORE_WEIGHTS,
  classifyEntropy,
} from './types.js'

import type { EntropyInput, EntropyResult, EntropySubscore } from './types.js'
import { SUBSCORE_WEIGHTS, classifyEntropy } from './types.js'
import {
  stabilitySubscore,
  boundariesSubscore,
  coverageSubscore,
  violationsSubscore,
  classificationSubscore,
} from './subscores.js'

type SubscoreKey = keyof typeof SUBSCORE_WEIGHTS

const SUBSCORE_FNS: Record<SubscoreKey, (input: EntropyInput) => EntropySubscore> = {
  stability: stabilitySubscore,
  boundaries: boundariesSubscore,
  coverage: coverageSubscore,
  violations: violationsSubscore,
  classification: classificationSubscore,
}

/**
 * Compute entropy from pre-gathered input metrics.
 * Weights redistribute when a subscore is unavailable.
 */
export function computeEntropy(input: EntropyInput): EntropyResult {
  const subscores = {} as EntropyResult['subscores']
  let totalWeight = 0
  let weightedSum = 0

  for (const key of Object.keys(SUBSCORE_FNS) as SubscoreKey[]) {
    const sub = SUBSCORE_FNS[key](input)
    subscores[key] = sub
    if (sub.available) {
      totalWeight += SUBSCORE_WEIGHTS[key]
      weightedSum += SUBSCORE_WEIGHTS[key] * sub.score
    }
  }

  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0

  return {
    score,
    classification: classifyEntropy(score),
    subscores,
  }
}
```

- [ ] **Step 4: Write comprehensive tests**

```typescript
// packages/core/src/tests/entropy/entropy.test.ts

import { describe, it, expect } from 'vitest'
import { computeEntropy, classifyEntropy, type EntropyInput } from '../../entropy/index.js'

function makeInput(overrides: Partial<EntropyInput> = {}): EntropyInput {
  return {
    fileCount: 100,
    passRate: 1.0,
    flakyRatio: 0,
    circularDepFiles: 0,
    edgeCount: 150,
    maxFanOut: 5,
    unusedExports: 0,
    lcovCoverage: 0.8,
    coverageGaps: 0,
    findingsByWeight: 0,
    resolvedRatio: 1.0,
    ...overrides,
  }
}

describe('classifyEntropy', () => {
  it('classifies scores into the correct buckets', () => {
    expect(classifyEntropy(0)).toBe('excellent')
    expect(classifyEntropy(2.9)).toBe('excellent')
    expect(classifyEntropy(3.0)).toBe('good')
    expect(classifyEntropy(4.9)).toBe('good')
    expect(classifyEntropy(5.0)).toBe('moderate')
    expect(classifyEntropy(6.9)).toBe('moderate')
    expect(classifyEntropy(7.0)).toBe('poor')
    expect(classifyEntropy(8.9)).toBe('poor')
    expect(classifyEntropy(9.0)).toBe('critical')
    expect(classifyEntropy(10)).toBe('critical')
  })
})

describe('computeEntropy', () => {
  it('returns excellent for a pristine codebase', () => {
    const result = computeEntropy(makeInput())
    expect(result.score).toBeLessThan(3.0)
    expect(result.classification).toBe('excellent')
    expect(result.subscores.stability.available).toBe(true)
    expect(result.subscores.stability.score).toBe(0)
  })

  it('penalizes low pass rate in stability', () => {
    const result = computeEntropy(makeInput({ passRate: 0.5 }))
    expect(result.subscores.stability.score).toBe(5) // 10 * (1 - 0.5)
    expect(result.score).toBeGreaterThan(1)
  })

  it('penalizes flaky tests in stability', () => {
    const noFlaky = computeEntropy(makeInput({ passRate: 0.9 }))
    const withFlaky = computeEntropy(makeInput({ passRate: 0.9, flakyRatio: 0.5 }))
    expect(withFlaky.subscores.stability.score).toBeGreaterThan(noFlaky.subscores.stability.score)
  })

  it('penalizes circular dependencies in boundaries', () => {
    const result = computeEntropy(makeInput({ circularDepFiles: 25 }))
    expect(result.subscores.boundaries.score).toBeGreaterThan(0)
  })

  it('penalizes low coverage', () => {
    const result = computeEntropy(makeInput({ lcovCoverage: 0.2 }))
    expect(result.subscores.coverage.score).toBeGreaterThan(5)
  })

  it('penalizes findings by severity weight', () => {
    const result = computeEntropy(makeInput({ findingsByWeight: 50 }))
    expect(result.subscores.violations.score).toBeGreaterThan(0)
  })

  it('penalizes incomplete classification', () => {
    const result = computeEntropy(makeInput({ resolvedRatio: 0.3 }))
    expect(result.subscores.classification.score).toBe(7) // 10 * (1 - 0.3)
  })

  it('redistributes weight when stability is unavailable', () => {
    const withStability = computeEntropy(makeInput({ passRate: 1.0, lcovCoverage: 0.0 }))
    const withoutStability = computeEntropy(makeInput({ passRate: undefined, lcovCoverage: 0.0 }))
    // Without stability (which was 0), coverage subscore dominates more
    expect(withoutStability.subscores.stability.available).toBe(false)
    expect(withoutStability.score).toBeGreaterThan(withStability.score)
  })

  it('redistributes weight when coverage is unavailable', () => {
    const result = computeEntropy(makeInput({ lcovCoverage: undefined }))
    expect(result.subscores.coverage.available).toBe(false)
    // Score should still compute from the other 4 subscores
    expect(typeof result.score).toBe('number')
  })

  it('handles zero files gracefully', () => {
    const result = computeEntropy(makeInput({ fileCount: 0 }))
    expect(result.score).toBe(0)
    expect(result.classification).toBe('excellent')
  })

  it('caps all subscores at 10', () => {
    const result = computeEntropy(
      makeInput({
        passRate: 0,
        flakyRatio: 1.0,
        circularDepFiles: 100,
        maxFanOut: 1000,
        unusedExports: 100,
        lcovCoverage: 0,
        coverageGaps: 100,
        findingsByWeight: 10000,
        resolvedRatio: 0,
      })
    )
    expect(result.subscores.stability.score).toBeLessThanOrEqual(10)
    expect(result.subscores.boundaries.score).toBeLessThanOrEqual(10)
    expect(result.subscores.coverage.score).toBeLessThanOrEqual(10)
    expect(result.subscores.violations.score).toBeLessThanOrEqual(10)
    expect(result.subscores.classification.score).toBeLessThanOrEqual(10)
    expect(result.score).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 5: Run the tests**

Run: `cd packages/core && npx vitest run src/tests/entropy/entropy.test.ts` Expected: All 11 tests
PASS

- [ ] **Step 6: Export from core**

Add to `packages/core/src/index.ts`:

```typescript
export * from './entropy/index.js'
```

- [ ] **Step 7: Build and verify**

Run: `pnpm build` Expected: Clean build, no type errors

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/entropy/ packages/core/src/tests/entropy/ packages/core/src/index.ts
git commit -m "feat(core): Add entropy engine with 5 subscores and weight redistribution"
```

---

### Task 2: Data Pipeline — Wire Entropy into Analyze and Dashboard Commands

**Files:**

- Modify: `packages/reports/src/model/dashboard.ts`
- Modify: `packages/reports/src/model/history.ts`
- Modify: `packages/reports/src/renderer/inject.ts`
- Modify: `packages/cli/src/commands/analyze.ts`
- Modify: `packages/cli/src/commands/dashboard.ts`
- Modify: `packages/cli/src/index.ts` (check command)

**Context:** Both `analyze` and `dashboard` commands already have access to all data needed for
entropy — the import graph, findings, test records, and skeleton. We need to:

1. Extend the data models to carry entropy
2. Add a helper that gathers `EntropyInput` from the available data
3. Call `computeEntropy()` in both commands
4. Store results in history and dashboard data

The `analyze` command is at `packages/cli/src/commands/analyze.ts`. It already loads topology,
import graph, test records, and runs analysis. It returns `{ findings, summary }`.

The `dashboard` command is at `packages/cli/src/commands/dashboard.ts`. It does the same plus writes
dashboard data and history.

The `check` command is inline at `packages/cli/src/index.ts:99-117`. It calls `runAnalyzeCommand()`
and exits based on severity.

To gather `EntropyInput` from the available data, we need a helper function. This helper needs:

- `files: string[]` — from the file walk
- `importGraph: ImportGraph` — already built
- `findings: Finding[]` — already computed
- `topology: Map<string, DimensionSet>` — already built from skeleton
- `testRecords` — aggregated stats from connectors
- `lcovCoverage` — from connector aggregation

The analyze command already has `importGraph`, `findings`, `topology`. It also loads test records.
We need to extract pass rate, flaky ratio, circular dep count, unused export count, and coverage gap
count from the findings array; and coverage rate from the test records (lcov connector).

For per-package entropy: filter all inputs by package prefix, compute independently.

- [ ] **Step 1: Extend DashboardData**

In `packages/reports/src/model/dashboard.ts`, add to the interface:

```typescript
import type { EntropyResult } from '@spaguettiscope/core'

export interface DashboardData {
  // ... existing fields ...
  entropy?: {
    overall: EntropyResult
    byPackage: Record<string, EntropyResult>
  }
}
```

- [ ] **Step 2: Extend HistoryEntry**

In `packages/reports/src/model/history.ts`, add to the interface:

```typescript
export interface HistoryEntry {
  // ... existing fields ...
  entropyScore?: number
  entropyByPackage?: Record<string, number>
}
```

- [ ] **Step 3: Create entropy input gatherer**

Create a helper function in `packages/cli/src/utils/entropy-input.ts`:

```typescript
import type { EntropyInput } from '@spaguettiscope/core'
import type { ImportGraph, Finding, DimensionSet } from '@spaguettiscope/core'
import type { NormalizedRunRecord } from '@spaguettiscope/reports'

export interface GatherEntropyInputOptions {
  files: string[]
  importGraph: ImportGraph
  findings: Finding[]
  topology: Map<string, DimensionSet>
  records: NormalizedRunRecord[]
}

export function gatherEntropyInput(opts: GatherEntropyInputOptions): EntropyInput {
  const { files, importGraph, findings, topology, records } = opts

  // Pass rate from testing records (exclude coverage/lint connectors)
  const testRecords = records
    .filter(
      r =>
        r.status === 'passed' ||
        r.status === 'failed' ||
        r.status === 'skipped' ||
        r.status === 'broken'
    )
    .filter(
      r => r.connectorId !== 'lcov' && r.connectorId !== 'eslint' && r.connectorId !== 'typescript'
    )
  const passedCount = testRecords.filter(r => r.status === 'passed').length
  const totalTests = testRecords.length
  const passRate = totalTests > 0 ? passedCount / totalTests : undefined

  // Flaky ratio from flakiness findings
  const flakyFindings = findings.filter(f => f.kind === 'flakiness')
  const flakyRatio = totalTests > 0 ? flakyFindings.length / totalTests : 0

  // Circular deps from findings
  const circularDepFiles = new Set(
    findings
      .filter(f => f.ruleId === 'built-in:circular-dep')
      .map(f => (f.subject.type === 'file' ? f.subject.path : ''))
      .filter(Boolean)
  ).size

  // Graph metrics
  let edgeCount = 0
  let maxFanOut = 0
  for (const [, targets] of importGraph.imports) {
    edgeCount += targets.size
    if (targets.size > maxFanOut) maxFanOut = targets.size
  }

  // Unused exports from findings
  const unusedExports = findings.filter(f => f.ruleId === 'built-in:unused-export').length

  // LCov coverage
  const lcovRecords = records.filter(r => r.connectorId === 'lcov')
  const lcovPassed = lcovRecords.filter(r => r.status === 'passed').length
  const lcovCoverage = lcovRecords.length > 0 ? lcovPassed / lcovRecords.length : undefined

  // Coverage gaps from findings
  const coverageGaps = findings.filter(f => f.kind === 'coverage-gap').length

  // Findings by severity weight
  const findingsByWeight = findings.reduce((sum, f) => {
    if (f.severity === 'error') return sum + 3
    if (f.severity === 'warning') return sum + 1
    return sum + 0.5
  }, 0)

  // Classification completeness
  const totalEntries = topology.size
  const resolvedEntries = [...topology.values()].filter(dims => {
    const keys = Object.keys(dims)
    return keys.length > 0 && !keys.some(k => k.endsWith('?') || k === '?')
  }).length
  const resolvedRatio = totalEntries > 0 ? resolvedEntries / totalEntries : 1

  return {
    fileCount: files.length,
    passRate,
    flakyRatio,
    circularDepFiles,
    edgeCount,
    maxFanOut,
    unusedExports,
    lcovCoverage,
    coverageGaps,
    findingsByWeight,
    resolvedRatio,
  }
}

/**
 * Compute entropy overall and per-package.
 */
export function computeEntropyForProject(
  opts: GatherEntropyInputOptions,
  packages: Array<{ rel: string }>,
  computeEntropy: (input: EntropyInput) => import('@spaguettiscope/core').EntropyResult
): {
  overall: import('@spaguettiscope/core').EntropyResult
  byPackage: Record<string, import('@spaguettiscope/core').EntropyResult>
} {
  const overall = computeEntropy(gatherEntropyInput(opts))

  const byPackage: Record<string, import('@spaguettiscope/core').EntropyResult> = {}
  for (const pkg of packages) {
    if (pkg.rel === '.') continue
    const pkgFiles = opts.files.filter(f => f.startsWith(pkg.rel + '/'))
    if (pkgFiles.length === 0) continue

    const pkgFindings = opts.findings.filter(f => {
      if (f.subject.type === 'file') return f.subject.path.startsWith(pkg.rel + '/')
      if (f.subject.type === 'edge') return f.subject.from.startsWith(pkg.rel + '/')
      return false
    })

    // Build scoped import graph metrics
    const pkgImports = new Map<string, Set<string>>()
    for (const [src, targets] of opts.importGraph.imports) {
      if (!src.startsWith(pkg.rel + '/')) continue
      const filtered = new Set([...targets].filter(t => t.startsWith(pkg.rel + '/')))
      if (filtered.size > 0) pkgImports.set(src, filtered)
    }
    const scopedGraph = { ...opts.importGraph, imports: pkgImports, importedBy: new Map() }

    const pkgRecords = opts.records.filter(r => {
      const dims = r.dimensions as Record<string, string>
      return dims.package?.includes(pkg.rel) || false
    })

    const pkgTopology = new Map<string, import('@spaguettiscope/core').DimensionSet>()
    for (const [file, dims] of opts.topology) {
      if (file.startsWith(pkg.rel + '/')) pkgTopology.set(file, dims)
    }

    const pkgInput = gatherEntropyInput({
      files: pkgFiles,
      importGraph: scopedGraph,
      findings: pkgFindings,
      topology: pkgTopology,
      records: pkgRecords,
    })

    byPackage[pkg.rel] = computeEntropy(pkgInput)
  }

  return { overall, byPackage }
}
```

- [ ] **Step 4: Wire entropy into the analyze command**

In `packages/cli/src/commands/analyze.ts`, after findings are computed (after `runAnalysis()` call),
add entropy computation and include it in the output. The function already has access to `files`,
`importGraph`, `topology`, `testRecords`, and `findings`.

Add to imports:

```typescript
import { computeEntropy, type EntropyResult } from '@spaguettiscope/core'
import { gatherEntropyInput } from '../utils/entropy-input.js'
```

After the analysis spinner succeeds, add:

```typescript
const entropyInput = gatherEntropyInput({
  files: allFiles,
  importGraph,
  findings,
  topology,
  records: testRecords,
})
const entropy = computeEntropy(entropyInput)
```

Update the return type to include entropy:

```typescript
export interface AnalyzeResult {
  findings: Finding[]
  summary: { error: number; warning: number; info: number }
  entropy: EntropyResult
}
```

Add entropy to the printed summary (after the findings summary line):

```typescript
printSuccess(
  `Analysis complete — ${summary.error} errors, ${summary.warning} warnings, ${summary.info} info`
)
printSuccess(`Entropy: ${entropy.score} (${entropy.classification})`)
```

Return entropy in the result:

```typescript
return { findings, summary, entropy }
```

- [ ] **Step 5: Wire entropy into the dashboard command**

In `packages/cli/src/commands/dashboard.ts`, after analysis runs (around line 308), compute entropy
and add it to the dashboard data and history entry.

The dashboard command already has `allFiles`, `importGraph`, `skeleton` (from `readSkeleton()`),
test `records`, and `findings`. It also has `packages` from `discoverWorkspaces()`.

Add imports:

```typescript
import { computeEntropy } from '@spaguettiscope/core'
import { computeEntropyForProject, gatherEntropyInput } from '../utils/entropy-input.js'
```

After findings are computed, add:

```typescript
// Compute entropy
const entropySpinner = ora('Computing entropy…').start()
const topology = new Map<string, DimensionSet>()
for (const r of records) {
  if (r.dimensions) {
    // Use the first file path from the record if available
    // Records don't have file paths directly, so use topology from skeleton
  }
}
// Build topology from skeleton for entropy
const skeletonData = readSkeleton(skeletonPath)
const topoForEntropy = new Map<string, DimensionSet>()
for (const f of allFiles) {
  const matched = matchFile(f, skeletonData)
  if (matched) topoForEntropy.set(f, matched)
}

const entropyResult = computeEntropyForProject(
  {
    files: allFiles,
    importGraph,
    findings,
    topology: topoForEntropy,
    records,
  },
  packages,
  computeEntropy
)
entropySpinner.succeed(
  `Entropy: ${entropyResult.overall.score} (${entropyResult.overall.classification})`
)
```

Add entropy to dashboard data:

```typescript
const dashboardData: DashboardData = {
  // ... existing fields ...
  entropy: entropyResult,
}
```

Add to history entry:

```typescript
const historyEntry: HistoryEntry = {
  // ... existing fields ...
  entropyScore: entropyResult.overall.score,
  entropyByPackage: Object.fromEntries(
    Object.entries(entropyResult.byPackage).map(([k, v]) => [k, v.score])
  ),
}
```

- [ ] **Step 6: Add --max-entropy to check command**

In `packages/cli/src/index.ts`, in the `check` command definition (around line 99), add:

```typescript
.option('--max-entropy <threshold>', 'Exit 1 if overall entropy exceeds this value (0-10)', parseFloat)
```

In the check action, after the severity check, add:

```typescript
if (opts.maxEntropy !== undefined && result.entropy.score > opts.maxEntropy) {
  printError(`Entropy ${result.entropy.score} exceeds threshold ${opts.maxEntropy}`)
  process.exit(1)
}
```

- [ ] **Step 7: Build and verify**

Run: `pnpm build` Expected: Clean build

- [ ] **Step 8: Commit**

```bash
git add packages/reports/src/model/ packages/cli/src/commands/ packages/cli/src/utils/entropy-input.ts packages/cli/src/index.ts
git commit -m "feat(cli): Wire entropy engine into analyze, dashboard, and check commands"
```

---

### Task 3: Dashboard Renderer — Entropy Card, Health Function, Design Token

**Files:**

- Modify: `packages/reports/src/renderer/html/index.html`
- Modify: `packages/reports/src/renderer/html/src/shared.tsx`
- Modify: `packages/reports/src/renderer/html/src/derive.ts`
- Modify: `packages/reports/src/renderer/html/src/views/Observatory.tsx`
- Modify: `packages/reports/src/renderer/html/src/App.tsx`

**Context:** The dashboard renderer is a React + Recharts SPA bundled by Vite. Data arrives as JSON
files fetched at runtime (`data/summary.json`, `data/records.json`, `data/findings.json`). The
Observatory view shows 4 metric cards in a CSS grid. We're adding a 5th "Entropy" card with a
yellow/gold accent.

The current color system uses OKLCH CSS custom properties defined in `index.html`. Health functions
in `shared.tsx` return `HealthInfo` objects with accent, bg, chip, and text colors. MetricCard in
`Observatory.tsx` renders each card with a 4px left border in the accent color and a corner glow.

**Important:** The yellow/gold is the entropy accent color (the color of spaghetti). Card background
and surface treatment are left to the implementer's design judgment — the card should fit cohesively
with the existing dark theme.

- [ ] **Step 1: Add `--c-entropy` CSS custom property**

In `packages/reports/src/renderer/html/index.html`, add to the dark theme `:root` block (after
`--c-coverage`):

```css
--c-entropy: oklch(85% 0.16 85);
--c-entropy-bg: oklch(18% 0.04 85);
```

Add to the light theme `@media (prefers-color-scheme: light)` block:

```css
--c-entropy: oklch(55% 0.16 85);
--c-entropy-bg: oklch(94% 0.04 85);
```

Add to the forced light `[data-theme="light"]` block:

```css
--c-entropy: oklch(55% 0.16 85);
--c-entropy-bg: oklch(94% 0.04 85);
```

- [ ] **Step 2: Add entropy color and health function to shared.tsx**

In `packages/reports/src/renderer/html/src/shared.tsx`:

Add to the `C` color object:

```typescript
entropy: 'var(--c-entropy)',
entropyBg: 'var(--c-entropy-bg)',
```

Add the entropy health function (after `findingsHealth`):

```typescript
export function entropyHealth(score: number): HealthInfo {
  if (score < 3.0) return { accent: C.passed, bg: C.passedBg, chip: '✓ Excellent', text: C.passed }
  if (score < 5.0) return { accent: C.entropy, bg: C.entropyBg, chip: 'Good', text: C.entropy }
  if (score < 7.0)
    return { accent: C.warning, bg: C.warningBg, chip: '⚠ Moderate', text: C.warning }
  if (score < 9.0) return { accent: C.failed, bg: C.failedBg, chip: '⚠ Poor', text: C.failed }
  return { accent: C.failed, bg: C.failedBg, chip: '✕ Critical', text: C.failed }
}
```

- [ ] **Step 3: Thread entropy data through App.tsx**

In `packages/reports/src/renderer/html/src/App.tsx`, the `useDashboardData()` hook fetches
`summary.json`. The summary already contains `entropy` from our DashboardData changes. Ensure the
type is available:

In the RawSummary type (or wherever the fetch result is typed), add:

```typescript
entropy?: {
  overall: {
    score: number
    classification: string
    subscores: Record<string, { score: number; available: boolean }>
  }
  byPackage: Record<string, {
    score: number
    classification: string
    subscores: Record<string, { score: number; available: boolean }>
  }>
}
```

Pass `summary.entropy` through to the Observatory component as a prop.

- [ ] **Step 4: Add EntropyResult type to derive.ts**

In `packages/reports/src/renderer/html/src/derive.ts`, add the renderer-side entropy type:

```typescript
export interface RawEntropyResult {
  score: number
  classification: string
  subscores: Record<string, { score: number; available: boolean }>
}
```

Add to `PackageInfo`:

```typescript
entropy?: RawEntropyResult
```

In `derivePackages()`, if entropy byPackage data exists, merge it:

```typescript
// After building the package info array, enrich with entropy
if (summary.entropy?.byPackage) {
  for (const pkg of packages) {
    const entropyData = summary.entropy.byPackage[pkg.name] ?? summary.entropy.byPackage[pkg.type]
    if (entropyData) pkg.entropy = entropyData
  }
}
```

The exact lookup key depends on how packages are keyed — match by the package `rel` path which
appears as keys in `byPackage`.

- [ ] **Step 5: Add Entropy MetricCard to Observatory**

In `packages/reports/src/renderer/html/src/views/Observatory.tsx`, in the 4-card grid, add a 5th
card after Coverage:

```tsx
{
  summary.entropy &&
    (() => {
      const e = summary.entropy.overall
      const health = entropyHealth(e.score)
      return (
        <MetricCard
          label="ENTROPY"
          value={e.score.toFixed(1)}
          sub={`${e.classification} · 5 subscores`}
          health={health}
        />
      )
    })()
}
```

Update the grid to accommodate 5 cards. The current grid likely uses `repeat(4, 1fr)` or similar —
change to `repeat(auto-fit, minmax(200px, 1fr))` or `repeat(5, 1fr)` to fit the 5th card.

- [ ] **Step 6: Build the renderer and verify visually**

Run: `cd packages/reports && pnpm build:renderer` Then:
`pnpm build && node packages/cli/dist/index.js dashboard` Open the generated dashboard and verify
the Entropy card appears with the yellow/gold accent.

- [ ] **Step 7: Commit**

```bash
git add packages/reports/src/renderer/ packages/reports/src/model/
git commit -m "feat(reports): Add Entropy card to dashboard with yellow/gold accent"
```

---

### Task 4: Dashboard Renderer — Trend Sparkline, Package Badges, Dimension Column

**Files:**

- Modify: `packages/reports/src/renderer/html/src/views/Observatory.tsx`
- Modify: `packages/reports/src/renderer/html/src/derive.ts`

**Context:** This task adds the remaining dashboard entropy UI: a trend sparkline in the Trends
sidebar, entropy badges on package tiles in the Health Map, and an entropy column in the dimension
panels (BY ROLE, BY DOMAIN, BY LAYER).

The Trends sidebar currently shows two Recharts `AreaChart` sparklines: Test count and Coverage.
Each uses a `ResponsiveContainer` with height 56px. History entries come from `summary.history`.

The Package Health Map renders tiles via `PackageMap` component. Each tile shows package name, pass
rate, test count, status bar, and coverage %.

The dimension panels render rows with dimension value, a colored bar, test count, and pass rate.

- [ ] **Step 1: Add Entropy sparkline to Trends sidebar**

In Observatory.tsx, in the Trends sidebar section (after the Coverage sparkline), add:

```tsx
{
  trend.some(t => t.entropy !== undefined) && (
    <>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>Entropy</div>
      <ResponsiveContainer width="100%" height={56}>
        <AreaChart data={trend}>
          <defs>
            <linearGradient id={`${gradId}-entropy`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.entropy} stopOpacity={0.25} />
              <stop offset="95%" stopColor={C.entropy} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="entropy"
            stroke={C.entropy}
            strokeWidth={2}
            fill={`url(#${gradId}-entropy)`}
            dot={false}
          />
          <Tooltip
            contentStyle={{
              background: C.surfaceHigh,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              fontSize: 11,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </>
  )
}
```

Update the trend data mapping to include entropy from history:

```typescript
const trend = (summary.history ?? []).slice(-20).map((h, i) => ({
  i,
  total: h.overall.total,
  coverage: h.coveragePassRate,
  entropy: h.entropyScore, // new field
}))
```

- [ ] **Step 2: Add entropy badge to Package Health Map tiles**

In the PackageMap component, inside each package tile, add an entropy badge after the coverage line:

```tsx
{
  pkg.entropy && (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: entropyHealth(pkg.entropy.score).text,
      }}
    >
      ∿ {pkg.entropy.score.toFixed(1)}
    </div>
  )
}
```

The `∿` character (tilde wave) is a subtle nod to spaghetti/noodles. The color comes from the
entropy health function based on the score.

- [ ] **Step 3: Add entropy column to dimension panel rows**

In the dimension panel rendering (the BY ROLE, BY DOMAIN, BY LAYER sections), each row currently
shows: value name, bar, test count, pass rate. Add entropy after pass rate:

This requires computing per-dimension-value entropy. Since we don't have full per-slice entropy in
the summary data (that would require per-slice EntropyInput which is expensive), show entropy only
at the package level in the dimension panels for now. If `summary.entropy.byPackage` data aligns
with the dimension (e.g., domain values match package names), show it.

A simpler approach: for the "BY PACKAGE" / package-level dimension, show entropy. For other
dimensions, show "—" for now. This can be enhanced later when per-slice entropy is computed
server-side.

```tsx
<span style={{ fontSize: 12, color: C.dim, minWidth: 40, textAlign: 'right' }}>
  {pkg.entropy ? pkg.entropy.score.toFixed(1) : '—'}
</span>
```

- [ ] **Step 4: Build and verify visually**

Run: `cd packages/reports && pnpm build:renderer` Then:
`pnpm build && node packages/cli/dist/index.js dashboard` Open the dashboard and verify:

- Entropy sparkline appears in Trends (if history has entries with entropyScore)
- Package tiles show entropy badge
- Dimension panels show entropy column

- [ ] **Step 5: Commit**

```bash
git add packages/reports/src/renderer/
git commit -m "feat(reports): Add entropy sparkline, package badges, and dimension column"
```

---

### Task 5: AI-Friendly CLI Messaging — Guidance Module

**Files:**

- Create: `packages/cli/src/formatter/guidance.ts`
- Create: `packages/cli/src/tests/formatter/guidance.test.ts`

**Context:** This module builds context-aware post-command messages. Each function takes the
command's result data and returns a formatted string. The messages always include: what happened,
the pipeline map with current position, adapted next step, and a guiding question when a decision is
needed.

The pipeline is: `init → scan → annotate resolve → analyze/dashboard`

- [ ] **Step 1: Write tests for guidance messages**

```typescript
// packages/cli/src/tests/formatter/guidance.test.ts

import { describe, it, expect } from 'vitest'
import {
  initGuidance,
  scanGuidance,
  annotateListGuidance,
  annotateResolveGuidance,
  analyzeGuidance,
  dashboardGuidance,
  checkGuidance,
} from '../../formatter/guidance.js'

describe('scanGuidance', () => {
  it('suggests annotate resolve when there are pending entries', () => {
    const msg = scanGuidance({
      fileCount: 903,
      newEntries: 19,
      unchanged: 0,
      stale: 0,
      pendingDomains: 4,
      pendingLayers: 7,
      layerPolicyPackages: 3,
      skeletonPath: '.spasco/skeleton.yaml',
    })
    expect(msg).toContain('annotate')
    expect(msg).toContain('4 proposed domains')
    expect(msg).toContain('7 proposed layers')
    expect(msg).toContain('init → scan')
  })

  it('suggests analyze/dashboard when nothing is pending', () => {
    const msg = scanGuidance({
      fileCount: 903,
      newEntries: 0,
      unchanged: 19,
      stale: 0,
      pendingDomains: 0,
      pendingLayers: 0,
      layerPolicyPackages: 3,
      skeletonPath: '.spasco/skeleton.yaml',
    })
    expect(msg).toContain('nothing pending')
    expect(msg).toContain('analyze')
    expect(msg).toContain('dashboard')
  })
})

describe('initGuidance', () => {
  it('suggests scan as next step', () => {
    const msg = initGuidance({
      connectorCount: 3,
      pluginCount: 1,
      configPath: 'spasco.config.json',
    })
    expect(msg).toContain('spasco scan')
    expect(msg).toContain('3 connector')
  })
})

describe('analyzeGuidance', () => {
  it('includes entropy score', () => {
    const msg = analyzeGuidance({
      errorCount: 0,
      warningCount: 2,
      infoCount: 5,
      entropyScore: 4.2,
      entropyClassification: 'good',
    })
    expect(msg).toContain('4.2')
    expect(msg).toContain('good')
    expect(msg).toContain('dashboard')
  })

  it('suggests investigating when there are errors', () => {
    const msg = analyzeGuidance({
      errorCount: 3,
      warningCount: 0,
      infoCount: 0,
      entropyScore: 7.5,
      entropyClassification: 'poor',
    })
    expect(msg).toContain('3 error')
    expect(msg).toContain('7.5')
  })
})

describe('annotateListGuidance', () => {
  it('suggests resolve when entries exist', () => {
    const msg = annotateListGuidance({ pendingCount: 11, dimensions: ['domain', 'layer'] })
    expect(msg).toContain('annotate resolve')
    expect(msg).toContain('11')
  })

  it('suggests analyze when fully resolved', () => {
    const msg = annotateListGuidance({ pendingCount: 0, dimensions: [] })
    expect(msg).toContain('fully resolved')
    expect(msg).toContain('analyze')
  })
})

describe('annotateResolveGuidance', () => {
  it('suggests next dimension when more remain', () => {
    const msg = annotateResolveGuidance({ resolved: 4, remainingDimensions: ['layer'] })
    expect(msg).toContain('layer')
    expect(msg).toContain('annotate resolve')
  })

  it('suggests analyze when all resolved', () => {
    const msg = annotateResolveGuidance({ resolved: 7, remainingDimensions: [] })
    expect(msg).toContain('analyze')
  })
})

describe('dashboardGuidance', () => {
  it('mentions output path and check command', () => {
    const msg = dashboardGuidance({
      outputPath: '.spasco/reports/index.html',
      entropyScore: 3.1,
      entropyClassification: 'good',
      testPassRate: 1.0,
      findingCount: 0,
    })
    expect(msg).toContain('.spasco/reports/index.html')
    expect(msg).toContain('spasco check')
  })
})

describe('checkGuidance', () => {
  it('shows pass result', () => {
    const msg = checkGuidance({
      passed: true,
      entropyScore: 2.1,
      maxEntropy: undefined,
      severity: 'error',
      errorCount: 0,
      warningCount: 0,
    })
    expect(msg).toContain('passed')
  })

  it('shows fail result with suggestions', () => {
    const msg = checkGuidance({
      passed: false,
      entropyScore: 8.0,
      maxEntropy: 7.0,
      severity: 'error',
      errorCount: 3,
      warningCount: 5,
    })
    expect(msg).toContain('failed')
    expect(msg).toContain('entropy')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && npx vitest run src/tests/formatter/guidance.test.ts` Expected: FAIL —
module not found

- [ ] **Step 3: Implement the guidance module**

```typescript
// packages/cli/src/formatter/guidance.ts

import chalk from 'chalk'

const dim = chalk.dim
const bold = chalk.bold
const cyan = chalk.cyan

function pipeline(current: string): string {
  const steps = ['init', 'scan', 'annotate resolve', 'analyze/dashboard']
  return steps.map(s => (s === current ? bold.underline(s) : dim(s))).join(dim(' → '))
}

// --- init ---

export interface InitGuidanceInput {
  connectorCount: number
  pluginCount: number
  configPath: string
}

export function initGuidance(input: InitGuidanceInput): string {
  const lines = [
    '',
    dim(
      `What happened: Detected ${input.connectorCount} connector(s)${input.pluginCount > 0 ? ` and ${input.pluginCount} plugin(s)` : ''}, wrote ${input.configPath}.`
    ),
    '',
    dim('Pipeline: ') + pipeline('init'),
    '',
    `Next step: Scan your project files to build the skeleton and import graph.`,
    cyan(`  spasco scan`),
    '',
    dim(`The scan will discover workspace packages, classify files by role/domain/layer,`),
    dim(`and propose dimension values for you to review.`),
  ]
  return lines.join('\n')
}

// --- scan ---

export interface ScanGuidanceInput {
  fileCount: number
  newEntries: number
  unchanged: number
  stale: number
  pendingDomains: number
  pendingLayers: number
  layerPolicyPackages: number
  skeletonPath: string
}

export function scanGuidance(input: ScanGuidanceInput): string {
  const hasPending = input.pendingDomains > 0 || input.pendingLayers > 0
  const lines = [
    '',
    dim(
      `What happened: Scanned ${input.fileCount} files → ${input.newEntries} new, ${input.unchanged} unchanged, ${input.stale} stale entries in ${input.skeletonPath}.`
    ),
  ]

  if (input.layerPolicyPackages > 0) {
    lines.push(
      dim(
        `Analyzed import directions for ${input.layerPolicyPackages} package(s) and drafted a layer policy.`
      )
    )
  }

  lines.push('')
  lines.push(dim('Pipeline: ') + pipeline('scan'))
  lines.push('')

  if (hasPending) {
    const parts: string[] = []
    if (input.pendingDomains > 0) parts.push(`${input.pendingDomains} proposed domains (domain?)`)
    if (input.pendingLayers > 0) parts.push(`${input.pendingLayers} proposed layers (layer?)`)
    lines.push(`You have ${parts.join(' and ')} awaiting confirmation.`)
    lines.push(`Normally you'd confirm the proposed annotations next, then run analysis.`)
    lines.push('')
    lines.push(`Next step: Review and confirm the proposed annotations.`)
    lines.push(
      cyan(`  spasco annotate list`) + dim(`                          — see all pending entries`)
    )
    if (input.pendingDomains > 0) {
      lines.push(
        cyan(`  spasco annotate resolve --as domain --all`) +
          dim(`     — accept all proposed domains`)
      )
    }
    if (input.pendingLayers > 0) {
      lines.push(
        cyan(`  spasco annotate resolve --as layer --all`) +
          dim(`      — accept all proposed layers`)
      )
    }
    lines.push('')
    lines.push(
      dim(
        `If you're confident in the proposals, confirm with --all. To inspect first, run annotate list.`
      )
    )
  } else {
    lines.push(
      `Normally you'd confirm annotations next, but ${bold('nothing is pending')} — skeleton is fully resolved.`
    )
    lines.push('')
    lines.push(`Next step: Run analysis or generate the dashboard.`)
    lines.push(
      cyan(`  spasco analyze`) +
        dim(`      — run analysis rules, compute entropy, surface findings`)
    )
    lines.push(cyan(`  spasco dashboard`) + dim(`    — generate the full HTML dashboard`))
  }

  return lines.join('\n')
}

// --- annotate list ---

export interface AnnotateListGuidanceInput {
  pendingCount: number
  dimensions: string[]
}

export function annotateListGuidance(input: AnnotateListGuidanceInput): string {
  const lines = ['']

  if (input.pendingCount === 0) {
    lines.push(dim('Pipeline: ') + pipeline('annotate resolve'))
    lines.push('')
    lines.push(`Skeleton is ${bold('fully resolved')} — no pending annotations.`)
    lines.push('')
    lines.push(`Next step: Run analysis or generate the dashboard.`)
    lines.push(cyan(`  spasco analyze`) + dim(`      — run analysis rules, compute entropy`))
    lines.push(cyan(`  spasco dashboard`) + dim(`    — generate the full HTML dashboard`))
  } else {
    lines.push(dim('Pipeline: ') + pipeline('annotate resolve'))
    lines.push('')
    lines.push(
      `${input.pendingCount} entries need annotation across dimensions: ${input.dimensions.join(', ')}.`
    )
    lines.push('')
    lines.push(`Next step: Resolve pending entries by dimension.`)
    for (const dim of input.dimensions) {
      lines.push(
        cyan(`  spasco annotate resolve --as ${dim} --all`) +
          chalk.dim(`  — accept all proposed ${dim} values`)
      )
    }
    lines.push('')
    lines.push(chalk.dim(`Use --all to accept proposals, or pass specific values to override.`))
  }

  return lines.join('\n')
}

// --- annotate resolve ---

export interface AnnotateResolveGuidanceInput {
  resolved: number
  remainingDimensions: string[]
}

export function annotateResolveGuidance(input: AnnotateResolveGuidanceInput): string {
  const lines = [
    '',
    dim(`What happened: Resolved ${input.resolved} entr${input.resolved === 1 ? 'y' : 'ies'}.`),
    '',
    dim('Pipeline: ') + pipeline('annotate resolve'),
    '',
  ]

  if (input.remainingDimensions.length > 0) {
    lines.push(`Still pending: ${input.remainingDimensions.join(', ')} dimension(s).`)
    lines.push('')
    lines.push(`Next step: Resolve the remaining dimensions.`)
    for (const d of input.remainingDimensions) {
      lines.push(cyan(`  spasco annotate resolve --as ${d} --all`))
    }
  } else {
    lines.push(`All annotations resolved. Normally you'd run analysis next.`)
    lines.push('')
    lines.push(`Next step: Run analysis to compute entropy and surface findings.`)
    lines.push(cyan(`  spasco analyze`) + dim(`      — run analysis rules, compute entropy`))
    lines.push(cyan(`  spasco dashboard`) + dim(`    — generate the full HTML dashboard`))
  }

  return lines.join('\n')
}

// --- analyze ---

export interface AnalyzeGuidanceInput {
  errorCount: number
  warningCount: number
  infoCount: number
  entropyScore: number
  entropyClassification: string
}

export function analyzeGuidance(input: AnalyzeGuidanceInput): string {
  const total = input.errorCount + input.warningCount + input.infoCount
  const lines = [
    '',
    dim(
      `What happened: Ran analysis rules → ${total} findings (${input.errorCount} errors, ${input.warningCount} warnings, ${input.infoCount} info).`
    ),
    dim(`Entropy: ${input.entropyScore} (${input.entropyClassification}).`),
    '',
    dim('Pipeline: ') + pipeline('analyze/dashboard'),
    '',
  ]

  if (input.errorCount > 0) {
    lines.push(
      `Found ${bold(String(input.errorCount))} error-severity finding(s). These would fail a CI gate.`
    )
    lines.push('')
  }

  lines.push(`Next step: Generate the dashboard to visualize results, or gate CI.`)
  lines.push(
    cyan(`  spasco dashboard`) +
      dim(`                    — generate the full HTML dashboard with entropy`)
  )
  lines.push(
    cyan(`  spasco check`) +
      dim(`                        — exit 1 if error findings exist (for CI)`)
  )
  lines.push(
    cyan(`  spasco check --max-entropy 7.0`) + dim(`    — also fail if entropy exceeds threshold`)
  )

  return lines.join('\n')
}

// --- dashboard ---

export interface DashboardGuidanceInput {
  outputPath: string
  entropyScore: number
  entropyClassification: string
  testPassRate: number
  findingCount: number
}

export function dashboardGuidance(input: DashboardGuidanceInput): string {
  const lines = [
    '',
    dim(`What happened: Generated dashboard at ${input.outputPath}.`),
    dim(
      `Pass rate: ${(input.testPassRate * 100).toFixed(1)}% · Entropy: ${input.entropyScore} (${input.entropyClassification}) · ${input.findingCount} findings.`
    ),
    '',
    dim('Pipeline: ') + pipeline('analyze/dashboard'),
    '',
    `The dashboard is ready to view. For CI gating:`,
    cyan(`  spasco check`) + dim(`                        — exit 1 on error findings`),
    cyan(`  spasco check --severity warning`) + dim(`  — exit 1 on warnings too`),
    cyan(`  spasco check --max-entropy 7.0`) + dim(`    — also fail if entropy exceeds threshold`),
  ]

  return lines.join('\n')
}

// --- check ---

export interface CheckGuidanceInput {
  passed: boolean
  entropyScore: number
  maxEntropy: number | undefined
  severity: string
  errorCount: number
  warningCount: number
}

export function checkGuidance(input: CheckGuidanceInput): string {
  const lines = ['']

  if (input.passed) {
    lines.push(`Check ${bold('passed')} — no findings at ${input.severity} severity or above.`)
    if (input.maxEntropy !== undefined) {
      lines.push(dim(`Entropy ${input.entropyScore} is within threshold ${input.maxEntropy}.`))
    }
  } else {
    lines.push(`Check ${bold('failed')}.`)
    if (input.errorCount > 0) {
      lines.push(dim(`${input.errorCount} error(s) found. Run spasco analyze to see details.`))
    }
    if (input.maxEntropy !== undefined && input.entropyScore > input.maxEntropy) {
      lines.push(
        dim(
          `Entropy ${input.entropyScore} exceeds threshold ${input.maxEntropy}. Reduce complexity to lower the score.`
        )
      )
    }
    lines.push('')
    lines.push(`To investigate:`)
    lines.push(cyan(`  spasco analyze`) + dim(`      — see all findings with details`))
    lines.push(cyan(`  spasco dashboard`) + dim(`    — generate visual dashboard for drill-down`))
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/cli && npx vitest run src/tests/formatter/guidance.test.ts` Expected: All tests
PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/formatter/guidance.ts packages/cli/src/tests/formatter/guidance.test.ts
git commit -m "feat(cli): Add context-aware guidance message builder"
```

---

### Task 6: Wire Guidance into All Commands

**Files:**

- Modify: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/commands/scan.ts`
- Modify: `packages/cli/src/commands/annotate.ts`
- Modify: `packages/cli/src/commands/analyze.ts`
- Modify: `packages/cli/src/commands/dashboard.ts`
- Modify: `packages/cli/src/index.ts` (check command)

**Context:** Each command already prints a success message at the end. We add a
`console.log(xxxGuidance({...}))` call after each command's final output. The guidance functions are
imported from `../formatter/guidance.js`.

To compute the guidance inputs, we need data that each command already has. For scan, we need to
count pending domain/layer entries from the skeleton. For annotate resolve, we need to check what
dimensions still have pending entries.

- [ ] **Step 1: Wire guidance into init**

In `packages/cli/src/commands/init.ts`, import:

```typescript
import { initGuidance } from '../formatter/guidance.js'
```

After the final success message (the `Config written → {configPath}` line), add:

```typescript
console.log(
  initGuidance({
    connectorCount: detected.length,
    pluginCount: detectedPlugins.length,
    configPath: configFileName,
  })
)
```

Remove the existing `Run: spasco dashboard` line since the guidance now covers next steps.

- [ ] **Step 2: Wire guidance into scan**

In `packages/cli/src/commands/scan.ts`, import:

```typescript
import { scanGuidance } from '../formatter/guidance.js'
import { readSkeleton, isPending } from '@spaguettiscope/core'
```

After `printSuccess(...)` at the end, add:

```typescript
// Count pending entries by dimension for guidance
const updatedSkeleton = readSkeleton(skeletonPath)
const pendingEntries = updatedSkeleton.entries.filter(e => isPending(e))
const pendingDomains = pendingEntries.filter(e =>
  Object.keys(e.attributes).some(k => k === 'domain?' || (k === '?' && !('domain' in e.attributes)))
).length
const pendingLayers = pendingEntries.filter(e =>
  Object.keys(e.attributes).some(k => k === 'layer?')
).length

console.log(
  scanGuidance({
    fileCount: allFiles.length,
    newEntries: added,
    unchanged,
    stale: markedStale,
    pendingDomains,
    pendingLayers,
    layerPolicyPackages: Object.keys(proposedLayerPolicy).length,
    skeletonPath,
  })
)
```

- [ ] **Step 3: Wire guidance into annotate list**

In `packages/cli/src/commands/annotate.ts`, import:

```typescript
import { annotateListGuidance } from '../formatter/guidance.js'
```

At the end of `runAnnotateList()`, after printing the pending entries (or the "no pending" message),
add:

```typescript
const pendingDimensions = [
  ...new Set(
    pending.flatMap(e =>
      Object.keys(e.attributes)
        .filter(k => k.endsWith('?'))
        .map(k => k.slice(0, -1))
    )
  ),
]
console.log(
  annotateListGuidance({
    pendingCount: pending.length,
    dimensions: pendingDimensions,
  })
)
```

- [ ] **Step 4: Wire guidance into annotate resolve**

In `packages/cli/src/commands/annotate.ts`, import:

```typescript
import { annotateResolveGuidance } from '../formatter/guidance.js'
```

At the end of `runAnnotateResolve()`, after the resolved count message, re-read skeleton to check
remaining:

```typescript
const updatedSkeleton = readSkeleton(skeletonPath)
const stillPending = updatedSkeleton.entries.filter(e => isPending(e))
const remainingDimensions = [
  ...new Set(
    stillPending.flatMap(e =>
      Object.keys(e.attributes)
        .filter(k => k.endsWith('?'))
        .map(k => k.slice(0, -1))
    )
  ),
]

console.log(
  annotateResolveGuidance({
    resolved,
    remainingDimensions,
  })
)
```

- [ ] **Step 5: Wire guidance into analyze**

In `packages/cli/src/commands/analyze.ts`, import:

```typescript
import { analyzeGuidance } from '../formatter/guidance.js'
```

After the summary print, add:

```typescript
console.log(
  analyzeGuidance({
    errorCount: summary.error,
    warningCount: summary.warning,
    infoCount: summary.info,
    entropyScore: entropy.score,
    entropyClassification: entropy.classification,
  })
)
```

- [ ] **Step 6: Wire guidance into dashboard**

In `packages/cli/src/commands/dashboard.ts`, import:

```typescript
import { dashboardGuidance } from '../formatter/guidance.js'
```

After the success message, add:

```typescript
console.log(
  dashboardGuidance({
    outputPath: resolve(outputDir, 'index.html'),
    entropyScore: entropyResult.overall.score,
    entropyClassification: entropyResult.overall.classification,
    testPassRate: dashboardData.overall.passRate,
    findingCount: findings.length,
  })
)
```

- [ ] **Step 7: Wire guidance into check**

In `packages/cli/src/index.ts`, in the check action, import:

```typescript
import { checkGuidance } from './formatter/guidance.js'
```

After the pass/fail determination and before `process.exit()`, add:

```typescript
const passed =
  failCount === 0 && (opts.maxEntropy === undefined || result.entropy.score <= opts.maxEntropy)
console.log(
  checkGuidance({
    passed,
    entropyScore: result.entropy.score,
    maxEntropy: opts.maxEntropy,
    severity: opts.severity ?? 'error',
    errorCount: result.summary.error,
    warningCount: result.summary.warning,
  })
)
```

- [ ] **Step 8: Build and test manually**

Run: `pnpm build && node packages/cli/dist/index.js scan` Expected: Scan output followed by guidance
message showing pipeline and next steps.

Run: `node packages/cli/dist/index.js analyze` Expected: Analysis output followed by guidance with
entropy score.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/commands/ packages/cli/src/index.ts
git commit -m "feat(cli): Wire context-aware guidance into all commands"
```

---

### Task 7: Help Descriptions and Banner Update

**Files:**

- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/src/formatter/index.ts`

**Context:** The CLI uses Commander.js for command registration. Each command has a `.description()`
call. Options have help text in `.option()`. The banner in `formatter/index.ts` displays the
tagline.

Current program description: `SpaguettiScope — Look at your spaghetti.` Current banner tagline:
`Framework-agnostic code entropy analyzer` + `Cool but serious. Built for developers.`

- [ ] **Step 1: Update banner tagline**

In `packages/cli/src/formatter/index.ts`, find the tagline string (around line 48) and replace:

From:

```typescript
'Framework-agnostic code entropy analyzer'
```

To:

```typescript
'Code topology & entropy analysis for monorepos'
```

Remove the subtitle line `Cool but serious. Built for developers.` if it exists as a separate
string.

- [ ] **Step 2: Update program description**

In `packages/cli/src/index.ts`, find the `.description()` call on the program (around line 5):

From:

```typescript
.description('SpaguettiScope — Look at your spaghetti.')
```

To:

```typescript
.description('SpaguettiScope — Classify files, track test health, and measure entropy across your monorepo.')
```

- [ ] **Step 3: Rewrite command descriptions**

Update each command's `.description()` in `packages/cli/src/index.ts`:

**dashboard:**

```typescript
.description(
  'Read configured connectors (Vitest, LCov, Allure, etc.), aggregate test and coverage records, ' +
  'compute entropy, run analysis rules, and generate an HTML dashboard. ' +
  'Output goes to the configured outputDir (default: .spasco/reports/). ' +
  'Also appends a snapshot to .spasco/history.jsonl for trend tracking.'
)
```

**scan:**

```typescript
.description(
  'Scan all project files, apply classification rules (built-in + plugins), and merge results ' +
  'into the skeleton file (.spasco/skeleton.yaml). Discovers workspace packages, infers domains ' +
  'from package names, proposes layer assignments from directory structure, and analyzes import ' +
  'directions to draft a layer policy. New entries get proposed values (key?) to confirm with ' +
  '`annotate resolve`.'
)
```

**annotate list:**

```typescript
.description(
  'List all skeleton entries with unresolved dimensions — entries marked with ? (unknown) or ' +
  'key? (proposed draft). Shows the proposed value and source for each. Use this to review ' +
  'what scan detected before confirming with `annotate resolve`.'
)
```

**annotate resolve:**

```typescript
.description(
  'Confirm or override proposed dimension values in the skeleton. Pass --all to accept all ' +
  'proposals for a dimension, or provide specific values to override. Resolving converts ' +
  'draft entries (key?) into confirmed entries (key) and removes the draft flag.'
)
```

**analyze:**

```typescript
.description(
  'Run all analysis rules (built-in + configured analysisPlugins) over the file topology, ' +
  'import graph, and test records. Computes the entropy score. Outputs findings grouped by ' +
  'kind and severity. Always exits 0 — use `check` for CI gating.'
)
```

**check:**

```typescript
.description(
  'Same as analyze but exits 1 if findings of the specified severity exist, or if entropy ' +
  'exceeds --max-entropy. Designed for CI gates. Combine --severity and --max-entropy for ' +
  'comprehensive quality gates.'
)
```

**init:**

```typescript
.description(
  'Auto-detect installed tools (Vitest, LCov, Playwright, Allure, ESLint, TypeScript) and ' +
  'workspace plugins (@spaguettiscope/plugin-*), then write a ready-to-use spasco.config.json. ' +
  'Refuses to overwrite an existing config. Use --interactive to confirm each detector.'
)
```

- [ ] **Step 4: Rewrite option descriptions**

Update option help strings to be descriptive. Key options to improve:

**dashboard options:**

```typescript
.option('--config <file>', 'Path to spasco.config.json (default: auto-detected from project root)')
.option('--output <dir>', 'Output directory for the generated HTML dashboard and data files (default: .spasco/reports/)')
.option('--open', 'Open the dashboard in the default browser after generating')
.option('--ci', 'CI mode: print a terminal summary only, skip HTML generation. Useful for CI logs.')
```

**check options:**

```typescript
.option('--severity <level>', 'Minimum severity to fail on: "error" (default), "warning", or "info"', 'error')
.option('--max-entropy <threshold>', 'Fail if overall entropy score exceeds this value (0-10 scale, e.g., 7.0)', parseFloat)
```

**annotate resolve options:**

```typescript
.option('--all', 'Resolve all pending entries for the specified dimension, accepting proposed values')
.option('--as <dimension>', 'The dimension to resolve (e.g., domain, layer, role). Required.')
.option('--add <attrs>', 'Extra key=value attributes to set alongside the resolution (comma-separated, e.g., layer=service,tag=reviewed)')
```

**init options:**

```typescript
.option('--interactive', 'Prompt to confirm each detected connector and plugin before writing config')
.option('--plugins <ids>', 'Comma-separated plugin module IDs to load detectors from (e.g., @spaguettiscope/plugin-nextjs)')
```

- [ ] **Step 5: Build and verify help output**

Run: `pnpm build && node packages/cli/dist/index.js --help` Expected: Updated program description
with all commands showing rich descriptions.

Run: `node packages/cli/dist/index.js dashboard --help` Expected: Full description of dashboard
command with descriptive option help.

- [ ] **Step 6: Update CLAUDE.md**

Update the banner description in `CLAUDE.md` to match the new tagline. Find and replace
`Framework-agnostic code entropy analyzer` if it appears, or update any description that says there
is no entropy score.

In the Architecture section, add the entropy module to the core exports table:

```markdown
| `entropy` | `computeEntropy`, `EntropyResult`, `EntropyInput`, `ENTROPY_THRESHOLDS` |
```

Add `--max-entropy` to the check command documentation.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/index.ts packages/cli/src/formatter/index.ts CLAUDE.md
git commit -m "feat(cli): Rewrite help descriptions and banner for AI-friendly operation"
```

---

## Self-Review

**Spec coverage check:**

| Spec section                                                                          | Covered by |
| ------------------------------------------------------------------------------------- | ---------- |
| 1. Entropy Engine (types, subscores, composition, per-package, weight redistribution) | Task 1     |
| 2. Dashboard Integration (card, sparkline, package badges, dimension column)          | Tasks 3, 4 |
| 3. Data Pipeline (analyze, dashboard, history, --max-entropy)                         | Task 2     |
| 4. AI-Friendly CLI Messaging (guidance module, all 7 commands)                        | Tasks 5, 6 |
| 5. Banner & Identity (tagline, program description, help descriptions)                | Task 7     |

**Placeholder scan:** No TBDs or TODOs. All code blocks are complete.

**Type consistency check:**

- `EntropyResult` defined in Task 1, used in Tasks 2-7 ✓
- `EntropyInput` defined in Task 1, gathered in Task 2 ✓
- `computeEntropy()` exported from Task 1, called in Task 2 ✓
- `entropyHealth()` defined in Task 3, used in Task 4 ✓
- All guidance function signatures in Task 5 match call sites in Task 6 ✓
- `AnalyzeResult` extended with `entropy` in Task 2, consumed by check in Task 2 ✓
