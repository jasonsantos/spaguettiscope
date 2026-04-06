# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Project Overview

SpaguettiScope (`spasco`) is a **test quality dashboard and code topology analysis tool** for
monorepos. It does two main things:

1. **Dashboard** — reads CI test artifacts (Allure, Playwright, Vitest, LCov, ESLint, TypeScript)
   and generates an HTML report with pass-rates, coverage, and health slices by dimension (domain,
   layer, role).

2. **Analysis** — runs rule-based checks over the file topology (import graph + test records) and
   surfaces findings (coverage gaps, unused exports, circular deps, flaky tests, layer violations).

There is **no entropy score**. The tool does not calculate complexity metrics. It classifies files
into dimensions (role, layer, domain) via rules, then aggregates test/lint results by those
dimensions.

## Repository Structure

```
spaguettiscope/
├── packages/
│   ├── core/           # @spaguettiscope/core — classification, skeleton, graph, analysis engine
│   ├── cli/            # @spaguettiscope/cli — spasco CLI (dashboard, scan, annotate, analyze, check)
│   └── reports/        # @spaguettiscope/reports — connectors, aggregator, HTML renderer
├── plugins/
│   ├── nextjs/         # @spaguettiscope/plugin-nextjs (ScanPlugin + AnalysisPlugin)
│   ├── drizzle/        # @spaguettiscope/plugin-drizzle (ScanPlugin)
│   ├── electron/       # @spaguettiscope/plugin-electron (ScanPlugin)
│   ├── playwright/     # @spaguettiscope/plugin-playwright (ScanPlugin)
│   ├── prisma/         # @spaguettiscope/plugin-prisma (ScanPlugin)
│   ├── react/          # @spaguettiscope/plugin-react (ScanPlugin)
│   └── storybook/      # @spaguettiscope/plugin-storybook (ScanPlugin)
├── apps/
│   └── docs/           # Documentation website (Vite + React)
├── .spasco/            # Runtime directory (gitignored contents)
│   ├── skeleton.yaml   # Human-maintained file topology (checked in)
│   ├── history.jsonl   # Run history audit trail (checked in)
│   ├── intermediates.json  # Analysis cache (gitignored)
│   └── reports/        # Generated dashboard HTML (gitignored)
└── spasco.config.json  # Project config (also accepts spaguettiscope.config.json for compat)
```

## Development Commands

Run from repository root (Turborepo + pnpm workspaces):

```bash
pnpm build         # Build all packages (turbo build)
pnpm test          # Test all packages (turbo test)
pnpm lint          # Lint all packages (turbo lint)
pnpm dev           # Watch mode (turbo dev)
pnpm clean         # Clean all dist/ (turbo clean)
pnpm format        # Format code
```

Individual package commands:

```bash
cd packages/core && pnpm build
cd packages/cli && pnpm build
cd packages/reports && pnpm build          # builds both Node.js dist and Vite renderer
cd packages/reports && pnpm build:renderer # only rebuild the React dashboard HTML
cd plugins/nextjs && pnpm build
```

## CLI Commands

The executable is `spasco`. After `pnpm build`, use: `node packages/cli/dist/index.js <command>` or
install globally.

### `spasco scan`

Walks all project files, applies scan plugin rules and inference, and merges results into the
skeleton file (`.spasco/skeleton.yaml`). Newly discovered files get `?` for unknown dimensions.
Creates `.spasco/.gitignore` on first run.

```bash
spasco scan
```

### `spasco annotate list`

Lists all skeleton entries where a dimension value is unresolved (`?`).

```bash
spasco annotate list
```

### `spasco annotate resolve [values...]`

Interactively resolves `?` entries in the skeleton by assigning a dimension value.

```bash
spasco annotate resolve --as domain          # assign domain values
spasco annotate resolve --as layer --all     # resolve all at once
spasco annotate resolve auth checkout --as domain --add layer=client-component
```

### `spasco dashboard`

Reads configured connectors, aggregates test/lint records, and generates an HTML dashboard at
`.spasco/reports/index.html` (configurable via `dashboard.outputDir`). Also appends to
`.spasco/history.jsonl` and runs analysis rules to populate the Findings tab.

```bash
spasco dashboard
spasco dashboard --output ./my-reports    # custom output directory
spasco dashboard --ci                     # terminal summary only, no HTML
```

### `spasco init`

Auto-detects installed tools (vitest, lcov, playwright, allure, eslint, typescript) by scanning the
repository and writes a ready-to-use `spasco.config.json`. Refuses if a config already exists.

```bash
spasco init                                              # auto-detect, write config
spasco init --interactive                               # confirm each detected connector
spasco init --plugins @my/plugin,@other/plugin          # also run detectors from plugins
```

### `spasco analyze`

Runs all analysis rules (built-in + configured `analysisPlugins`) over the topology, import graph,
and test records. Always exits 0. Updates `.spasco/intermediates.json`.

```bash
spasco analyze
```

### `spasco check`

Same as `analyze` but exits 1 if findings of the configured severity exist. Designed for CI gates.

```bash
spasco check                        # fail on any error-severity finding
spasco check --severity warning     # fail on warning or error
spasco check --severity info        # fail on any finding
```

## Architecture

### `@spaguettiscope/core`

Functional modules (no classes):

