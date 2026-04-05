# Phase 3 — Analysis Engine Design

## Goal

Add a rule-based, plugin-extensible analysis layer that operates on top of the existing topology.
Rules emit structured **findings** (violations, coverage gaps, flakiness, unused files) which are
aggregated by dimension and surfaced in the report and CI.

## Architecture

The analysis pipeline is a new phase that runs after `scan` — topology is assumed to already exist
in the skeleton.

```
spasco scan     →  .spasco/skeleton.yaml     (topology: file → dimensions)
                          │
spasco analyze  →  findings[]                (analysis: rules over corpus)
                          │
                     aggregation             (group by dimensions → summaries)
                          │
                   report / exit code
```

Analysis plugins are declared separately from scan plugins in `spasco.config.json`:

```json
{
  "plugins": ["...nextjs/dist/index.js"],
  "analysisPlugins": ["...nextjs/dist/analysis.js"]
}
```

The runner:

1. Reads `.spasco/skeleton.yaml` → builds `topology: Map<file, DimensionSet>`
2. Loads analysis plugins, collects rules from those whose `canApply` returns true
3. Groups rules by `corpus` (`'files'`, `'edges'`, `'records'`)
4. Fetches only data sources declared across all active rules' `needs`
5. Iterates each corpus, runs matching rules, collects `Finding[]`
6. Reads/writes the intermediates cache
7. Aggregates findings by dimensions → outputs report

---

## File Layout

### Repository

```
.spasco/
  skeleton.yaml          checked in — human-maintained topology
  history.jsonl          checked in — dashboard audit trail
  intermediates.json     gitignored — generated analysis cache
  reports/               gitignored — generated HTML output
    index.html
    assets/

spasco.config.json       root — entry point, discoverable by CLI
```

`spasco init` generates `.spasco/.gitignore`:

```
reports/
intermediates.json
```

### Config schema defaults (updated)

```typescript
skeleton:               '.spasco/skeleton.yaml'
dashboard.outputDir:    '.spasco/reports'
dashboard.historyFile:  '.spasco/history.jsonl'
analysis.intermediates: '.spasco/intermediates.json'
```

Old paths remain supported — all fields are overridable. Existing projects migrate by moving files
and updating config, no code changes required.

Config file renamed from `spaguettiscope.config.json` to `spasco.config.json`. Old name still loaded
as a fallback for backwards compatibility.

### New source files

```
packages/core/src/analysis/
  types.ts               Finding, AnalysisRule, AnalysisPlugin, AnalysisContext
  runner.ts              runAnalysis() → Finding[]
  intermediates.ts       IntermediateCache (in-memory + optional disk persistence)
  built-in/
    coverage.ts          coverage-gap rule
    unused.ts            unused-export rule
    circular.ts          circular-dep rule
    flakiness.ts         flaky-test rule

packages/cli/src/commands/
  analyze.ts             spasco analyze command
  check.ts               spasco check command

plugins/nextjs/src/
  analysis.ts            nextjs-analysis AnalysisPlugin
```

---

## Interfaces

### AnalysisPlugin

```typescript
interface AnalysisPlugin {
  id: string
  canApply(packageRoot: string): boolean
  rules(): AnalysisRule[]
}
```

### AnalysisRule

```typescript
type Corpus = 'files' | 'edges' | 'records'
type DataSource = 'importGraph' | 'testRecords' | 'history'

interface AnalysisRule<C extends Corpus = Corpus> {
  id: string
  severity: 'error' | 'warning' | 'info'
  needs: DataSource[]
  corpus: C
  run(item: CorpusItem<C>, ctx: AnalysisContext): Finding[]
}
```

Corpus item shapes:

```typescript
// corpus: 'files'
type FileItem = { file: string; dimensions: DimensionSet }

// corpus: 'edges'
type EdgeItem = {
  from: { file: string; dimensions: DimensionSet }
  to: { file: string; dimensions: DimensionSet }
}

// corpus: 'records'
type RecordItem = { record: NormalizedRunRecord; dimensions: DimensionSet }
```

### Finding

```typescript
interface Finding {
  ruleId: string
  kind: 'violation' | 'coverage-gap' | 'flakiness' | 'unused' | 'metric'
  severity: 'error' | 'warning' | 'info'
  subject:
    | { type: 'file'; path: string }
    | { type: 'edge'; from: string; to: string }
    | { type: 'slice'; dimensions: DimensionSet }
  dimensions: DimensionSet // topology of the subject — enables aggregation
  value?: number // ratio, count, or score for metric findings
  message: string
}
```

### AnalysisContext

```typescript
interface AnalysisContext {
  topology: Map<string, DimensionSet> // full skeleton as a flat map
  importGraph?: ImportGraph // present if rule declared 'importGraph'
  testRecords?: NormalizedRunRecord[] // present if rule declared 'testRecords'
  history?: HistoryEntry[] // present if rule declared 'history'
  cache: IntermediateCache
}

interface IntermediateCache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
}
```

The runner populates `importGraph`, `testRecords`, and `history` lazily — only fetching what the
active rules declare in `needs`. Rules that need nothing beyond topology declare `needs: []`.

---

## Intermediates Cache

Persisted to `.spasco/intermediates.json`. Read at the start of an analysis run, written back at the
end.

| Cache key           | Computed by                     | Shape                                                | Invalidated when          |
| ------------------- | ------------------------------- | ---------------------------------------------------- | ------------------------- |
| `coverage-matrix`   | `coverage-gap` rule (first run) | `Record<sourceFile, string[]>` — source → test files | Skeleton changes          |
| `flakiness-index`   | `flaky-test` rule               | `Record<historyId, { pass, fail, total, score }>`    | New history entries added |
| `complexity-scores` | `complexity` rule (future)      | `Record<file, number>`                               | Source file modified      |

