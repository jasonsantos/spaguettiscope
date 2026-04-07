# Entropy Score Revival & AI-Friendly CLI Messaging Design

## Goal

Two complementary improvements to SpaguettiScope:

1. **Entropy score** — bring back the v1 entropy concept, adapted to v2's data model. A 0-10
   composite score computed from 5 subscores using data the tool already collects. Shown as a
   distinct yellow (spaghetti-colored) metric in the dashboard alongside pass rate, coverage, and
   findings.

2. **AI-friendly CLI messaging** — rewrite all command output so that each command's completion
   message teaches the operator (human or AI) what just happened, where they are in the pipeline,
   and what to do next. Rich `--help` descriptions that orient an AI to each command's purpose and
   options.

These are unified because the entropy feature produces new output that needs the same messaging
treatment, and the messaging work touches every command.

## 1. Entropy Engine

### Location

New module: `packages/core/src/entropy/`

### Input

All data already available at analysis time:

- Test records (`NormalizedRunRecord[]`) — pass rates, flakiness
- Import graph (`ImportGraph`) — edges, cycles, fan-out, type-only edges
- Findings (`Finding[]`) — violations by severity
- Skeleton (`SkeletonFile`) — classification completeness
- Coverage records — LCov pass rates

### Subscores

5 subscores, each normalized to 0-10 (0 = pristine, 10 = maximum entropy):

| Subscore       | Weight | Inputs                                                | Formula                                                                                          |
| -------------- | ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Stability      | 25%    | Test pass rate, flakiness ratio                       | `10 × (1 - passRate)` + penalty for flaky tests (tests with 10-90% failure rate)                 |
| Boundaries     | 25%    | Circular deps, graph density, fan-out, unused exports | Circular dep file ratio + normalized graph density + fan-out outlier ratio + unused export ratio |
| Coverage       | 20%    | LCov coverage rate, coverage-gap findings             | `10 × (1 - lcovCoverage)` + coverage-gap finding ratio                                           |
| Violations     | 15%    | Findings by severity                                  | Weighted finding count (error=3, warning=1, info=0.5) / file count, capped at 10                 |
| Classification | 15%    | Skeleton resolved vs pending entries                  | `10 × (1 - resolvedRatio)` where resolved = files with all dimensions filled, not draft          |

### Weight Redistribution

When a subscore has no data for a given package (e.g., no test records → Stability unavailable), its
weight is redistributed proportionally among the remaining subscores.

### Thresholds

Same as v1:

| Classification | Score range |
| -------------- | ----------- |
| Excellent      | < 3.0       |
| Good           | < 5.0       |
| Moderate       | < 7.0       |
| Poor           | < 9.0       |
| Critical       | >= 9.0      |

### Output Shape

```typescript
interface EntropySubscore {
  score: number // 0-10
  available: boolean // false if no data for this subscore
}

interface EntropyResult {
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
```

### Granularity

Computed at two levels:

- **Overall** — across all files and records in the project
- **Per-package** — scoped to each workspace package's files, records, and graph edges

The overall score is the weighted average of per-package scores (weighted by file count), not a
separate calculation. This ensures the overall and per-package numbers are consistent.

## 2. Dashboard Integration

### New Entropy Card

The Observatory top row grows from 4 to 5 cards:

```
| Pass Rate | Coverage | Entropy | Findings | Packages |
```

The Entropy card:

- **Accent color**: Yellow/gold — the color of spaghetti. This is the entropy brand color, used for
  the score number, health chip accent, sparkline stroke, and badges. New design token `--c-entropy`
  in the oklch color space.
- **Card background and surface styling**: Left to implementer's design judgment. The yellow is the
  accent, not necessarily the card background.
- **Content**: Overall score (e.g., "4.2"), classification as health chip (e.g., "Good"), subtitle
  showing subscore count.
- **Health function**: `entropyHealth(score)` maps classification to the appropriate chip and
  accent.

### Package Health Map

Each package tile gains a small entropy badge showing the per-package score, colored by
classification. When drilling into a package, the detail view shows the 5 subscores as a breakdown.

### Trends Sidebar

New sparkline "Entropy" below Test count and Coverage. Uses the entropy yellow/gold color. Data
comes from `entropyScore` stored in history entries.

### Observatory Dimension Panels

The "BY ROLE", "BY DOMAIN", "BY LAYER" rows gain an entropy column showing per-slice entropy. A
slice's entropy is computed by filtering to the files matching that dimension value and running the
same subscore logic. Slices with fewer than 5 files show "—" instead of a score.

## 3. Data Pipeline

### Computation Point

Entropy is computed in two commands:

- **`spasco analyze`** — after findings are generated, compute entropy from the same context. Store
  result in `intermediates.json` alongside findings.
- **`spasco dashboard`** — same computation, result flows into `DashboardData` and `history.jsonl`.

### Storage

**`DashboardData`** gains:

```typescript
entropy?: {
  overall: EntropyResult
  byPackage: Record<string, EntropyResult>
}
```

**`history.jsonl`** entries gain:

```typescript
entropyScore?: number                           // overall 0-10
entropyByPackage?: Record<string, number>        // per-package 0-10
```

### Dashboard Data Flow

1. `dashboard.ts` runs connectors → gets records
2. Runs analysis → gets findings
3. Computes entropy from records + graph + findings + skeleton
4. Passes entropy to `writeDashboardData()` as new field
5. Renderer reads `summary.json` which now includes `entropy`

### CI Gate

`spasco check` gains a new flag:

```
--max-entropy <threshold>   Exit 1 if overall entropy exceeds this value (0-10)
```

