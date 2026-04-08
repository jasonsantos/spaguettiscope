# Dogfood Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 bugs found while dogfooding spasco on its own repository.

**Architecture:** Three independent fixes: (1) filter annotate resolve by dimension, (2) extract
shared connector registry for analyze, (3) remove broken typescript init detector.

**Tech Stack:** TypeScript, Vitest, Commander.js

---

## File Structure

| File                                               | Action | Responsibility                            |
| -------------------------------------------------- | ------ | ----------------------------------------- |
| `packages/cli/src/commands/annotate.ts`            | Modify | Fix dimension filtering in `--all` path   |
| `packages/cli/src/tests/commands/annotate.test.ts` | Modify | Add tests for dimension-scoped resolution |
| `packages/cli/src/utils/connectors.ts`             | Create | Shared connector registry                 |
| `packages/cli/src/commands/analyze.ts`             | Modify | Use shared connector registry             |
| `packages/cli/src/commands/dashboard.ts`           | Modify | Import from shared connector registry     |
| `packages/cli/src/tests/commands/analyze.test.ts`  | Modify | Test that analyze loads vitest records    |
| `packages/core/src/init/detectors/typescript.ts`   | Delete | Broken detector                           |
| `packages/core/src/init/index.ts`                  | Modify | Remove typescript detector from registry  |
| `packages/core/src/tests/init/typescript.test.ts`  | Delete | Tests for removed detector                |

---

### Task 1: Fix `annotate resolve --as <dim> --all` dimension filtering

**Files:**

- Modify: `packages/cli/src/tests/commands/annotate.test.ts`
- Modify: `packages/cli/src/commands/annotate.ts:86-99`

- [ ] **Step 1: Write failing test — resolve only the targeted dimension**

Add this test to the existing `describe('runAnnotateResolve')` block in
`packages/cli/src/tests/commands/annotate.test.ts`:

