# Renderer Bugfixes Design

Fixes for 3 visual bugs in the dashboard renderer found during dogfooding.

## Bug 1 & 2: Dimension tables mix testing and coverage records

**Symptom:** Dimension tables (By role, By domain, By layer) show a "pass" column whose percentage
is actually a blend of test pass rate and coverage percentage. Clicking a row drills into a detail
view that only shows testing records, so the count doesn't match.

**Root cause:** `summary.dimensions` in `DashboardData` is built from `aggregateAll(records)` which
combines all connector categories (testing + coverage + lint). The drill-in view filters to testing
records only via `deriveSuites()`.

**Fix:** In `Observatory.tsx`, filter the dimension slices to testing-category records before
rendering the tables. The `byConnector` data already separates by connector, and per-package cards
show coverage independently. Dimension tables should reflect test pass rates only, matching what the
drill-in shows.

Implementation: the `DashboardData` already includes `byConnector` which has the category. The
renderer's `derive.ts` should compute test-only dimension aggregations. Alternatively, Observatory
can filter `allRecords` to testing-only before aggregating dimensions client-side.

**Acceptance criteria:**

- Dimension table counts match what the drill-in view shows
- The "pass" column shows actual test pass rate, not blended coverage
- Coverage data remains visible in per-package cards and the Coverage metric card

## Bug 3: Sparkline charts invisible

**Symptom:** The Trends sidebar sparklines (test count, coverage, entropy) render as blank space.

**Root cause:** Recharts `<AreaChart>` components in `Observatory.tsx` (lines 320-387) are missing
`<XAxis>` and `<YAxis>` components. Without axes, Recharts cannot compute the coordinate space and
renders nothing.

**Fix:** Add hidden axis components to each sparkline:

```tsx
<XAxis dataKey="index" hide />
<YAxis hide domain={[0, 'auto']} />
```

**Acceptance criteria:**

- All three sparklines render visible area charts when history data exists
- Axes are hidden (sparkline style, no labels or ticks)
