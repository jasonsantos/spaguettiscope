# Renderer Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 visual bugs in the dashboard renderer: dimension tables showing blended data with
wrong labels, missing coverage in drill-in view, and invisible sparkline charts.

**Architecture:** Three changes: (1) derive testing-only and coverage dimension slices from
`byConnector` in `derive.ts`, use them in Observatory dimension panels with proper columns; (2) pass
coverage data to DimensionView and display it; (3) add hidden Recharts axes to sparklines.

**Tech Stack:** TypeScript, React, Recharts

---

## File Structure

| File                                                             | Action | Responsibility                                                       |
| ---------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `packages/reports/src/renderer/html/src/derive.ts`               | Modify | Add `deriveTestingDimensions` and `deriveCoverageDimensions` helpers |
| `packages/reports/src/renderer/html/src/views/Observatory.tsx`   | Modify | Use testing-only dimensions, add coverage column, fix sparklines     |
| `packages/reports/src/renderer/html/src/views/DimensionView.tsx` | Modify | Accept and display coverage for the dimension subset                 |
| `packages/reports/src/renderer/html/src/App.tsx`                 | Modify | Pass coverage dimension data to DimensionView                        |

---

### Task 1: Add testing-only and coverage dimension derivation helpers

**Files:**

- Modify: `packages/reports/src/renderer/html/src/derive.ts`

- [ ] **Step 1: Add `deriveTestingDimensions` function**

Add after the existing `deriveTestingOverall` function (line 173):

```typescript
/**
 * Aggregate dimension slices from testing-category connectors only.
 * Returns the same shape as summary.dimensions but excludes lcov/eslint/typescript records.
 */
export function deriveTestingDimensions(summary: RawSummary): Record<string, RawSlice[]> {
  const acc = new Map<
    string,
    Map<
      string,
      {
        passed: number
        failed: number
        skipped: number
        broken: number
        unknown: number
        total: number
      }
    >
  >()

  for (const conn of Object.values(summary.byConnector)) {
    if (conn.category !== 'testing') continue
    for (const [dim, slices] of Object.entries(conn.dimensions)) {
      if (!acc.has(dim)) acc.set(dim, new Map())
      const dimMap = acc.get(dim)!
      for (const s of slices) {
        const prev = dimMap.get(s.value) ?? {
          passed: 0,
          failed: 0,
          skipped: 0,
          broken: 0,
          unknown: 0,
          total: 0,
        }
        dimMap.set(s.value, {
          passed: prev.passed + s.passed,
          failed: prev.failed + s.failed,
          skipped: prev.skipped + s.skipped,
          broken: prev.broken + s.broken,
          unknown: prev.unknown + s.unknown,
          total: prev.total + s.total,
        })
      }
    }
  }

  const result: Record<string, RawSlice[]> = {}
  for (const [dim, valMap] of acc.entries()) {
    result[dim] = Array.from(valMap.entries()).map(([value, counts]) => ({
      dimension: dim,
      value,
      ...counts,
      passRate: counts.total > 0 ? counts.passed / counts.total : 1,
    }))
  }
  return result
}

/**
 * Extract coverage (lcov) dimension slices. Returns passRate per dimension value.
 * Used to show coverage percentage alongside test counts in dimension panels.
 */
export function deriveCoverageDimensions(summary: RawSummary): Record<string, Map<string, number>> {
  const lcov = summary.byConnector['lcov']
  if (!lcov) return {}

  const result: Record<string, Map<string, number>> = {}
  for (const [dim, slices] of Object.entries(lcov.dimensions)) {
    result[dim] = new Map(slices.map(s => [s.value, s.passRate]))
  }
  return result
}
```

- [ ] **Step 2: Verify build**

Run: `cd packages/reports && pnpm build:renderer 2>&1 | tail -5`

Expected: Build succeeds (new functions are not yet imported anywhere, but TypeScript should still
compile the file).

---

### Task 2: Fix dimension panels in Observatory

**Files:**

- Modify: `packages/reports/src/renderer/html/src/views/Observatory.tsx:2-3,9-10,226,245-523`

- [ ] **Step 1: Update imports**

In `packages/reports/src/renderer/html/src/views/Observatory.tsx`, replace line 3:

```typescript
import { Area, AreaChart, Tooltip, ResponsiveContainer } from 'recharts'
```

With:

```typescript
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
```

Replace lines 9-10:

```typescript
import type { PackageInfo, FindingsCount, RawSummary } from '../derive.ts'
import { deriveTestingOverall } from '../derive.ts'
```

With:

```typescript
import type { PackageInfo, FindingsCount, RawSummary } from '../derive.ts'
import {
  deriveTestingOverall,
  deriveTestingDimensions,
  deriveCoverageDimensions,
} from '../derive.ts'
```

- [ ] **Step 2: Derive testing-only and coverage dimensions**

In the `Observatory` function body, after line 238
(`const testingOverall = deriveTestingOverall(summary);`), add:

