# Phase 3a — `.spasco/` Directory Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all SpaguettiScope working files under a `.spasco/` directory, rename the
config file to `spasco.config.json`, and maintain full backwards compatibility with existing
projects.

**Architecture:** The config schema defaults change to point into `.spasco/`. The loader checks
`spasco.config.json` first, then falls back to `spaguettiscope.config.json`. The file walker ignores
`.spasco/` so its generated contents don't inflate the file count. The scan command ensures
`.spasco/` exists before writing the skeleton.

**Tech Stack:** TypeScript, zod (config schema), vitest (tests), yaml (skeleton I/O)

---

## File Structure

| File                                               | Change                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/core/src/config/schema.ts`               | Update defaults: skeleton, outputDir, historyFile; add `analysis.intermediates`    |
| `packages/core/src/config/loader.ts`               | Check `spasco.config.json` first, fall back to `spaguettiscope.config.json`        |
| `packages/cli/src/utils/files.ts`                  | Add `.spasco` to `IGNORED_DIRS`                                                    |
| `packages/cli/src/commands/scan.ts`                | `mkdirSync(dirname(skeletonPath), { recursive: true })` before `writeSkeleton`     |
| `packages/core/src/tests/config/loader.test.ts`    | Update default-path assertion; add `spasco.config.json` tests                      |
| `packages/cli/src/tests/commands/scan.test.ts`     | Update skeleton path from `spaguettiscope.skeleton.yaml` → `.spasco/skeleton.yaml` |
| `packages/cli/src/tests/commands/annotate.test.ts` | Update `makeProject` to write skeleton into `.spasco/`                             |

---

### Task 1: Update config schema defaults and add `analysis` field

**Files:**

- Modify: `packages/core/src/config/schema.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/tests/config/loader.test.ts`:

```typescript
it('defaults skeleton path to .spasco/skeleton.yaml', async () => {
  writeFileSync(
    join(tmpDir, 'spasco.config.json'),
    JSON.stringify({ dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.skeleton).toBe('.spasco/skeleton.yaml')
})

it('defaults dashboard.outputDir to .spasco/reports', async () => {
  writeFileSync(
    join(tmpDir, 'spasco.config.json'),
    JSON.stringify({ dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.dashboard.outputDir).toBe('.spasco/reports')
})

it('defaults dashboard.historyFile to .spasco/history.jsonl', async () => {
  writeFileSync(
    join(tmpDir, 'spasco.config.json'),
    JSON.stringify({ dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.dashboard.historyFile).toBe('.spasco/history.jsonl')
})

it('defaults analysis.intermediates to .spasco/intermediates.json', async () => {
  writeFileSync(
    join(tmpDir, 'spasco.config.json'),
    JSON.stringify({ dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.analysis.intermediates).toBe('.spasco/intermediates.json')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "defaults skeleton\|defaults dashboard\|defaults analysis"
```

Expected: FAIL — `config.skeleton` is still `'./spaguettiscope.skeleton.yaml'`, `config.analysis` is
undefined.

- [ ] **Step 3: Update `packages/core/src/config/schema.ts`**

Replace the entire file with:

```typescript
import { z } from 'zod'
import type { InferenceRule } from '../classification/model.js'

const ConnectorConfigSchema = z
  .object({
    id: z.string(),
    resultsDir: z.string().optional(),
  })
  .passthrough()

const CustomDimensionSchema = z.object({
  dimension: z.string(),
  patterns: z.record(z.string(), z.array(z.string())),
})

const DimensionOverridesSchema = z
  .object({
    overrides: z.record(z.string(), z.record(z.string(), z.array(z.string()))).optional(),
    custom: z.array(CustomDimensionSchema).optional(),
  })
  .optional()

const InferenceRuleSchema = z.object({
  glob: z.string(),
  value: z.string(),
})

export const SpascoConfigSchema = z.object({
  name: z.string().optional(),
  plugin: z.string().optional(),
  dimensions: DimensionOverridesSchema,
  inference: z.record(z.string(), z.array(InferenceRuleSchema)).optional(),
  skeleton: z.string().default('.spasco/skeleton.yaml'),
  rules: z
    .object({
      disable: z.array(z.string()).default([]),
    })
    .default({ disable: [] }),
  plugins: z.array(z.string()).default([]),
  analysisPlugins: z.array(z.string()).default([]),
  dashboard: z
    .object({
      connectors: z.array(ConnectorConfigSchema).default([]),
      outputDir: z.string().default('.spasco/reports'),
      historyFile: z.string().default('.spasco/history.jsonl'),
    })
    .default({
      connectors: [],
      outputDir: '.spasco/reports',
      historyFile: '.spasco/history.jsonl',
    }),
  analysis: z
    .object({
      intermediates: z.string().default('.spasco/intermediates.json'),
    })
    .default({ intermediates: '.spasco/intermediates.json' }),
})

export type SpascoConfig = z.infer<typeof SpascoConfigSchema>
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>
export type InferenceConfig = Record<string, InferenceRule[]>
```

- [ ] **Step 4: Run the new tests to verify they pass**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "defaults skeleton\|defaults dashboard\|defaults analysis"
```

Expected: PASS for the 4 new tests.

- [ ] **Step 5: Check the existing skeleton-default test now fails and fix it**

The existing test `'defaults skeleton path to ./spaguettiscope.skeleton.yaml'` now fails — update
it:

In `packages/core/src/tests/config/loader.test.ts`, find and delete this test:

```typescript
it('defaults skeleton path to ./spaguettiscope.skeleton.yaml', async () => {
  writeFileSync(
    join(tmpDir, 'spaguettiscope.config.json'),
    JSON.stringify({ dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.skeleton).toBe('./spaguettiscope.skeleton.yaml')
})
```

(It is replaced by the new `'defaults skeleton path to .spasco/skeleton.yaml'` test above.)

- [ ] **Step 6: Run full core test suite**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/config/schema.ts packages/core/src/tests/config/loader.test.ts
git commit -m "feat: Update config schema defaults to .spasco/ directory"
```

---

### Task 2: Update config loader to check `spasco.config.json` first

**Files:**

- Modify: `packages/core/src/config/loader.ts`
- Modify: `packages/core/src/tests/config/loader.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/core/src/tests/config/loader.test.ts`:

```typescript
it('loads spasco.config.json when present', async () => {
  writeFileSync(
    join(tmpDir, 'spasco.config.json'),
    JSON.stringify({ name: 'new-name', dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.name).toBe('new-name')
})

it('falls back to spaguettiscope.config.json when spasco.config.json absent', async () => {
  writeFileSync(
    join(tmpDir, 'spaguettiscope.config.json'),
    JSON.stringify({ name: 'old-name', dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.name).toBe('old-name')
})

it('prefers spasco.config.json over spaguettiscope.config.json when both exist', async () => {
  writeFileSync(
    join(tmpDir, 'spasco.config.json'),
    JSON.stringify({ name: 'new-name', dashboard: { connectors: [] } })
  )
  writeFileSync(
    join(tmpDir, 'spaguettiscope.config.json'),
    JSON.stringify({ name: 'old-name', dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.name).toBe('new-name')
})

it('throws a descriptive error for an invalid spasco.config.json', async () => {
  writeFileSync(
    join(tmpDir, 'spasco.config.json'),
    JSON.stringify({ dashboard: { connectors: 'not-an-array' } })
  )
  await expect(loadConfig(tmpDir)).rejects.toThrow('spasco.config.json')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && pnpm test --reporter=verbose 2>&1 | grep -A3 "loads spasco\|falls back\|prefers spasco\|invalid spasco"
```

Expected: FAIL — loader only knows about `spaguettiscope.config.json`.

- [ ] **Step 3: Update `packages/core/src/config/loader.ts`**

Replace the entire file:

```typescript
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SpascoConfigSchema, type SpascoConfig } from './schema.js'

const CONFIG_FILENAMES = ['spasco.config.json', 'spaguettiscope.config.json'] as const

export async function loadConfig(projectRoot: string): Promise<SpascoConfig> {
  const filename = CONFIG_FILENAMES.find(f => existsSync(join(projectRoot, f)))
  if (!filename) {
    return SpascoConfigSchema.parse({})
  }

  const configPath = join(projectRoot, filename)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    throw new Error(`Failed to parse ${filename}: invalid JSON`)
  }

  const result = SpascoConfigSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid ${filename}:\n${issues}`)
  }

  return result.data
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/loader.ts packages/core/src/tests/config/loader.test.ts
git commit -m "feat: Load spasco.config.json with fallback to spaguettiscope.config.json"
```

---

### Task 3: Add `.spasco` to IGNORED_DIRS and ensure scan creates the directory

**Files:**

- Modify: `packages/cli/src/utils/files.ts`
- Modify: `packages/cli/src/commands/scan.ts`

- [ ] **Step 1: Update `packages/cli/src/utils/files.ts`**

Add `.spasco` to the set:

```typescript
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage',
  '.next',
  '.nuxt',
  'out',
  '.vite',
  'allure-results',
  'allure-report',
  '.spasco',
])
```

- [ ] **Step 2: Update `packages/cli/src/commands/scan.ts` to create `.spasco/` before writing**

Add `mkdirSync` import and directory creation. Find the line:

```typescript
import { resolve } from 'node:path'
```

Replace with:

```typescript
import { resolve, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
```

Then find the lines (around line 106):

```typescript
const existing = readSkeleton(skeletonPath)
```

Add directory creation immediately before it:

```typescript
mkdirSync(dirname(skeletonPath), { recursive: true })
const existing = readSkeleton(skeletonPath)
```

- [ ] **Step 3: Run the CLI test suite**

```bash
cd packages/cli && pnpm test
```

Expected: all tests pass. (Tests still use `spaguettiscope.config.json` which is fine via backward
compat.)

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/utils/files.ts packages/cli/src/commands/scan.ts
git commit -m "feat: Ignore .spasco dir in file walk; create skeleton parent dir on scan"
```

---

### Task 4: Update scan and annotate tests for new default paths

**Files:**

- Modify: `packages/cli/src/tests/commands/scan.test.ts`
- Modify: `packages/cli/src/tests/commands/annotate.test.ts`

- [ ] **Step 1: Update `scan.test.ts`**

The `makeProject` helper and skeleton path references must change. In
`packages/cli/src/tests/commands/scan.test.ts`:

Replace the `makeProject` function:

```typescript
function makeProject(dir: string, files: Record<string, string> = {}) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'spasco.config.json'),
    JSON.stringify({ name: 'test-project', dashboard: { connectors: [] } })
  )
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(abs.substring(0, abs.lastIndexOf('/')), { recursive: true })
    writeFileSync(abs, content)
  }
}
```

Then find every occurrence of:

```typescript
const skeletonPath = join(dir, 'spaguettiscope.skeleton.yaml')
```

And replace with:

```typescript
const skeletonPath = join(dir, '.spasco', 'skeleton.yaml')
```

- [ ] **Step 2: Update `annotate.test.ts`**

The `makeProject` helper in annotate tests writes the skeleton directly. Update it to write into
`.spasco/`:

```typescript
function makeProject(dir: string, skeletonYaml: string) {
  mkdirSync(join(dir, '.spasco'), { recursive: true })
  writeFileSync(
    join(dir, 'spasco.config.json'),
    JSON.stringify({ name: 'test', dashboard: { connectors: [] } })
  )
  writeFileSync(join(dir, '.spasco', 'skeleton.yaml'), skeletonYaml)
}
```

Then find every occurrence of:

```typescript
const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
```

And replace with:

```typescript
const skeleton = readSkeleton(join(dir, '.spasco', 'skeleton.yaml'))
```

- [ ] **Step 3: Run full CLI test suite**

```bash
cd packages/cli && pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/tests/commands/scan.test.ts packages/cli/src/tests/commands/annotate.test.ts
git commit -m "test: Update CLI tests to use .spasco/ default paths"
```

---

### Task 5: Run full build and generate `.spasco/.gitignore` on `spasco init`

**Files:**

- Modify: `packages/cli/src/commands/scan.ts` — generate `.spasco/.gitignore` on first run if it
  doesn't exist

- [ ] **Step 1: Add `.gitignore` generation to scan command**

In `packages/cli/src/commands/scan.ts`, add this import:

```typescript
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
```

(Replace the existing `mkdirSync` import if needed — add `existsSync` and `writeFileSync`.)

After the line `mkdirSync(dirname(skeletonPath), { recursive: true })`, add:

```typescript
const spascoGitignore = resolve(projectRoot, '.spasco', '.gitignore')
if (!existsSync(spascoGitignore)) {
  writeFileSync(spascoGitignore, 'reports/\nintermediates.json\n')
}
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Smoke test on a real project**

```bash
cd /Users/jasonsantos/work/pharmacy-online
node /Users/jasonsantos/personal/spaguettiscope/spaguettiscope/packages/cli/dist/index.js scan
ls .spasco/
```

Expected output: `.spasco/skeleton.yaml` and `.spasco/.gitignore` created. `skeleton.yaml` content
matches old `spaguettiscope.skeleton.yaml`.

- [ ] **Step 4: Build all packages**

```bash
cd /Users/jasonsantos/personal/spaguettiscope/spaguettiscope && pnpm build
```

Expected: all 11 tasks succeed.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/scan.ts
git commit -m "feat: Generate .spasco/.gitignore on first scan"
```