This is independent of `--severity`. Both can be used together. No new config fields — the threshold
is a CLI flag only.

## 4. AI-Friendly CLI Messaging

### Principle

Every command's output should read as a natural conversation that:

- Summarizes what just happened (with key numbers)
- Shows where you are in the pipeline (always, even when skipping steps)
- Adapts to current project state
- Suggests the exact next command with flags
- Poses a guiding question when a decision is needed

Messages are written as human-readable prose, but mindful that an AI will likely be the reader. No
structured hint blocks — the prose itself is precise enough to act on.

### Rich `--help` Descriptions

Every command and option gets a full description explaining:

- What it does
- When to use it
- What inputs it reads and what outputs it produces
- Where it sits in the typical workflow

**Program description** changes from:

```
SpaguettiScope — Look at your spaghetti.
```

To:

```
SpaguettiScope — Classify files, track test health, and measure entropy across your monorepo.
```

**Command descriptions** change from terse labels to orientation paragraphs. Example for `scan`:

```
Scan all project files, apply classification rules (built-in + plugins), and merge results into
the skeleton file. Discovers workspace packages, infers domains from package names, proposes
layer assignments from directory structure, and analyzes import directions to draft a layer
policy. New files get proposed dimension values (key?) that you confirm with `annotate resolve`.
```

Each option also gets a descriptive help string explaining its effect and when to use it.

### Post-Command Guidance

Each command emits a context-aware guidance block after its summary. The block always includes:

1. **What happened** — one sentence with key metrics
2. **Pipeline map** — shows `init → scan → annotate resolve → dashboard/analyze` with current
   position marked and skippable steps explained
3. **Next step** — the recommended command(s) to run, with flags, adapted to current state
4. **Question** — when the operator needs to make a decision, pose it explicitly

**Context-aware behavior examples:**

- `scan` with pending entries → suggests `annotate list` then `annotate resolve`
- `scan` with nothing pending → explains annotations aren't needed, suggests `analyze`/`dashboard`
- `annotate resolve` with remaining entries → suggests resolving the next dimension
- `annotate resolve` with everything resolved → suggests `analyze`/`dashboard`
- `analyze` with 0 findings → suggests `dashboard`, notes the clean state
- `analyze` with findings → lists top findings, suggests investigating or running `dashboard`
- `dashboard` → notes the output path, mentions `check` for CI gating
- `init` → explains what was detected, suggests `scan` as next step

### Commands Updated

All 7 commands get the treatment:

| Command            | Help rewrite | Post-command guidance                                          |
| ------------------ | ------------ | -------------------------------------------------------------- |
| `init`             | Yes          | Detected connectors summary → suggests `scan`                  |
| `scan`             | Yes          | File/entry/policy counts → suggests `annotate` or `analyze`    |
| `annotate list`    | Yes          | Pending entry summary → suggests `annotate resolve` with flags |
| `annotate resolve` | Yes          | Resolution count → suggests next dimension or `analyze`        |
| `analyze`          | Yes          | Finding + entropy summary → suggests `dashboard` or `check`    |
| `dashboard`        | Yes          | Output path + entropy score → suggests `check` for CI          |
| `check`            | Yes          | Pass/fail result → suggests fixes if failed                    |

## 5. Banner & Identity

**Tagline** changes from:

```
Framework-agnostic code entropy analyzer
Cool but serious. Built for developers.
```

To:

```
Code topology & entropy analysis for monorepos
```

Single line, accurate. The banner ASCII art stays as-is.

## Summary of File Changes

| File                                                           | Change                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/core/src/entropy/index.ts`                           | New: entropy engine — `computeEntropy()` function             |
| `packages/core/src/entropy/subscores.ts`                       | New: individual subscore computation functions                |
| `packages/core/src/index.ts`                                   | Export entropy module                                         |
| `packages/reports/src/model/dashboard.ts`                      | Add `entropy` field to `DashboardData`                        |
| `packages/reports/src/model/history.ts`                        | Add `entropyScore`, `entropyByPackage` to history entry       |
| `packages/reports/src/renderer/html/index.html`                | Add `--c-entropy` design token                                |
| `packages/reports/src/renderer/html/src/shared.tsx`            | Add `entropyHealth()` function                                |
| `packages/reports/src/renderer/html/src/views/Observatory.tsx` | Add Entropy card, trend sparkline, dimension column           |
| `packages/reports/src/renderer/html/src/derive.ts`             | Derive per-package entropy for tiles                          |
| `packages/reports/src/renderer/html/src/App.tsx`               | Thread entropy data through                                   |
| `packages/cli/src/commands/dashboard.ts`                       | Compute entropy, pass to renderer, store in history           |
| `packages/cli/src/commands/analyze.ts`                         | Compute entropy, include in output                            |
| `packages/cli/src/commands/scan.ts`                            | Add post-command guidance                                     |
| `packages/cli/src/commands/init.ts`                            | Add post-command guidance, rewrite help                       |
| `packages/cli/src/commands/annotate.ts`                        | Add post-command guidance, rewrite help                       |
| `packages/cli/src/commands/check.ts` (in index.ts)             | Add `--max-entropy` flag, add guidance                        |
| `packages/cli/src/index.ts`                                    | Update program description, rewrite command help descriptions |
| `packages/cli/src/formatter/index.ts`                          | Update banner tagline                                         |
| `packages/cli/src/formatter/guidance.ts`                       | New: context-aware guidance message builder                   |
| Test files                                                     | New tests for entropy engine, guidance messages               |