| Module           | Key exports                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`         | `loadConfig(root)`, `SpascoConfigSchema`                                                                                                                        |
| `classification` | `InferenceEngine`, `defaultDefinitions`, `DimensionSet`                                                                                                         |
| `rules`          | `runRules(files, rules, root)`, `Rule`, `ScanPlugin`                                                                                                            |
| `skeleton`       | `readSkeleton`, `writeSkeleton`, `matchFile`, `mergeSkeleton`                                                                                                   |
| `graph`          | `buildImportGraph`, `mergeImportGraphs`, `ImportGraph`                                                                                                          |
| `workspace`      | `discoverWorkspaces(root)`                                                                                                                                      |
| `analysis`       | `runAnalysis`, `builtInAnalysisRules`, `loadIntermediateCache`, `saveIntermediateCache`, `createIntermediateCache`, `Finding`, `AnalysisRule`, `AnalysisPlugin` |
| `init`           | `builtInDetectors`, `InitDetector`, `DetectedConnector`                                                                                                         |

### `@spaguettiscope/reports`

| Module     | Key exports                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Connectors | `AllureConnector`, `PlaywrightConnector`, `VitestConnector`, `LcovConnector`, `EslintConnector`, `TypescriptConnector`     |
| Aggregator | `aggregateAll`, `aggregateByDimension`, `aggregateByConnector`                                                             |
| Renderer   | `buildDashboardHtml`, `writeDashboardData(dir, data, records, findings?)`, `getRendererAssetsDir`, `formatTerminalSummary` |
| History    | `appendHistory`, `readHistory`                                                                                             |
| Models     | `DashboardData`, `NormalizedRunRecord`, `AggregatedSlice`, `OverallSummary`                                                |

### Plugin System

There are two plugin interfaces:

**`ScanPlugin`** — classifies files into dimensions during `spasco scan`:

```typescript
interface ScanPlugin {
  id: string
  canApply(packageRoot: string): boolean // sync; reads package.json
  rules(): Rule[] // classification rules
}
```

Rules use glob + optional content-match selectors, and yield concrete or extracted dimension values.

**`AnalysisPlugin`** — detects violations in the import graph during `analyze`/`dashboard`:

```typescript
interface AnalysisPlugin {
  id: string
  canApply(packageRoot: string): boolean
  rules(): AnalysisRule[]
}

interface AnalysisRule<C extends 'files' | 'edges' | 'records'> {
  id: string
  severity: 'error' | 'warning' | 'info'
  needs: ('importGraph' | 'testRecords')[]
  corpus: C
  run(item: CorpusItem<C>, ctx: AnalysisContext): Finding[]
}
```

### Config Schema

Config file names searched in order: `spasco.config.json`, then `spaguettiscope.config.json`.

| Field                    | Default                      | Description                                      |
| ------------------------ | ---------------------------- | ------------------------------------------------ |
| `name`                   | —                            | Project display name                             |
| `skeleton`               | `.spasco/skeleton.yaml`      | Skeleton file path                               |
| `plugins`                | `[]`                         | Scan plugin module IDs                           |
| `analysisPlugins`        | `[]`                         | Analysis plugin module IDs                       |
| `rules.disable`          | `[]`                         | Rule IDs to disable (e.g. `inherit-from-import`) |
| `dimensions.overrides`   | —                            | Override built-in dimension patterns             |
| `dimensions.custom`      | —                            | Define additional dimensions                     |
| `inference`              | —                            | File-path inference rules                        |
| `dashboard.connectors`   | `[]`                         | Connector configs `[{ id, resultsDir, ... }]`    |
| `dashboard.outputDir`    | `.spasco/reports`            | Dashboard output directory                       |
| `dashboard.historyFile`  | `.spasco/history.jsonl`      | Run history path                                 |
| `analysis.intermediates` | `.spasco/intermediates.json` | Analysis cache path                              |

### Built-in Analysis Rules

All four ship in `@spaguettiscope/core` as `builtInAnalysisRules`:

| Rule ID                  | Corpus  | Severity | What it detects                                                  |
| ------------------------ | ------- | -------- | ---------------------------------------------------------------- |
| `built-in:coverage-gap`  | files   | warning  | Files with a meaningful role but no test directly importing them |
| `built-in:unused-export` | files   | info     | Files with no importers and not an entry point                   |
| `built-in:circular-dep`  | files   | warning  | Files in a circular import cycle                                 |
| `built-in:flaky-test`    | records | info     | Test records with a failure rate between 10–90% across runs      |

### NextJS Analysis Plugin

`@spaguettiscope/plugin-nextjs` exports a second entry point `./analysis` with
`nextjsAnalysisPlugin`:

| Rule ID                           | Corpus | Severity | What it detects                                   |
| --------------------------------- | ------ | -------- | ------------------------------------------------- |
| `nextjs:no-client-imports-server` | edges  | error    | Client component directly imports a server-action |
| `nextjs:no-cross-domain-page`     | edges  | warning  | Page imports a page from a different domain       |
| `nextjs:bff-layer-boundary`       | edges  | error    | Client component imports a BFF module             |

## Package Management

- **pnpm** workspaces — `packages/*`, `plugins/*`, `apps/*`
- Workspace deps use `workspace:*` protocol
- All packages are ES modules (`"type": "module"`)
- Node.js ≥ 22 required

## Documentation Rules

- **Keep docs in sync** — whenever you change CLI commands, config schema, plugin interfaces, or
  analysis rules, update `spaguettiscope/README.md` and this `CLAUDE.md` in the same commit.
- **No new doc files at root** — do not create `.md` files at the repository root
  (`/Users/jasonsantos/personal/spaguettiscope/`). If documentation is needed, add it inside
  `spaguettiscope/docs/` or update an existing file.

## Testing Strategy

- Tests live inside each package at `src/tests/**/*.test.ts`
- Pattern: `packages/foo/src/tests/<module>/thing.test.ts` mirrors
  `packages/foo/src/<module>/thing.ts`
- Framework: **vitest**
- Follow TDD: write the failing test first, then implement
- Do not mock the file system — use `tmp` directories created in `beforeEach` and removed in
  `afterEach`
- Coverage via `@vitest/coverage-v8` with `lcov` reporter (used by the LcovConnector)
