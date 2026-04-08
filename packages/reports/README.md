# @spaguettiscope/reports

Connectors, aggregation, and HTML dashboard renderer for SpaguettiScope.

## What it does

- **Connectors** read CI test artifacts: Allure, Playwright, Vitest, LCov, ESLint, TypeScript
- **Aggregator** rolls up records by dimension, connector, and overall
- **Renderer** generates a self-contained HTML dashboard (React + Recharts) with:
  - Pass rate, coverage, entropy, and findings metric cards
  - Package health map with per-package drilldown
  - Dimension panels (by role, domain, layer) with test counts and coverage
  - Trend sparklines from run history
  - Findings tab with severity filtering

## Usage

```typescript
import { VitestConnector, LcovConnector, writeDashboardData } from '@spaguettiscope/reports'
```

See the [main repository](https://github.com/jasonsantos/spaguettiscope) for full documentation.
