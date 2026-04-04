# Phase 2 Fixes Design

## Problem Statement

After real-world testing against two production monorepos (pharmacy-online, qualitiss-workspace),
four core gaps were identified in the Phase 2 implementation:

1. **History is never read back** — `readHistory()` exists but `DashboardData.history` is hardcoded
   as `[]`
2. **Raw records are discarded** — after aggregation, individual test records are not persisted; no
   drill-down is possible
3. **Inference engine barely works** — `defaultDefinitions` assume a hardcoded Next.js / specific
   monorepo structure; `domain` and `package` are `unknown` for any real project
4. **Filters are hardcoded** — the renderer has no generic mechanism to filter/group by whatever
   dimensions are present in the data

---

## Design Principles

**Use what we are sure of. Observe the rest without naming it.**

- Inference must be grounded in structural certainty or framework-prescribed conventions — not path
  pattern guessing
- Things we don't understand go into `unknown` with their raw path address, surfaced to the user for
  configuration
- Config is additive: the user teaches the engine what it couldn't know — they don't correct wrong
  guesses
- Filters and grouping derive automatically from whatever dimensions are present in the data —
  nothing is hardcoded in the renderer

---

## Fix 1: History Read-Back

### What

`runDashboard()` currently writes to the history file via `appendHistory()` but never reads it back.
`DashboardData.history` is hardcoded to `[]`.

### Solution

Call `readHistory(resolve(projectRoot, config.dashboard.historyFile))` after appending, pass the
result into `DashboardData.history`. The `readHistory()` function already exists in
`packages/reports/src/model/history.ts` and reads NDJSON correctly.

### Change scope

- `packages/cli/src/commands/dashboard.ts`: one additional call, one field populated

---

## Fix 2: Data Directory Split

### What

All dashboard data is currently embedded in `index.html` via `JSON.stringify(data)`. Raw records are
discarded after aggregation; no drill-down is possible. Large projects would produce very large HTML
files.

### Solution

Adopt a split output structure inspired by Allure's approach:

```
<outputDir>/
  index.html          # shell only — no embedded data
  assets/             # JS bundle (already copied)
  data/
    summary.json      # small: generatedAt, projectName, connectors, overall, dimensions, history, byConnector
    records.json      # full NormalizedRunRecord[] — fetched lazily on drill-down
```

**`summary.json`** is written on every run and contains everything needed for the top-level
dashboard view. It replaces the `window.__SPASCO_DATA__` injection.

**`records.json`** contains all `NormalizedRunRecord[]` collected from connectors. Written
separately. The renderer fetches it lazily only when the user drills into a dimension.

**`index.html`** becomes a static shell with no embedded data. The JS bundle fetches
`data/summary.json` on load.

### Change scope

- `packages/reports/src/model/dashboard.ts`: new `SummaryData` type (subset of `DashboardData`, no
  raw records); update `DashboardData` to include `records: NormalizedRunRecord[]`
- `packages/reports/src/renderer/inject.ts`: `buildDashboardHtml()` writes static shell only; new
  `writeDashboardData(outputDir, summary, records)` writes the two JSON files
- `packages/cli/src/commands/dashboard.ts`: call `writeDashboardData()` instead of embedding in HTML
- `packages/reports/src/renderer/html/src/`: renderer fetches `data/summary.json` on mount; fetches
  `data/records.json` on drill-down

---

## Fix 3: Inference Engine Overhaul

### Core principle

Inference operates in confidence tiers. Higher tiers always win over lower tiers. Config always wins
over inference.

```
Config overrides  (highest)
  ↓
Tier 2: Framework-prescribed
  ↓
Tier 1: Structural facts
  ↓
Tier 3: Observed, unnamed  (lowest — never assumed semantic)
```

### Tier 1 — Structural facts (universal, always applied)

**`package` dimension**

Walk up from `NormalizedRunRecord.source.file` (the absolute path to the test file), find the
nearest `package.json`. Read its `name` field. That is the package.

- Works for any JS/TS monorepo regardless of directory layout
- If no `package.json` found above the file, `package` = `unknown`
- Result is cached per `package.json` path to avoid repeated reads

**`role` dimension**

File naming conventions — already partially implemented, made more robust:

| Pattern                                              | Role     |
| ---------------------------------------------------- | -------- |
| `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx` | `test`   |
| `*.e2e.ts`, `*.e2e.tsx`, `e2e/**`                    | `e2e`    |
| `__tests__/**`                                       | `test`   |
| `__mocks__/**`                                       | `mock`   |
| Everything else                                      | `source` |

These patterns are universal across the JS/TS ecosystem.

### Tier 2 — Framework-prescribed (when framework is detected)

**Next.js App Router → `domain` dimension**

Detection:

- `next.config.js` or `next.config.mjs` exists in the app's root
- AND `app/` directory exists alongside it

When detected, extract the top-level route segment from the file path under `app/`:

