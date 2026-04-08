# SpaguettiScope

> Code topology & entropy analysis for monorepos

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-blue)](https://pnpm.io/)

SpaguettiScope helps development teams understand their codebase by classifying every file into a
topology (layer, role, domain) using a skeleton YAML, then surfacing insights through a live HTML
dashboard. It shows test pass rates and coverage by dimension, architectural violations, code
quality findings, and an entropy score (0–10) that quantifies structural disorder — all in one
place.

## Features

- **Skeleton-based topology** — classify files by layer, role, and domain using a YAML skeleton
- **HTML dashboard** — test quality overview with per-package and per-dimension drilldowns, findings
  tab, trend sparklines
- **Entropy score** — 0–10 composite from five weighted subscores (stability, boundaries, coverage,
  violations, classification)
- **Rule-based analysis** — built-in and plugin-defined rules check topology for violations
- **Annotation workflow** — review and confirm proposed dimension values from the CLI
- **Plugin architecture** — framework-specific scan and analysis rules (Next.js included)
- **Monorepo aware** — discovers pnpm/npm workspaces automatically

## Quick Start

### Prerequisites

- Node.js 22.0.0 or higher
- pnpm 8.0.0 or higher

### Installation

```bash
git clone https://github.com/your-org/spaguettiscope.git
cd spaguettiscope
pnpm install
pnpm build
```

### Typical Workflow

```bash
cd /path/to/your-project

# 1. Scan your project to collect file topology and test records
spasco scan

# 2. Open the interactive dashboard
spasco dashboard

# 3. Annotate findings for review
spasco annotate list
spasco annotate resolve <id>

# 4. Run rule-based analysis (CI-friendly)
spasco analyze
```

## CLI Commands

| Command                              | Description                                                                                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spasco init`                        | Auto-detect tools, write `spasco.config.json`. Use `--interactive` to confirm each connector, `--plugins <ids>` to run detectors from plugins (comma-separated). Refuses if config already exists. |
| `spasco scan`                        | Scan the project: collect files, build topology, propose dimension values                                                                                                                          |
| `spasco dashboard`                   | Generate HTML dashboard with pass rates, coverage, entropy, findings, and trends                                                                                                                   |
| `spasco analyze`                     | Run analysis rules, compute entropy, print findings. Always exits 0.                                                                                                                               |
| `spasco check`                       | Same as analyze but exits 1 on findings above `--severity` or entropy above `--max-entropy`. For CI gates.                                                                                         |
| `spasco annotate list`               | List skeleton entries with unresolved dimensions (`?` or `key?` proposals)                                                                                                                         |
| `spasco annotate resolve [values..]` | Confirm or override proposed dimension values. Use `--as <dim> --all` to accept all proposals for a dimension.                                                                                     |

## Configuration

SpaguettiScope reads `spasco.config.json` (or `spaguettiscope.config.json`) at the project root.

| Key                      | Description                                    | Default                      |
| ------------------------ | ---------------------------------------------- | ---------------------------- |
| `skeleton`               | Path to the skeleton YAML                      | `.spasco/skeleton.yaml`      |
| `analysis.intermediates` | Cache file for analysis rule intermediates     | `.spasco/intermediates.json` |
| `dashboard.connectors`   | Array of test record connectors (e.g. allure)  | `[]`                         |
| `analysisPlugins`        | Array of analysis plugin package IDs to load   | `[]`                         |
| `inference`              | Engine config for test record → file inference | `{}`                         |

### Skeleton YAML

The skeleton defines how files are classified into topology dimensions:

```yaml
rules:
  - pattern: 'app/**/page.tsx'
    dimensions:
      layer: server
      role: page
      domain: '{{1}}' # capture group from glob pattern
  - pattern: 'components/**/*.tsx'
    dimensions:
      layer: client-component
```

## Architecture

```
spaguettiscope/
├── packages/
│   ├── core/       # Analysis engine: rules, topology, import graph, inference
│   ├── cli/        # spasco CLI commands
│   └── reports/    # HTML dashboard renderer and data writers
├── plugins/
│   └── nextjs/     # Next.js scan plugin + analysis plugin
└── apps/
    └── docs/       # Documentation site (Vite + React)
```

### Packages

**`@spaguettiscope/core`** — Framework-agnostic engine:

- Skeleton YAML loading and file matching (`matchFile`, `readSkeleton`)
- Import graph construction (`buildImportGraph`, `mergeImportGraphs`)
- Analysis rule runner (`runAnalysis`, `builtInAnalysisRules`)
- Test record inference engine (`InferenceEngine`)
- Intermediate result cache (`loadIntermediateCache`, `saveIntermediateCache`)

**`@spaguettiscope/cli`** — CLI entrypoint (`spasco`):

- Commands: `scan`, `dashboard`, `analyze`, `check`, `annotate`
- Workspace discovery (`discoverWorkspaces`)
- File walker (`walkFiles`)

**`@spaguettiscope/reports`** — Dashboard generation:

- Writes `summary.json`, `records.json`, `findings.json` to `data/`
- Bundles a Vite+React SPA with tabs: Overview, Drilldown, Findings, History

## Plugin System

### ScanPlugin

Detects whether the plugin applies to a project root and returns scan rules (dimension emitters):

```typescript
import type { ScanPlugin } from '@spaguettiscope/core'

export const myPlugin: ScanPlugin = {
  id: 'my-plugin',
  canApply(root: string): boolean {
    return existsSync(join(root, 'my.config.js'))
  },
  rules() {
    return [
      /* ScanRule[] */
    ]
  },
}
```

### AnalysisPlugin

Returns `AnalysisRule[]` that run over files, edges (import graph), or test records:

```typescript
import type { AnalysisPlugin, AnalysisRule, Finding, EdgeItem } from '@spaguettiscope/core'

const myRule: AnalysisRule<'edges'> = {
  id: 'my:rule-id',
  severity: 'error',
  needs: [],
  corpus: 'edges',
  run(item: EdgeItem, _ctx): Finding[] {
    if (item.from.dimensions.layer !== 'client-component') return []
    if (item.to.dimensions.layer !== 'bff') return []
    return [
      {
        ruleId: 'my:rule-id',
        kind: 'violation',
        severity: 'error',
        subject: { type: 'edge', from: item.from.file, to: item.to.file },
        dimensions: item.from.dimensions,
        message: 'Client cannot import BFF modules directly',
      },
    ]
  },
}

export const myAnalysisPlugin: AnalysisPlugin = {
  id: 'my-analysis',
  canApply,
  rules: () => [myRule],
}
```

Register analysis plugins in `spasco.config.json`:

```json
{
  "analysisPlugins": ["@spaguettiscope/plugin-nextjs/analysis"]
}
```

### Built-in Analysis Rules

| Rule ID                  | Corpus  | Severity | Description                                                      |
| ------------------------ | ------- | -------- | ---------------------------------------------------------------- |
| `built-in:coverage-gap`  | files   | warning  | Files with a meaningful role but no test directly importing them |
| `built-in:unused-export` | files   | info     | Files with no importers and not an entry point                   |
| `built-in:circular-dep`  | files   | warning  | Files in a circular import cycle                                 |
| `built-in:flaky-test`    | records | info     | Test records with a failure rate between 10–90% across runs      |

### Next.js Analysis Rules (`@spaguettiscope/plugin-nextjs/analysis`)

| Rule ID                           | Corpus | Severity | Description                                    |
| --------------------------------- | ------ | -------- | ---------------------------------------------- |
| `nextjs:no-client-imports-server` | edges  | error    | Client component imports a server-action       |
| `nextjs:bff-layer-boundary`       | edges  | error    | Client component imports a BFF (route handler) |
| `nextjs:no-cross-domain-page`     | edges  | warning  | Page imports a page from a different domain    |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run tests for a specific package
cd packages/core && pnpm test

# Lint
pnpm lint

# Format
pnpm format
```

### `.spasco/` Directory

SpaguettiScope stores all generated artifacts under `.spasco/` by default:

```
.spasco/
├── skeleton.yaml          # file topology (checked in)
├── history.jsonl          # run history audit trail (checked in)
├── intermediates.json     # analysis rule cache (gitignored)
└── reports/               # generated dashboard HTML + data (gitignored)
    ├── index.html
    └── data/
        ├── summary.json
        ├── records.json
        └── findings.json
```

Add `.spasco/reports/` and `.spasco/intermediates.json` to `.gitignore`. Commit `skeleton.yaml`,
`history.jsonl`, and `spasco.config.json`.

## License

MIT — see [LICENSE](LICENSE) for details.