```typescript
const testingDimensions = deriveTestingDimensions(summary)
const coverageDimensions = deriveCoverageDimensions(summary)
```

Then replace line 245:

```typescript
const dimEntries = Object.entries(dimensions).filter(([k]) => !HIDDEN_FROM_DIM_PANELS.has(k))
```

With:

```typescript
const dimEntries = Object.entries(testingDimensions).filter(([k]) => !HIDDEN_FROM_DIM_PANELS.has(k))
```

- [ ] **Step 3: Update dimension table column headers**

Replace the column headers block (lines 454-463):

```typescript
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '10px 1fr 52px 52px 16px',
                gap: 8, alignItems: 'center', marginBottom: 4, paddingRight: 2,
              }}>
                <span />
                <span style={{ fontSize: 11, color: C.muted }}>value</span>
                <span style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>tests</span>
                <span style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>pass</span>
                <span />
              </div>
```

With:

```typescript
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '10px 1fr 60px 52px 16px',
                gap: 8, alignItems: 'center', marginBottom: 4, paddingRight: 2,
              }}>
                <span />
                <span style={{ fontSize: 11, color: C.muted }}>value</span>
                <span style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>pass</span>
                <span style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>cov</span>
                <span />
              </div>
```

- [ ] **Step 4: Update dimension table row rendering**

In the row rendering section, replace the `<button>` grid template and its content cells. The row
currently uses `gridTemplateColumns: '10px 1fr 52px 52px 16px'` — update this and the data cells.

Replace the entire `{slices.map(s => {` block (lines 466-522) with:

```typescript
              {slices.map(s => {
                const { accent: dotColor } = passRateHealth(s.passRate);
                const rowKey = `${dim}:${s.value}`;
                const isActive = hoveredRow === rowKey;
                const covMap = coverageDimensions[dim];
                const covRate = covMap?.get(s.value);
                return (
                  <button
                    key={s.value}
                    onClick={() => onSelectDimension(dim, s.value)}
                    aria-label={`${dim}: ${s.value} — ${s.passed}/${s.total} tests passing${covRate !== undefined ? `, ${fmt(covRate)} coverage` : ''}. Click to view.`}
                    onMouseEnter={() => setHoveredRow(rowKey)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onFocus={() => setHoveredRow(rowKey)}
                    onBlur={() => setHoveredRow(null)}
                    style={{
                      display: 'grid', gridTemplateColumns: '10px 1fr 60px 52px 16px',
                      gap: 8, alignItems: 'center', width: '100%',
                      background: isActive ? C.surfaceHigh : 'none',
                      border: 'none',
                      outline: isActive ? `2px solid ${alpha(C.accent, 27)}` : 'none',
                      padding: '6px 4px 6px 0', borderRadius: 6,
                      cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                    }}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      display: 'inline-block', justifySelf: 'center',
                      background: dotColor,
                      boxShadow: `0 0 6px ${alpha(dotColor, 40)}`,
                    }} />

                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{
                        fontSize: 13, color: C.text, fontWeight: 600,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{s.value}</span>
                      <span style={{ height: 4, borderRadius: 2, overflow: 'hidden', background: C.border, display: 'block' }}>
                        <span style={{
                          display: 'block', height: '100%',
                          width: `${s.passRate * 100}%`, background: dotColor,
                          borderRadius: 2, transition: 'width 0.3s ease',
                        }} />
                      </span>
                    </span>

                    <span style={{
                      fontSize: 12, fontWeight: 700, textAlign: 'right',
                      color: dotColor, fontVariantNumeric: 'tabular-nums',
                    }}>{s.passed}/{s.total}</span>

                    <span style={{
                      fontSize: 12, textAlign: 'right',
                      color: covRate !== undefined ? C.coverage : C.dim,
                      fontVariantNumeric: 'tabular-nums',
                    }}>{covRate !== undefined ? fmt(covRate) : '—'}</span>

                    <span style={{ color: C.dim, fontSize: 11, textAlign: 'right' }}>›</span>
                  </button>
                );
              })}
```

- [ ] **Step 5: Build renderer**

Run: `cd packages/reports && pnpm build:renderer 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/reports/src/renderer/html/src/derive.ts packages/reports/src/renderer/html/src/views/Observatory.tsx
git commit -m "fix(reports): Show testing-only pass rates and coverage in dimension panels"
```

---

### Task 3: Fix sparkline charts

**Files:**

- Modify: `packages/reports/src/renderer/html/src/views/Observatory.tsx:320-386`

- [ ] **Step 1: Add hidden axes to all three sparkline AreaCharts**

In each of the three `<AreaChart>` blocks (test count, coverage, entropy), add `<XAxis>` and
`<YAxis>` components right after the `<defs>` block and before the `<Area>` element.

For the **test count sparkline** (around line 323), inside `<AreaChart data={trend}>`, after the
closing `</defs>` tag, add:

```tsx
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={[0, 'auto']} />
```