```
app/checkout/payment/page.tsx  →  domain: "checkout"
app/member/orders/page.tsx     →  domain: "member"
app/api/webhook/route.ts       →  domain: "api"
```

Transformation rules:

- **Route groups** `(group)/` — strip the segment, take the next real segment
- **Dynamic params** `[slug]`, `[id]` — take the parent segment as domain
- **Next.js reserved files** (`page`, `layout`, `loading`, `error`, `template`, `route`,
  `not-found`) — ignored in segment extraction
- If file lives outside `app/` in a Next.js project, `domain` = `unknown`

This inference is not guessing — it reads structure the framework mandated.

### Tier 3 — Observed, unnamed

Everything that Tiers 1 and 2 don't classify stays as `unknown`. These path addresses are preserved
in `NormalizedRunRecord` but not given semantic meaning.

The dashboard surfaces unclassified records to the user: _"N tests have unknown domain. Add domain
rules to your config to classify them."_

Config rules (in `spaguettiscope.config.json`) let users define patterns for Tier 3 items:

```json
{
  "inference": {
    "domain": [
      { "glob": "src/field-behaviors/**", "value": "field-behaviors" },
      { "glob": "src/guias/**", "value": "guias" }
    ],
    "layer": [
      { "glob": "**/*.unit.test.ts", "value": "unit" },
      { "glob": "**/*.integration.test.ts", "value": "integration" }
    ]
  }
}
```

These are additive rules — the user teaches the engine what it couldn't know.

### InferenceEngine changes

Replace `defaultDefinitions` with a class that:

1. Detects framework context once per project root (cached)
2. Walks up to find `package.json` (cached per directory)
3. Applies filename patterns for `role`
4. Applies Next.js route segment extraction when App Router detected
5. Applies user config rules last (highest priority after explicit config)

---

## Fix 4: Dynamic Filters in the Renderer

### What

The current renderer has hardcoded filter/grouping UI for specific dimension names. Any dimension
the inference engine produces that isn't hardcoded is silently ignored.

### Solution

The renderer derives available filters entirely from `records.json` at runtime:

1. On load of `records.json`, scan all records and collect every `dimensions` key
2. For each key, collect the set of distinct values
3. If a key has **2 or more distinct values**, render a filter control for it
4. Filter controls are generic — label is the dimension key, options are the distinct values
5. Filtering is client-side (records already in memory)
6. Grouping (aggregate view by dimension) uses the same key list

No hardcoded dimension names in the renderer. A project with no `domain` inference gets no domain
filter. A project with 6 packages gets a package filter with 6 options. A project where the user
configured a `layer` dimension gets a layer filter automatically.

### Filter UI behaviour

- Multiple filters can be active simultaneously (AND logic)
- Active filters are shown as dismissible chips
- Aggregate views (pass rate by package, pass rate by domain) are generated for any dimension
  present — not just pre-known ones
- Dimension key names are displayed as-is (or title-cased if no label config provided)

---

## What This Does NOT Change

- Connector read logic (`AllureConnector`, `PlaywrightConnector`, etc.) — connectors produce
  `NormalizedRunRecord[]` as before
- `NormalizedRunRecord` shape — `dimensions: Record<string, string>` already supports arbitrary keys
- Aggregator logic — `aggregateAll()` and `aggregateByConnector()` are unchanged
- Terminal summary output — unchanged
- CI mode — unchanged (no HTML output in CI, this only affects dashboard output)

---

## Files Affected

| File                                                   | Change                                                                                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/classification/inference.ts`        | Extend `InferenceEngine` with `package.json` walking, Next.js App Router detection                                                                        |
| `packages/core/src/classification/built-in/package.ts` | Replace hardcoded globs with `package.json` filesystem scanning                                                                                           |
| `packages/core/src/classification/built-in/domain.ts`  | Make App Router inference conditional on framework detection; remove `features/modules/domains` guessing                                                  |
| `packages/core/src/config/schema.ts`                   | Add `inference` rules to config schema (user-defined glob→value mappings per dimension)                                                                   |
| `packages/reports/src/model/dashboard.ts`              | Add `SummaryData` type (no raw records); `DashboardData` includes `records: NormalizedRunRecord[]`                                                        |
| `packages/reports/src/renderer/inject.ts`              | `buildDashboardHtml()` writes static shell only; new `writeDashboardData(outputDir, summary, records)` writes `data/summary.json` and `data/records.json` |
| `packages/cli/src/commands/dashboard.ts`               | Call `readHistory()`; call `writeDashboardData()`; pass `records` array                                                                                   |
| `packages/reports/src/renderer/html/src/App.tsx`       | Fetch `data/summary.json` on mount instead of reading `window.__SPASCO_DATA__`                                                                            |
| `packages/reports/src/renderer/html/src/views/*.tsx`   | Fetch `data/records.json` lazily on drill-down; derive filters dynamically from dimension keys in records                                                 |
