# @spaguettiscope/core

Classification engine, skeleton, import graph, and analysis rules for SpaguettiScope.

## What it does

- Loads and validates `spasco.config.json`
- Reads/writes the skeleton YAML (file topology)
- Builds import graphs from TypeScript/JavaScript sources
- Runs analysis rules (coverage gaps, unused exports, circular deps, flaky tests)
- Computes entropy scores (0–10) from five weighted subscores
- Classifies files into dimensions (role, layer, domain) via inference rules

## Usage

```typescript
import { loadConfig, readSkeleton, buildImportGraph, runAnalysis } from '@spaguettiscope/core'
```

See the [main repository](https://github.com/jasonsantos/spaguettiscope) for full documentation.