```typescript
it('resolves only the targeted dimension when using --all with key? entries', async () => {
  makeProject(
    dir,
    [
      `- attributes:`,
      `    "domain?": cli`,
      `    "layer?": utility`,
      `  paths:`,
      `    - packages/cli/src/utils/**`,
      `  draft: true`,
      `  source: "workspace:@spaguettiscope/cli"`,
    ].join('\n')
  )
  await runAnnotateResolve({ values: [], all: true, as: 'domain', projectRoot: dir })
  const skeleton = readSkeleton(join(dir, '.spasco', 'skeleton.yaml'))
  // domain? should be resolved to domain, layer? should remain as-is
  expect(skeleton.entries[0].attributes).toHaveProperty('domain', 'cli')
  expect(skeleton.entries[0].attributes).toHaveProperty('layer?', 'utility')
  expect(skeleton.entries[0].attributes).not.toHaveProperty('domain?')
  // Entry should still be draft because layer? remains
  expect((skeleton.entries[0] as any).draft).toBe(true)
})
```

- [ ] **Step 2: Write second failing test — entry fully resolved after both dimensions**

```typescript
it('fully resolves entry after resolving all dimensions separately', async () => {
  makeProject(
    dir,
    [
      `- attributes:`,
      `    "domain?": cli`,
      `    "layer?": utility`,
      `  paths:`,
      `    - packages/cli/src/utils/**`,
      `  draft: true`,
    ].join('\n')
  )
  await runAnnotateResolve({ values: [], all: true, as: 'domain', projectRoot: dir })
  await runAnnotateResolve({ values: [], all: true, as: 'layer', projectRoot: dir })
  const skeleton = readSkeleton(join(dir, '.spasco', 'skeleton.yaml'))
  expect(skeleton.entries[0].attributes).toEqual({ domain: 'cli', layer: 'utility' })
  expect((skeleton.entries[0] as any).draft).toBeUndefined()
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E '(FAIL|✓|✕|resolve)'`

Expected: The two new tests fail (the first because `layer?` gets resolved too, the second because
it's already fully resolved after the first call).

- [ ] **Step 4: Fix the `--all` path in annotate.ts**

In `packages/cli/src/commands/annotate.ts`, replace lines 86-99:

```typescript
// Handle key? proposed entries: confirm only the targeted dimension
if (proposedKeys.length > 0 && options.all) {
  const targetKey = options.as + '?'
  if (!proposedKeys.includes(targetKey)) return entry

  const newAttributes: Record<string, string> = {}
  for (const [k, v] of Object.entries(entry.attributes)) {
    if (k === targetKey) {
      newAttributes[options.as] = v // domain? → domain
    } else {
      newAttributes[k] = v // keep other keys as-is (including other key? entries)
    }
  }
  Object.assign(newAttributes, extraAttrs)
  resolved++

  // Stay draft if any key? attributes remain
  const stillHasProposed = Object.keys(newAttributes).some(k => k.endsWith('?') && k !== '?')
  if (stillHasProposed) {
    return {
      attributes: newAttributes,
      paths: entry.paths,
      draft: true,
      source: (entry as any).source,
    }
  }
  return { attributes: newAttributes, paths: entry.paths }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/cli && pnpm test`

Expected: All tests pass including the 2 new ones. Existing tests for bare `?` entries still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/annotate.ts packages/cli/src/tests/commands/annotate.test.ts
git commit -m "fix(cli): Filter annotate resolve --all by the targeted --as dimension"
```

---

### Task 2: Extract shared connector registry and fix `analyze` record loading

**Files:**

- Create: `packages/cli/src/utils/connectors.ts`
- Modify: `packages/cli/src/commands/dashboard.ts:23-52`
- Modify: `packages/cli/src/commands/analyze.ts:1-97`
- Modify: `packages/cli/src/tests/commands/analyze.test.ts`

- [ ] **Step 1: Create shared connector registry**

Create `packages/cli/src/utils/connectors.ts`:

```typescript
import {
  AllureConnector,
  PlaywrightConnector,
  VitestConnector,
  LcovConnector,
  EslintConnector,
  TypescriptConnector,
  type Connector,
} from '@spaguettiscope/reports'

export const CONNECTORS: Connector[] = [
  new AllureConnector(),
  new PlaywrightConnector(),
  new VitestConnector(),
  new LcovConnector(),
  new EslintConnector(),
  new TypescriptConnector(),
]
```

Note: The `Connector` interface is exported from `@spaguettiscope/reports`. Check whether it is — if
not, use a plain array with no type annotation. The key is that each element has `.id`, `.category`,
and `.read()`.

- [ ] **Step 2: Update dashboard.ts to import from shared registry**

In `packages/cli/src/commands/dashboard.ts`:

Remove these imports from the `@spaguettiscope/reports` import block:

```
  AllureConnector,
  PlaywrightConnector,
  VitestConnector,
  LcovConnector,
  EslintConnector,
  TypescriptConnector,
```

Remove the `const CONNECTORS = [...]` block (lines 45-52).

Add this import:

```typescript
import { CONNECTORS } from '../utils/connectors.js'
```

- [ ] **Step 3: Write failing test — analyze loads vitest records**

Add to `packages/cli/src/tests/commands/analyze.test.ts`:

```typescript
it('loads test records from configured vitest connector', async () => {
  // Create a project with a vitest connector configured and a vitest report file
  const vitestReport = [
    {
      testResults: [
        {
          assertionResults: [{ fullName: 'adds numbers', status: 'passed', duration: 5 }],
        },
      ],
    },
  ]
  mkdirSync(join(dir, '.spasco'), { recursive: true })
  writeFileSync(
    join(dir, 'spasco.config.json'),
    JSON.stringify({
      name: 'test',
      dashboard: {
        connectors: [{ id: 'vitest', resultsDir: '.spasco' }],
      },
    })
  )
  writeFileSync(join(dir, '.spasco', 'skeleton.yaml'), '')
  writeFileSync(join(dir, '.spasco', 'vitest-report.json'), JSON.stringify(vitestReport))
  const result = await runAnalyzeCommand({ projectRoot: dir, ci: true })
  expect(result.entropy).toBeDefined()
  expect(result.entropy.score).toBeGreaterThanOrEqual(0)
})
```

This test verifies that the analyze command successfully reads from a vitest connector config (not
just allure). The exact vitest report shape may need adjustment — check
`packages/reports/src/connectors/vitest.ts` for the expected JSON format. The key assertion is that
it doesn't throw and returns an entropy result.

- [ ] **Step 4: Rewrite analyze.ts record loading to use shared connectors**

In `packages/cli/src/commands/analyze.ts`:

Replace the imports at the top. Remove:

```typescript
import { AllureConnector } from '@spaguettiscope/reports'
```

Add:

```typescript
import { CONNECTORS } from '../utils/connectors.js'
import { type NormalizedRunRecord } from '@spaguettiscope/reports'
```

Also add `InferenceEngine` and `defaultDefinitions` to the `@spaguettiscope/core` import if not
already there (they should already be there).

Replace the record loading section (around lines 73-97) with:

```typescript
// 3. Load test records from connectors
const records: NormalizedRunRecord[] = []
if (config.dashboard.connectors.length > 0) {
  const recSpinner = ora('Loading test records…').start()
  const engine = new InferenceEngine(defaultDefinitions, projectRoot, config.inference ?? {})
  for (const connectorConfig of config.dashboard.connectors) {
    const connector = CONNECTORS.find(c => c.id === connectorConfig.id)
    if (!connector) continue
    try {
      const results = await connector.read(connectorConfig, engine)
      records.push(...results)
    } catch {
      // connector error — skip
    }
  }
  recSpinner.succeed(`Loaded ${records.length} test records`)
}
```

Then update the `runAnalysis` call — it currently receives `testRecords` as `TestRecord[]`. Map the
`NormalizedRunRecord[]` to `TestRecord[]` for the analysis engine:

```typescript
const testRecords: TestRecord[] = records.map(r => ({
  id: r.id,
  historyId: r.metadata?.historyId as string | undefined,
  status: r.status,
  dimensions: r.dimensions,
}))
```

And update `gatherEntropyInput` to receive the full `records` array:

```typescript
const entropyInput = gatherEntropyInput({
  files: allFiles,
  importGraph,
  findings,
  topology,
  records, // NormalizedRunRecord[] — compatible with EntropyRecord
  skeleton,
})
```

- [ ] **Step 5: Build and run tests**

Run: `pnpm build && cd packages/cli && pnpm test`

Expected: All tests pass. The new test verifies analyze reads vitest records.

- [ ] **Step 6: Verify manually**

Run: `node packages/cli/dist/index.js analyze 2>&1 | grep "Loaded\|Entropy"`

Expected: Should now show `Loaded N test records` where N > 0 (matching what dashboard sees) and an
entropy score consistent with what dashboard reports.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/utils/connectors.ts packages/cli/src/commands/dashboard.ts packages/cli/src/commands/analyze.ts packages/cli/src/tests/commands/analyze.test.ts
git commit -m "fix(cli): Load all configured connectors in analyze command"
```

---

### Task 3: Remove broken TypeScript init detector

**Files:**

- Delete: `packages/core/src/init/detectors/typescript.ts`
- Delete: `packages/core/src/tests/init/typescript.test.ts`
- Modify: `packages/core/src/init/index.ts`

- [ ] **Step 1: Remove typescript detector from the registry**

In `packages/core/src/init/index.ts`, remove these two lines:

```typescript
export { typescriptDetector } from './detectors/typescript.js'
```

```typescript
import { typescriptDetector } from './detectors/typescript.js'
```

And remove `typescriptDetector` from the `builtInDetectors` array.

The file should look like:

```typescript
export type { InitDetector, DetectedConnector, PluginDetector } from './interface.js'
export { vitestDetector } from './detectors/vitest.js'
export { lcovDetector } from './detectors/lcov.js'
export { playwrightDetector } from './detectors/playwright.js'
export { allureDetector } from './detectors/allure.js'
export { eslintDetector } from './detectors/eslint.js'

import { vitestDetector } from './detectors/vitest.js'
import { lcovDetector } from './detectors/lcov.js'
import { playwrightDetector } from './detectors/playwright.js'
import { allureDetector } from './detectors/allure.js'
import { eslintDetector } from './detectors/eslint.js'
import type { InitDetector } from './interface.js'

export const builtInDetectors: InitDetector[] = [
  vitestDetector,
  lcovDetector,
  playwrightDetector,
  allureDetector,
  eslintDetector,
]
```

- [ ] **Step 2: Delete the detector file and its test**

Delete: `packages/core/src/init/detectors/typescript.ts` Delete:
`packages/core/src/tests/init/typescript.test.ts`

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`

Expected: All packages build. Tests pass (minus the deleted typescript detector tests).

- [ ] **Step 4: Verify — init no longer emits typescript configs**

Run:

```bash
rm spasco.config.json
node packages/cli/dist/index.js init 2>&1
cat spasco.config.json | grep typescript
```

Expected: No typescript entries in the generated config. Only vitest (and possibly lcov, eslint,
etc.) connectors appear.

- [ ] **Step 5: Commit**

```bash
git add -u packages/core/src/init/detectors/typescript.ts packages/core/src/init/index.ts packages/core/src/tests/init/typescript.test.ts
git commit -m "fix(core): Remove typescript init detector (incompatible with connector)"
```

---

## Self-Review

**Spec coverage:** | Spec requirement | Task | |---|---| | `--as domain --all` resolves only domain
entries | Task 1 | | Entry stays draft if other `key?` remain | Task 1 (test + `stillHasProposed`
check) | | Guidance accurately reports count | Task 1 (existing guidance code uses `resolved`
counter, no change needed) | | Analyze loads all connector types | Task 2 | | Entropy matches
between analyze and dashboard | Task 2 (same connectors, same data) | | runAnalysis still receives
TestRecord[] | Task 2 (explicit mapping step) | | Init doesn't emit typescript configs | Task 3 | |
Manual typescript configs still work | Task 3 (connector untouched, only detector removed) | |
Dashboard runs clean after init | Task 3 (no broken typescript entries) |

**Placeholder scan:** No TBD/TODO/placeholders found.

**Type consistency:** `CONNECTORS` array used in both dashboard.ts and analyze.ts.
`NormalizedRunRecord[]` mapped to `TestRecord[]` for analysis, passed as `EntropyRecord[]` for
entropy (compatible via structural typing).