Each cache entry stores a `generatedAt` timestamp. The runner compares against the skeleton's mtime
and the most recent history entry timestamp. If nothing is newer, the cached value is reused.

---

## Built-in Analysis Rules

All four ship in `@spaguettiscope/core` without requiring a plugin.

### `coverage-gap`

- **Corpus:** `files`
- **Needs:** `testRecords`, `importGraph`
- **Logic:** For each file with a meaningful role (`page`, `hook`, `server-action`, `repository`,
  `schema`), check whether any test file directly imports it (via `importGraph.importedBy`). If not,
  emit a `coverage-gap` finding. Coverage is direct import only — no transitive traversal.
- **Caches:** `coverage-matrix` — built once from `importGraph.importedBy`, keyed by source file →
  test files that directly import it. Invalidated when skeleton changes.

### `unused-export`

- **Corpus:** `files`
- **Needs:** `importGraph`
- **Logic:** For each file where `importGraph.importedBy` is empty or undefined, and the file is not
  a known entry point (page, middleware, route-handler, instrumentation), emit an `unused` finding.

### `circular-dep`

- **Corpus:** `files`
- **Needs:** `importGraph`
- **Logic:** Run DFS from each file; if a cycle is detected, emit one `violation` finding per file
  in the cycle. Severity: `warning`.

### `flaky-test`

- **Corpus:** `records`
- **Needs:** `testRecords`
- **Logic:** On each analysis run, merge the current run's test records into the `flakiness-index`
  cache (keyed by `metadata.historyId`). For each record whose accumulated failure ratio is between
  0.1 and 0.9 (not reliably passing or failing across runs), emit a `flakiness` finding. `value` =
  failure ratio.
- **Caches:** `flakiness-index` — accumulated incrementally across analysis runs. Each run adds new
  pass/fail counts to existing entries rather than recomputing from scratch. `HistoryEntry`
  (dashboard snapshots) is not used — only current test records and the persisted index.

---

## NextJS Analysis Plugin

Ships in `plugins/nextjs/src/analysis.ts`, exported as a named `AnalysisPlugin`.

### `no-client-imports-server`

- **Corpus:** `edges`
- **Severity:** `error`
- **Logic:** If `from.dimensions.layer === 'client-component'` and
  `to.dimensions.role === 'server-action'`, emit a `violation`. Client components run in the browser
  and cannot directly call server actions via import.

### `no-cross-domain-page`

- **Corpus:** `edges`
- **Severity:** `warning`
- **Logic:** If both `from` and `to` have `role: page` and their `domain` values differ, emit a
  `violation`. Pages in different domains should not couple directly.

### `bff-layer-boundary`

- **Corpus:** `edges`
- **Severity:** `error`
- **Logic:** If `to.dimensions.layer === 'bff'` and `from.dimensions.layer === 'client-component'`,
  emit a `violation`. BFF route handlers are server-only; direct import from client code is a
  runtime error in Next.js.

---

## Allure Connector Improvements

The existing `AllureConnector` will be updated to:

1. **Better source file resolution** — parse `fullName` (e.g. `src/auth/login.test.ts#describe`) to
   extract the test file path when `testSourceFile` label is absent. Fall back chain:
   `testSourceFile` label → `fullName.split('#')[0]` → `labels[package]` (dot-separated path →
   slash-separated).

2. **Expose `historyId`** — store `raw.historyId` in `metadata` so the flakiness rule can access it
   via `record.metadata?.historyId`.

3. **Expose `statusDetails`** — store error message and trace in metadata for future failure-pattern
   rules.

---

## CLI Commands

### `spasco analyze`

Runs full analysis pipeline. Always exits 0. Writes findings to `.spasco/reports/index.html` and
updates `.spasco/intermediates.json`.

```
Analysis complete — 3 errors, 7 warnings, 2 info

  Violations (3 errors)
  ├─ client-component → server-action   apps/web/components/CheckoutForm.tsx
  ├─ client-component → server-action   apps/web/components/ProfileCard.tsx
  └─ bff-layer-boundary                 apps/web/components/DataGrid.tsx

  Coverage gaps (7 warnings)
  ├─ domain: auth       4 files uncovered / 11 total   (36%)
  ├─ domain: checkout   2 files uncovered / 8 total    (25%)
  └─ domain: payments   1 file uncovered / 5 total     (20%)

  Flakiness (2 info)
  └─ layer: e2e         2 tests flaky (>10% failure rate)
```

### `spasco check`

Same as `analyze` but exits 1 if any `error` severity findings exist. Designed for CI pipelines.

```bash
spasco check          # exits 0 (clean) or 1 (violations found)
spasco check --only violations    # only check violation-kind findings
spasco check --severity warning   # treat warnings as errors
```

---

## Report HTML

Adds a **Findings** tab to the existing dashboard with:

- Findings table filterable by kind, severity, and dimension value
- Coverage heatmap sliced by domain and layer (% covered per slice)
- Flakiness trend chart over history entries (per domain)

---

## What This Does NOT Change

- Skeleton file format
- `NormalizedRunRecord` shape (only adds fields to `metadata`)
- Scan plugin interface (`ScanPlugin`)
- Existing aggregator logic
- `spasco scan` behaviour
- `spasco annotate` commands
- History file format
- Inference engine
