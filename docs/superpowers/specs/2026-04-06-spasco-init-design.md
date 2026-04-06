# spasco init — Design Spec

**Date:** 2026-04-06 **Status:** Approved

## Overview

`spasco init` is a new CLI command that auto-detects installed tools and generates
`spasco.config.json`. It removes the need to hand-write connector configs by scanning the repository
for well-known output files and producing a ready-to-use configuration.

---

## Architecture

### `InitDetector` interface — `@spaguettiscope/core`

New interface in `packages/core/src/init/interface.ts`:

```typescript
export interface DetectedConnector {
  config: ConnectorConfig // ready-to-use connector entry
  source: string // human-readable: "found at .spasco/vitest-core.json"
}

export interface InitDetector {
  readonly connectorId: string // matches the connector's id (e.g. 'vitest')
  detect(
    packageRoot: string, // absolute path to a workspace package
    projectRoot: string // absolute path to repo root
  ): DetectedConnector[] // empty array if nothing found
}
```

Detection is purely file-system based (no network, no subprocesses). All returned paths are relative
to `projectRoot` so the written config is portable.

### Built-in detectors — `@spaguettiscope/core/src/init/detectors/`

Six detectors ship in core, one per supported connector:

| Detector     | Scans for                                                                                                                  | Produces                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `vitest`     | `vitest.config.*` in package + JSON files in `.vitest/`, `test-results/`, `.spasco/` that look like vitest reporter output | `{ id: "vitest", reportFile: "<rel>" }`                       |
| `lcov`       | Any `lcov.info` under `coverage/` subdirs                                                                                  | `{ id: "lcov", lcovFile: "<rel>", packageRoot: "<pkg-rel>" }` |
| `playwright` | `playwright.config.*` in package + `playwright-report/` or `test-results/` dirs                                            | `{ id: "playwright", resultsDir: "<rel>" }`                   |
| `allure`     | `allure-results/` dir                                                                                                      | `{ id: "allure", resultsDir: "<rel>" }`                       |
| `eslint`     | JSON files matching `eslint-*.json` or `*-eslint.json` in common output dirs                                               | `{ id: "eslint", reportFile: "<rel>" }`                       |
| `typescript` | Presence of `tsconfig.json` in package                                                                                     | `{ id: "typescript", tsconfigFile: "<rel>" }`                 |

Detection is conservative — missing files produce no entry. No false positives.

### Plugin-exported detectors

Scan plugins that also produce connector output (e.g. `@spaguettiscope/plugin-playwright`) export an
`InitDetector` alongside their `ScanPlugin`:

```typescript
// plugins/playwright/src/index.ts
export const plugin: ScanPlugin = { ... }
export const detector: InitDetector = { ... }
```

`spasco init` imports any configured `plugins` and checks for a named `detector` export.

---

## CLI Command

```
spasco init [--interactive] [--plugins <id,...>] [--project-root <dir>]
```

### Execution flow

1. **Guard** — if `spasco.config.json` or `spaguettiscope.config.json` already exists, print an
   error and exit 1. No overwrite.

2. **Discover workspaces** — calls `discoverWorkspaces(projectRoot)` (same function used by
   `dashboard`). Returns `[{ rel, root }]`.

3. **Run detectors** — for each workspace × each detector, calls
   `detector.detect(pkg.root, projectRoot)`. Collects all results into a flat `DetectedConnector[]`.

4. **Load plugin detectors** — reads `plugins` from a `--plugins <id,...>` CLI flag (comma-separated
   module IDs). For each, dynamically imports the module and calls its exported `detector.detect()`
   if present.

5. **Build config shape** — merges results into a `SpascoConfig`-compatible object. Project name
   defaults to root `package.json`'s `name` field.

6. **Interactive mode** (`--interactive`) — after auto-detection, prompts:
   - "Project name?" (pre-filled from package.json name)
   - For each detected connector: confirm or skip
   - For ambiguous cases (multiple lcov files in a package): select which to include

7. **Write `spasco.config.json`** — pretty-printed JSON, all paths relative to project root.

8. **Print summary** — lists what was detected and what was written. Suggests running
   `spasco dashboard` next.

Non-interactive default: no prompts, writes everything detected.

---

## Data flow

```
discoverWorkspaces(projectRoot)
  └─ [{ rel, root }]
       └─ for each pkg × each InitDetector
            └─ detector.detect(pkg.root, projectRoot)
                 └─ DetectedConnector[]
                      └─ merge into SpascoConfig shape
                           └─ write spasco.config.json
```

---

## Error handling

| Scenario                                            | Behaviour                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| Config already exists                               | Exit 1 with message. No overwrite.                                                |
| No connectors detected                              | Write minimal config with `connectors: []`, warn user.                            |
| Plugin import fails                                 | Warn and continue. Never fatal.                                                   |
| Glob/filesystem error in detector                   | Caught per-detector, silently skipped. Best-effort.                               |
| `--interactive` on non-TTY                          | Falls back to non-interactive with a notice.                                      |
| Multiple matches for same connector in same package | All included as separate entries. User can prune manually or via `--interactive`. |

Exit codes: `0` (success), `1` (config already exists). Detection failures never cause non-zero
exit.

---

## Testing

- Unit tests for each built-in detector using tmp directories (`beforeEach` / `afterEach` pattern,
  no mocks)
- Integration test for `spasco init` end-to-end: scaffold a tmp monorepo with lcov + vitest output
  files, run `init`, assert written config shape
- Interactive mode tested via programmatic input injection (or skipped in favour of unit-testing the
  prompt logic in isolation)
- Tests live at `packages/cli/src/tests/commands/init.test.ts` and `packages/core/src/tests/init/`

---

## Files to create / modify

| File                                             | Action                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `packages/core/src/init/interface.ts`            | New — `InitDetector`, `DetectedConnector`                               |
| `packages/core/src/init/detectors/vitest.ts`     | New                                                                     |
| `packages/core/src/init/detectors/lcov.ts`       | New                                                                     |
| `packages/core/src/init/detectors/playwright.ts` | New                                                                     |
| `packages/core/src/init/detectors/allure.ts`     | New                                                                     |
| `packages/core/src/init/detectors/eslint.ts`     | New                                                                     |
| `packages/core/src/init/detectors/typescript.ts` | New                                                                     |
| `packages/core/src/init/index.ts`                | New — re-exports + `builtInDetectors` array                             |
| `packages/core/src/index.ts`                     | Extend — export `InitDetector`, `DetectedConnector`, `builtInDetectors` |
| `packages/cli/src/commands/init.ts`              | New — command implementation                                            |
| `packages/cli/src/index.ts`                      | Extend — register `init` command                                        |
| `packages/core/src/tests/init/*.test.ts`         | New — per-detector unit tests                                           |
| `packages/cli/src/tests/commands/init.test.ts`   | New — integration test                                                  |