For the **coverage sparkline** (around line 345), inside `<AreaChart data={trend}>`, after the
closing `</defs>` tag, add:

```tsx
                      <XAxis dataKey="i" hide />
                      <YAxis hide domain={[0, 'auto']} />
```

For the **entropy sparkline** (around line 369), inside `<AreaChart data={trend}>`, after the
closing `</defs>` tag, add:

```tsx
                      <XAxis dataKey="i" hide />
                      <YAxis hide domain={[0, 'auto']} />
```

- [ ] **Step 2: Build renderer**

Run: `cd packages/reports && pnpm build:renderer 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/reports/src/renderer/html/src/views/Observatory.tsx
git commit -m "fix(reports): Add hidden axes to sparkline charts so they render"
```

---

### Task 4: Show coverage in DimensionView drill-in

**Files:**

- Modify: `packages/reports/src/renderer/html/src/views/DimensionView.tsx:7-12,27-93`
- Modify: `packages/reports/src/renderer/html/src/App.tsx:8-10,330-332`

- [ ] **Step 1: Update DimensionView to accept and display coverage**

In `packages/reports/src/renderer/html/src/views/DimensionView.tsx`, update the imports at line 3:

```typescript
import { C, fmt, passRateHealth, coverageHealth, alpha } from '../shared.tsx'
```

Update the props interface (lines 7-11):

```typescript
interface DimensionViewProps {
  dim: string
  val: string
  allSuites: SuiteInfo[]
  coverage?: number
}
```

Update the function signature (line 13):

```typescript
export function DimensionView({ dim, val, allSuites, coverage }: DimensionViewProps) {
```

After the existing stats pills (after line 91, before the closing `</div>` of the stats pills
container), add a coverage pill:

```typescript
          {coverage !== undefined && (
            <span style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 6,
              background: C.surfaceHigh, color: coverageHealth(coverage).text,
              border: `1px solid ${C.border}`, fontWeight: 600,
            }}>
              {fmt(coverage)} coverage
            </span>
          )}
```

- [ ] **Step 2: Update App.tsx to pass coverage to DimensionView**

In `packages/reports/src/renderer/html/src/App.tsx`, update the derive imports (line 4):

```typescript
import {
  derivePackages,
  deriveSuites,
  deriveTestingOverall,
  deriveCoverageDimensions,
} from './derive.ts'
```

In the App component, after the `suites` useMemo (around line 111), add:

```typescript
const coverageDims = useMemo(() => (summary ? deriveCoverageDimensions(summary) : {}), [summary])
```

Update the DimensionView rendering (around line 331):

```typescript
        {drill?.type === 'dimension' && (
          <DimensionView
            dim={drill.dim}
            val={drill.val}
            allSuites={suites}
            coverage={coverageDims[drill.dim]?.get(drill.val)}
          />
        )}
```

- [ ] **Step 3: Build renderer**

Run: `cd packages/reports && pnpm build:renderer 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/reports/src/renderer/html/src/views/DimensionView.tsx packages/reports/src/renderer/html/src/App.tsx
git commit -m "fix(reports): Show coverage percentage in dimension drill-in view"
```

---

### Task 5: Rebuild, regenerate, and verify

- [ ] **Step 1: Full build**

Run: `pnpm build`

Expected: All packages build successfully.

- [ ] **Step 2: Regenerate dashboard**

Run: `node packages/cli/dist/index.js dashboard`

Expected: Dashboard regenerated with updated renderer.

- [ ] **Step 3: Copy to serving directory and verify in browser**

```bash
rm -rf /tmp/spasco-dashboard && cp -r .spasco/reports /tmp/spasco-dashboard
```

Then open `http://localhost:4042/index.html` in the browser and verify:

- Dimension panels show "pass" column with "passed/total" format (e.g. "5/5")
- Dimension panels show "cov" column with coverage percentage
- Clicking a dimension value shows coverage in the drill-in hero stats
- All three sparkline charts (test count, coverage, entropy) render visible area charts

---

## Self-Review

**Spec coverage:**

| Spec requirement                                       | Task                              |
| ------------------------------------------------------ | --------------------------------- |
| Dimension table counts match drill-in                  | Task 2 (testing-only dimensions)  |
| "pass" column shows test pass rate as passed/total     | Task 2 (Step 4)                   |
| Coverage visible in dimension panels with proper label | Task 2 (Step 3-4, "cov" column)   |
| Coverage visible in drill-in view                      | Task 4                            |
| Sparklines render visible area charts                  | Task 3                            |
| Axes hidden (sparkline style)                          | Task 3 (hide prop on XAxis/YAxis) |

**Placeholder scan:** No TBD/TODO/placeholders found.

**Type consistency:** `deriveTestingDimensions` returns `Record<string, RawSlice[]>` — same shape as
`summary.dimensions`, so Observatory can use it as a drop-in replacement. `deriveCoverageDimensions`
returns `Record<string, Map<string, number>>` — used in both Observatory and App→DimensionView.
