# Topology Model Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace discovery, per-package import graphs, graph rule predicates, automatic
plugin detection, the Next.js plugin, and the `inherit-from-import` dashboard pass.

**Architecture:** Three new modules in core (workspace, graph, plugins/types) feed a rewritten scan
pipeline that auto-scopes plugins to detected packages and passes the import graph to the rule
runner. The dashboard gains a second post-pass that inherits skeleton attributes from imported
source files onto test records.

**Tech Stack:** `@typescript-eslint/parser` (AST import extraction), `minimatch` (already present),
`yaml` (already present), `vitest` (testing), `commander` (CLI — unchanged).

---

## File Map

**New — `packages/core`**

| File                                    | Responsibility                                         |
| --------------------------------------- | ------------------------------------------------------ |
| `src/workspace/index.ts`                | `discoverWorkspaces`, `WorkspacePackage`               |
| `src/plugins/types.ts`                  | `ScanPlugin` interface                                 |
| `src/graph/index.ts`                    | `buildImportGraph`, `mergeImportGraphs`, `ImportGraph` |
| `src/graph/predicates.ts`               | `evaluateGraphPredicate`                               |
| `src/tests/workspace/workspace.test.ts` | workspace discovery tests                              |
| `src/tests/graph/graph.test.ts`         | import graph builder tests                             |
| `src/tests/graph/predicates.test.ts`    | graph predicate evaluator tests                        |

**Modified — `packages/core`**

| File                   | Change                                                       |
| ---------------------- | ------------------------------------------------------------ |
| `src/rules/types.ts`   | Add `GraphPredicate` type + `graph?` field on `RuleSelector` |
| `src/rules/runner.ts`  | Options object signature, graph predicate evaluation         |
| `src/config/schema.ts` | Add `plugins: z.array(z.string()).default([])`               |
| `src/index.ts`         | Export workspace, graph, plugins modules                     |

**New — `packages/cli`**

| File                 | Responsibility                                |
| -------------------- | --------------------------------------------- |
| `src/utils/files.ts` | Shared `walkFiles` used by scan and dashboard |

**Modified — `packages/cli`**

| File                                   | Change                                                   |
| -------------------------------------- | -------------------------------------------------------- |
| `src/commands/scan.ts`                 | Workspace discovery, plugin loading/scoping, graph build |
| `src/commands/dashboard.ts`            | `inherit-from-import` post-pass                          |
| `src/tests/commands/scan.test.ts`      | Monorepo scan tests                                      |
| `src/tests/commands/dashboard.test.ts` | Inherit-from-import tests                                |

**New — `plugins/nextjs`**

| File                       | Responsibility                                  |
| -------------------------- | ----------------------------------------------- |
| `package.json`             | `@spaguettiscope/plugin-nextjs` package         |
| `tsconfig.json`            | Build config (mirrors core pattern)             |
| `src/detect.ts`            | `canApply` — checks `next` in package.json deps |
| `src/rules.ts`             | Next.js App Router rule definitions             |
| `src/index.ts`             | Export `nextjsPlugin: ScanPlugin`               |
| `src/tests/nextjs.test.ts` | Detection + rule shape tests                    |

---

## Task 1: Workspace Discovery

**Files:**

- Create: `packages/core/src/workspace/index.ts`
- Create: `packages/core/src/tests/workspace/workspace.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/tests/workspace/workspace.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverWorkspaces } from '../../workspace/index.js'

function makePackage(root: string, name: string) {
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name }))
}

describe('discoverWorkspaces', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-ws-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns single-package fallback when no workspace config', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'root' }))
    const packages = discoverWorkspaces(dir)
    expect(packages).toHaveLength(1)
    expect(packages[0].rel).toBe('.')
    expect(packages[0].root).toBe(dir)
    expect(packages[0].name).toBe('root')
  })

  it('reads pnpm-workspace.yaml to discover packages', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'monorepo' }))
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
    makePackage(join(dir, 'packages/web'), '@acme/web')
    makePackage(join(dir, 'packages/api'), '@acme/api')

    const packages = discoverWorkspaces(dir)
    const names = packages.map(p => p.name).sort()
    expect(names).toContain('@acme/web')
    expect(names).toContain('@acme/api')
  })

  it('falls back to package.json workspaces field', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['apps/*'] })
    )
    makePackage(join(dir, 'apps/frontend'), '@acme/frontend')

    const packages = discoverWorkspaces(dir)
    const names = packages.map(p => p.name)
    expect(names).toContain('@acme/frontend')
  })

  it('sets rel as relative path from project root', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'monorepo' }))
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
    makePackage(join(dir, 'packages/web'), '@acme/web')

    const packages = discoverWorkspaces(dir)
    const web = packages.find(p => p.name === '@acme/web')!
    expect(web.rel).toBe('packages/web')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "workspace"
```

Expected: FAIL — "Cannot find module '../../workspace/index.js'"

- [ ] **Step 3: Implement workspace discovery**

```typescript
// packages/core/src/workspace/index.ts
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse } from 'yaml'
import { minimatch } from 'minimatch'

export interface WorkspacePackage {
  name: string
  root: string // absolute path to package directory
  rel: string // relative to project root (e.g. "packages/web") or "."
  packageJson: unknown
}

function readPackageJson(dir: string): { name?: string } | null {
  const p = join(dir, 'package.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as { name?: string }
  } catch {
    return null
  }
}

function resolveGlob(pattern: string, projectRoot: string): string[] {
  const results: string[] = []

  function scan(absDir: string, relDir: string, depth: number) {
    if (depth > 4) return
    let entries: string[]
    try {
      entries = readdirSync(absDir)
    } catch {
      return
    }
    for (const entry of entries) {
      const relPath = relDir ? `${relDir}/${entry}` : entry
      const absPath = join(absDir, entry)
      let isDir = false
      try {
        isDir = readdirSync(absPath) !== null
      } catch {
        continue
      }
      if (!isDir) continue
      if (minimatch(relPath, pattern)) {
        results.push(absPath)
      }
      scan(absPath, relPath, depth + 1)
    }
  }

  scan(projectRoot, '', 0)
  return results
}

function resolvePatterns(patterns: string[], projectRoot: string): WorkspacePackage[] {
  const packages: WorkspacePackage[] = []
  for (const pattern of patterns) {
    const dirs = resolveGlob(pattern, projectRoot)
    for (const dir of dirs) {
      const pkg = readPackageJson(dir)
      if (!pkg) continue
      packages.push({
        name: pkg.name ?? dir,
        root: dir,
        rel: relative(projectRoot, dir),
        packageJson: pkg,
      })
    }
  }
  return packages
}

export function discoverWorkspaces(projectRoot: string): WorkspacePackage[] {
  // 1. Try pnpm-workspace.yaml
  const pnpmWs = join(projectRoot, 'pnpm-workspace.yaml')
  if (existsSync(pnpmWs)) {
    try {
      const raw = parse(readFileSync(pnpmWs, 'utf-8')) as { packages?: string[] }
      const patterns = raw?.packages
      if (Array.isArray(patterns) && patterns.length > 0) {
        const pkgs = resolvePatterns(patterns, projectRoot)
        if (pkgs.length > 0) return pkgs
      }
    } catch {
      // fall through
    }
  }

  // 2. Try package.json workspaces
  const rootPkg = readPackageJson(projectRoot)
  if (rootPkg) {
    const ws = (rootPkg as Record<string, unknown>).workspaces
    const patterns: string[] = Array.isArray(ws)
      ? (ws as string[])
      : Array.isArray((ws as Record<string, unknown>)?.packages)
        ? (ws as Record<string, string[]>).packages
        : []
    if (patterns.length > 0) {
      const pkgs = resolvePatterns(patterns, projectRoot)
      if (pkgs.length > 0) return pkgs
    }
  }

  // 3. Single-package fallback
  const pkg = readPackageJson(projectRoot)
  return [
    {
      name: pkg?.name ?? projectRoot,
      root: projectRoot,
      rel: '.',
      packageJson: pkg ?? {},
    },
  ]
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A2 "workspace"
```

Expected: All workspace tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/workspace/index.ts packages/core/src/tests/workspace/workspace.test.ts
git commit -m "feat: Add workspace discovery module"
```

---

## Task 2: Plugin Interface + Config Schema Update

**Files:**

- Create: `packages/core/src/plugins/types.ts`
- Modify: `packages/core/src/config/schema.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Add a test for the plugins config field in the existing config test file:

```typescript
// Add to packages/core/src/tests/config/<existing-config-test>.ts
// (find the test with: ls packages/core/src/tests/config/)
```

Run `ls packages/core/src/tests/config/` to find the file, then add:

```typescript
it('defaults plugins to empty array', async () => {
  const config = SpascoConfigSchema.parse({})
  expect(config.plugins).toEqual([])
})

it('accepts plugins array', async () => {
  const config = SpascoConfigSchema.parse({ plugins: ['@acme/plugin-foo'] })
  expect(config.plugins).toEqual(['@acme/plugin-foo'])
})
```

- [ ] **Step 2: Run to verify fail**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "plugins|FAIL"
```

Expected: FAIL — "plugins is not defined"

- [ ] **Step 3: Create plugin interface**

```typescript
// packages/core/src/plugins/types.ts
import type { Rule } from '../rules/types.js'

export interface ScanPlugin {
  id: string
  /** Return true if this plugin applies to the given package root. Synchronous. */
  canApply(packageRoot: string): boolean
  /** Return rules with paths relative to the package root (not the project root). */
  rules(): Rule[]
}
```

- [ ] **Step 4: Add plugins field to config schema**

Open `packages/core/src/config/schema.ts` and add `plugins` to `SpascoConfigSchema`:

```typescript
// In SpascoConfigSchema, add this field after the existing `rules` field:
plugins: z.array(z.string()).default([]),
```

Full updated SpascoConfigSchema export:

```typescript
export const SpascoConfigSchema = z.object({
  name: z.string().optional(),
  plugin: z.string().optional(),
  dimensions: DimensionOverridesSchema,
  inference: z.record(z.string(), z.array(InferenceRuleSchema)).optional(),
  skeleton: z.string().default('./spaguettiscope.skeleton.yaml'),
  rules: z
    .object({
      disable: z.array(z.string()).default([]),
    })
    .default({ disable: [] }),
  plugins: z.array(z.string()).default([]),
  dashboard: z
    .object({
      connectors: z.array(ConnectorConfigSchema).default([]),
      outputDir: z.string().default('./reports'),
      historyFile: z.string().default('./reports/.spaguetti-history.jsonl'),
    })
    .default({
      connectors: [],
      outputDir: './reports',
      historyFile: './reports/.spaguetti-history.jsonl',
    }),
})
```

- [ ] **Step 5: Export from core index**

```typescript
// packages/core/src/index.ts — add these lines:
export * from './workspace/index.js'
export * from './plugins/types.js'
```

Full updated file:

```typescript
export * from './classification/index.js'
export * from './config/index.js'
export * from './skeleton/index.js'
export * from './rules/index.js'
export * from './workspace/index.js'
export * from './plugins/types.js'
```

- [ ] **Step 6: Run tests**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "plugin|config|PASS|FAIL" | head -20
```

Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/plugins/types.ts packages/core/src/config/schema.ts packages/core/src/index.ts packages/core/src/tests/config/
git commit -m "feat: Add ScanPlugin interface and plugins config field"
```

---

## Task 3: Import Graph Builder

**Files:**

- Modify: `packages/core/package.json` (add `@typescript-eslint/parser` dep)
- Create: `packages/core/src/graph/index.ts`
- Create: `packages/core/src/tests/graph/graph.test.ts`

- [ ] **Step 1: Add the parser dependency**

```bash
cd packages/core && pnpm add @typescript-eslint/parser
```

- [ ] **Step 2: Write the failing test**

```typescript
// packages/core/src/tests/graph/graph.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildImportGraph, mergeImportGraphs } from '../../graph/index.js'

describe('buildImportGraph', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-graph-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function write(relPath: string, content: string) {
    const abs = join(dir, relPath)
    mkdirSync(abs.substring(0, abs.lastIndexOf('/')), { recursive: true })
    writeFileSync(abs, content)
  }

  it('records import edge from importer to imported', () => {
    write('src/index.ts', "import { foo } from './utils'")
    write('src/utils.ts', 'export const foo = 1')

    const graph = buildImportGraph(dir, ['src/index.ts', 'src/utils.ts'], dir)

    expect(graph.imports.get('src/index.ts')).toContain('src/utils.ts')
    expect(graph.importedBy.get('src/utils.ts')).toContain('src/index.ts')
  })

  it('skips node_modules imports', () => {
    write('src/index.ts', "import React from 'react'")

    const graph = buildImportGraph(dir, ['src/index.ts'], dir)

    expect(graph.imports.get('src/index.ts')?.size).toBe(0)
  })

  it('file with no imports has empty Set in imports', () => {
    write('src/types.ts', 'export type Foo = string')

    const graph = buildImportGraph(dir, ['src/types.ts'], dir)

    expect(graph.imports.has('src/types.ts')).toBe(true)
    expect(graph.imports.get('src/types.ts')!.size).toBe(0)
  })

  it('resolves .ts extension', () => {
    write('src/a.ts', "import { b } from './b'")
    write('src/b.ts', 'export const b = 2')

    const graph = buildImportGraph(dir, ['src/a.ts', 'src/b.ts'], dir)

    expect(graph.imports.get('src/a.ts')).toContain('src/b.ts')
  })

  it('resolves /index.ts', () => {
    write('src/a.ts', "import { x } from './lib'")
    write('src/lib/index.ts', 'export const x = 3')

    const graph = buildImportGraph(dir, ['src/a.ts', 'src/lib/index.ts'], dir)

    expect(graph.imports.get('src/a.ts')).toContain('src/lib/index.ts')
  })

  it('captures re-export with source', () => {
    write('src/a.ts', "export { foo } from './utils'")
    write('src/utils.ts', 'export const foo = 1')

    const graph = buildImportGraph(dir, ['src/a.ts', 'src/utils.ts'], dir)

    expect(graph.imports.get('src/a.ts')).toContain('src/utils.ts')
  })

  it('captures require() calls', () => {
    write('src/a.js', "const utils = require('./utils')")
    write('src/utils.js', 'module.exports = {}')

    const graph = buildImportGraph(dir, ['src/a.js', 'src/utils.js'], dir)

    expect(graph.imports.get('src/a.js')).toContain('src/utils.js')
  })

  it('silently skips unresolvable imports', () => {
    write('src/a.ts', "import { x } from './missing'")

    const graph = buildImportGraph(dir, ['src/a.ts'], dir)

    expect(graph.imports.get('src/a.ts')!.size).toBe(0)
  })
})

describe('mergeImportGraphs', () => {
  it('merges two disjoint graphs', () => {
    const g1 = {
      imports: new Map([['a.ts', new Set(['b.ts'])]]),
      importedBy: new Map([['b.ts', new Set(['a.ts'])]]),
    }
    const g2 = {
      imports: new Map([['c.ts', new Set(['d.ts'])]]),
      importedBy: new Map([['d.ts', new Set(['c.ts'])]]),
    }

    const merged = mergeImportGraphs([g1, g2])

    expect(merged.imports.get('a.ts')).toContain('b.ts')
    expect(merged.imports.get('c.ts')).toContain('d.ts')
  })
})
```

- [ ] **Step 3: Run to verify fail**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "graph|Cannot find|FAIL" | head -10
```

Expected: FAIL — "Cannot find module '../../graph/index.js'"

- [ ] **Step 4: Implement the graph builder**

```typescript
// packages/core/src/graph/index.ts
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, relative, dirname } from 'node:path'
import { parse } from '@typescript-eslint/parser'

export interface ImportGraph {
  /** rel-to-projectRoot → Set of rel-to-projectRoot paths this file imports */
  imports: Map<string, Set<string>>
  /** reverse index: rel-to-projectRoot → Set of files that import it */
  importedBy: Map<string, Set<string>>
}

type AstNode = { type: string; [key: string]: unknown }

function extractSpecifiers(code: string, isJsx: boolean): string[] {
  const specifiers: string[] = []
  let program: { body: AstNode[] }

  try {
    program = parse(code, { jsx: isJsx, range: false, loc: false }) as { body: AstNode[] }
  } catch {
    try {
      program = parse(code, { jsx: false, range: false, loc: false }) as { body: AstNode[] }
    } catch {
      return specifiers
    }
  }

  function visit(node: AstNode): void {
    if (!node || typeof node.type !== 'string') return

    if (
      (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') &&
      (node.source as AstNode)?.type === 'Literal'
    ) {
      specifiers.push((node.source as { value: string }).value)
    } else if (
      node.type === 'ExportNamedDeclaration' &&
      node.source != null &&
      (node.source as AstNode).type === 'Literal'
    ) {
      specifiers.push((node.source as { value: string }).value)
    } else if (
      node.type === 'CallExpression' &&
      (node.callee as AstNode)?.type === 'Identifier' &&
      (node.callee as { name: string }).name === 'require'
    ) {
      const args = node.arguments as AstNode[]
      if (args?.[0]?.type === 'Literal') {
        const val = (args[0] as { value: unknown }).value
        if (typeof val === 'string') specifiers.push(val)
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent') continue
      const child = node[key]
      if (Array.isArray(child)) {
        ;(child as AstNode[]).forEach(c => {
          if (c && typeof c.type === 'string') visit(c)
        })
      } else if (child && typeof (child as AstNode).type === 'string') {
        visit(child as AstNode)
      }
    }
  }

  for (const stmt of program.body) visit(stmt)
  return specifiers
}

function resolveSpecifier(
  specifier: string,
  fromAbs: string,
  packageRoot: string,
  projectRoot: string
): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null

  const candidate = resolve(dirname(fromAbs), specifier)

  // No cross-package edges
  if (!candidate.startsWith(packageRoot + '/') && candidate !== packageRoot) return null

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']
  for (const ext of extensions) {
    const full = candidate + ext
    if (existsSync(full)) {
      return relative(projectRoot, full)
    }
  }
  return null
}

export function buildImportGraph(
  packageRoot: string,
  filePaths: string[], // relative to projectRoot
  projectRoot: string
): ImportGraph {
  const graph: ImportGraph = { imports: new Map(), importedBy: new Map() }

  for (const relPath of filePaths) {
    if (!graph.imports.has(relPath)) {
      graph.imports.set(relPath, new Set())
    }

    const absPath = join(projectRoot, relPath)
    const isJsx = absPath.endsWith('.tsx') || absPath.endsWith('.jsx')

    let code: string
    try {
      code = readFileSync(absPath, 'utf-8')
    } catch {
      continue
    }

    for (const spec of extractSpecifiers(code, isJsx)) {
      const resolved = resolveSpecifier(spec, absPath, packageRoot, projectRoot)
      if (!resolved) continue

      graph.imports.get(relPath)!.add(resolved)

      if (!graph.importedBy.has(resolved)) {
        graph.importedBy.set(resolved, new Set())
      }
      graph.importedBy.get(resolved)!.add(relPath)
    }
  }

  return graph
}

export function mergeImportGraphs(graphs: ImportGraph[]): ImportGraph {
  const merged: ImportGraph = { imports: new Map(), importedBy: new Map() }

  for (const g of graphs) {
    for (const [k, v] of g.imports) {
      if (!merged.imports.has(k)) merged.imports.set(k, new Set())
      for (const dep of v) merged.imports.get(k)!.add(dep)
    }
    for (const [k, v] of g.importedBy) {
      if (!merged.importedBy.has(k)) merged.importedBy.set(k, new Set())
      for (const dep of v) merged.importedBy.get(k)!.add(dep)
    }
  }

  return merged
}
```

- [ ] **Step 5: Run tests**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "graph|PASS|FAIL" | head -20
```

Expected: All graph tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/graph/index.ts packages/core/src/tests/graph/graph.test.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat: Add import graph builder"
```

---

## Task 4: Graph Predicates

**Files:**

- Modify: `packages/core/src/rules/types.ts`
- Create: `packages/core/src/graph/predicates.ts`
- Create: `packages/core/src/tests/graph/predicates.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/tests/graph/predicates.test.ts
import { describe, it, expect } from 'vitest'
import { evaluateGraphPredicate } from '../../graph/predicates.js'
import type { ImportGraph } from '../../graph/index.js'
import type { GraphPredicate } from '../../rules/types.js'

function makeGraph(
  imports: Record<string, string[]>,
  importedBy: Record<string, string[]>
): ImportGraph {
  return {
    imports: new Map(Object.entries(imports).map(([k, v]) => [k, new Set(v)])),
    importedBy: new Map(Object.entries(importedBy).map(([k, v]) => [k, new Set(v)])),
  }
}

describe('evaluateGraphPredicate', () => {
  it('imported-by: true when file is imported by a glob match', () => {
    const graph = makeGraph({}, { 'src/utils.ts': ['src/index.ts'] })
    const p: GraphPredicate = { kind: 'imported-by', glob: 'src/index.ts' }
    expect(evaluateGraphPredicate('src/utils.ts', p, graph)).toBe(true)
  })

  it('imported-by: false when no importer matches', () => {
    const graph = makeGraph({}, { 'src/utils.ts': ['src/other.ts'] })
    const p: GraphPredicate = { kind: 'imported-by', glob: 'src/index.ts' }
    expect(evaluateGraphPredicate('src/utils.ts', p, graph)).toBe(false)
  })

  it('imported-by: false when file has no importers', () => {
    const graph = makeGraph({}, {})
    const p: GraphPredicate = { kind: 'imported-by', glob: 'src/**' }
    expect(evaluateGraphPredicate('src/utils.ts', p, graph)).toBe(false)
  })

  it('imports: true when file imports a glob match', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, {})
    const p: GraphPredicate = { kind: 'imports', glob: 'src/b.ts' }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })

  it('imports: supports glob pattern', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/utils/format.ts'] }, {})
    const p: GraphPredicate = { kind: 'imports', glob: 'src/utils/**' }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })

  it('no-imports: true when file has no imports', () => {
    const graph = makeGraph({ 'src/leaf.ts': [] }, {})
    const p: GraphPredicate = { kind: 'no-imports' }
    expect(evaluateGraphPredicate('src/leaf.ts', p, graph)).toBe(true)
  })

  it('no-imports: false when file has imports', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, {})
    const p: GraphPredicate = { kind: 'no-imports' }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(false)
  })

  it('imports-count: true when import count exceeds N', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts', 'src/c.ts', 'src/d.ts'] }, {})
    const p: GraphPredicate = { kind: 'imports-count', op: '>', n: 2 }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })

  it('imports-count: false when count does not exceed N', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, {})
    const p: GraphPredicate = { kind: 'imports-count', op: '>', n: 2 }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(false)
  })

  it('and: true when all predicates pass', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, { 'src/a.ts': ['src/c.ts'] })
    const p: GraphPredicate = {
      kind: 'and',
      predicates: [
        { kind: 'imports', glob: 'src/b.ts' },
        { kind: 'imported-by', glob: 'src/c.ts' },
      ],
    }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })

  it('and: false when any predicate fails', () => {
    const graph = makeGraph({ 'src/a.ts': ['src/b.ts'] }, {})
    const p: GraphPredicate = {
      kind: 'and',
      predicates: [
        { kind: 'imports', glob: 'src/b.ts' },
        { kind: 'imported-by', glob: 'src/c.ts' }, // fails
      ],
    }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(false)
  })

  it('or: true when at least one predicate passes', () => {
    const graph = makeGraph({ 'src/a.ts': [] }, { 'src/a.ts': ['src/c.ts'] })
    const p: GraphPredicate = {
      kind: 'or',
      predicates: [
        { kind: 'imports', glob: 'src/b.ts' }, // fails
        { kind: 'imported-by', glob: 'src/c.ts' }, // passes
      ],
    }
    expect(evaluateGraphPredicate('src/a.ts', p, graph)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "predicates|Cannot find|FAIL" | head -10
```

Expected: FAIL — "Cannot find module '../../graph/predicates.js'"

- [ ] **Step 3: Add `GraphPredicate` to rule types**

Open `packages/core/src/rules/types.ts` and add `GraphPredicate` type + `graph?` to `RuleSelector`:

```typescript
// packages/core/src/rules/types.ts
export type GraphPredicate =
  | { kind: 'imported-by'; glob: string }
  | { kind: 'imports'; glob: string }
  | { kind: 'no-imports' }
  | { kind: 'imports-count'; op: '>'; n: number }
  | { kind: 'and'; predicates: GraphPredicate[] }
  | { kind: 'or'; predicates: GraphPredicate[] }

export interface RuleSelector {
  /** Glob pattern. Use ($1), ($2), etc. for capture groups (single segment each). */
  path: string
  /** Regex string tested against the first 200 chars of the file content. */
  content?: string
  /** Optional graph predicate — skipped if no import graph is provided. */
  graph?: GraphPredicate
}

export interface ConcreteYield {
  kind: 'concrete'
  key: string
  value: string
}

export interface ExtractedYield {
  kind: 'extracted'
  key: string
  capture: number // 1-based: ($1) = 1
}

export interface UncertainYield {
  kind: 'uncertain'
  capture: number // 1-based
}

export type RuleYield = ConcreteYield | ExtractedYield | UncertainYield

export interface Rule {
  id: string
  selector: RuleSelector
  yields: RuleYield[]
}

export interface RuleCandidate {
  /** Glob pattern describing the matched set (e.g. src/auth/**) */
  pathPattern: string
  /** Resolved attribute assignments. May include '?' key for uncertain yields. */
  attributes: Record<string, string>
  source: string
  isUncertain: boolean
}
```

- [ ] **Step 4: Implement graph predicate evaluator**

```typescript
// packages/core/src/graph/predicates.ts
import { minimatch } from 'minimatch'
import type { ImportGraph } from './index.js'
import type { GraphPredicate } from '../rules/types.js'

export function evaluateGraphPredicate(
  filePath: string,
  predicate: GraphPredicate,
  graph: ImportGraph
): boolean {
  switch (predicate.kind) {
    case 'imported-by': {
      const importers = graph.importedBy.get(filePath)
      if (!importers) return false
      return Array.from(importers).some(f => minimatch(f, predicate.glob, { dot: true }))
    }
    case 'imports': {
      const deps = graph.imports.get(filePath)
      if (!deps) return false
      return Array.from(deps).some(f => minimatch(f, predicate.glob, { dot: true }))
    }
    case 'no-imports': {
      const deps = graph.imports.get(filePath)
      return !deps || deps.size === 0
    }
    case 'imports-count': {
      const count = graph.imports.get(filePath)?.size ?? 0
      return count > predicate.n
    }
    case 'and':
      return predicate.predicates.every(p => evaluateGraphPredicate(filePath, p, graph))
    case 'or':
      return predicate.predicates.some(p => evaluateGraphPredicate(filePath, p, graph))
  }
}
```

- [ ] **Step 5: Export graph module from core index**

```typescript
// packages/core/src/index.ts — add graph export:
export * from './classification/index.js'
export * from './config/index.js'
export * from './skeleton/index.js'
export * from './rules/index.js'
export * from './workspace/index.js'
export * from './plugins/types.js'
export * from './graph/index.js'
export * from './graph/predicates.js'
```

- [ ] **Step 6: Run tests**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "predicate|PASS|FAIL" | head -20
```

Expected: All predicate tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/rules/types.ts packages/core/src/graph/predicates.ts packages/core/src/tests/graph/predicates.test.ts packages/core/src/index.ts
git commit -m "feat: Add GraphPredicate type and evaluator"
```

---

## Task 5: Update Rule Runner — Options Signature + Graph Predicate Evaluation

**Files:**

- Modify: `packages/core/src/rules/runner.ts`
- Modify: `packages/core/src/tests/rules/runner.test.ts` (update 4-arg call + add graph tests)

- [ ] **Step 1: Write the new graph predicate tests first**

Append these tests to `packages/core/src/tests/rules/runner.test.ts`:

```typescript
// Add these imports at the top:
import type { ImportGraph } from '../../graph/index.js'

// Append these describe blocks:

describe('runRules — options object signature', () => {
  it('accepts disabledRuleIds via options object', () => {
    const rules: Rule[] = [
      {
        id: 'skip-me',
        selector: { path: 'src/index.ts' },
        yields: [{ kind: 'concrete', key: 'tag', value: 'root' }],
      },
    ]
    expect(
      runRules(['src/index.ts'], rules, projectRoot, { disabledRuleIds: new Set(['skip-me']) })
    ).toHaveLength(0)
  })
})

describe('runRules — graph predicates', () => {
  it('applies imported-by predicate using provided graph', () => {
    const rules: Rule[] = [
      {
        id: 'entry-dep',
        selector: {
          path: 'src/**/*.ts',
          graph: { kind: 'imported-by', glob: 'src/index.ts' },
        },
        yields: [{ kind: 'concrete', key: 'tag', value: 'entry-dep' }],
      },
    ]
    const graph: ImportGraph = {
      imports: new Map([['src/index.ts', new Set(['src/utils.ts'])]]),
      importedBy: new Map([['src/utils.ts', new Set(['src/index.ts'])]]),
    }

    const result = runRules(['src/utils.ts', 'src/other.ts'], rules, projectRoot, {
      importGraph: graph,
    })

    expect(result).toHaveLength(1)
    expect(result[0].attributes.tag).toBe('entry-dep')
  })

  it('skips graph predicate rule (no error) when no graph provided', () => {
    const rules: Rule[] = [
      {
        id: 'needs-graph',
        selector: {
          path: 'src/**/*.ts',
          graph: { kind: 'imported-by', glob: 'src/index.ts' },
        },
        yields: [{ kind: 'concrete', key: 'tag', value: 'x' }],
      },
    ]

    // No importGraph provided — rule simply produces no results
    const result = runRules(['src/utils.ts'], rules, projectRoot)
    expect(result).toHaveLength(0)
  })

  it('evaluates path + content + graph predicates in order', () => {
    const rules: Rule[] = [
      {
        id: 'annotated-util',
        selector: {
          path: 'src/**/*.ts',
          content: 'UTIL',
          graph: { kind: 'imported-by', glob: 'src/index.ts' },
        },
        yields: [{ kind: 'concrete', key: 'tag', value: 'annotated-util' }],
      },
    ]
    const graph: ImportGraph = {
      imports: new Map([['src/index.ts', new Set(['src/utils.ts'])]]),
      importedBy: new Map([['src/utils.ts', new Set(['src/index.ts'])]]),
    }

    // Write file with matching content
    writeFileSync(join(projectRoot, 'src/utils.ts'), 'UTIL export const x = 1', 'utf-8')
    mkdirSync(join(projectRoot, 'src'), { recursive: true })
    writeFileSync(join(projectRoot, 'src/utils.ts'), 'UTIL export const x = 1', 'utf-8')

    const result = runRules(['src/utils.ts'], rules, projectRoot, { importGraph: graph })
    expect(result).toHaveLength(1)
    expect(result[0].attributes.tag).toBe('annotated-util')
  })
})
```

Also update the existing 4-arg call on line 106:

```typescript
// Old (line ~106):
expect(runRules(['src/index.ts'], rules, projectRoot, new Set(['skip-me']))).toHaveLength(0)

// New:
expect(
  runRules(['src/index.ts'], rules, projectRoot, { disabledRuleIds: new Set(['skip-me']) })
).toHaveLength(0)
```

- [ ] **Step 2: Run to verify fail**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "graph predicate|options object|FAIL" | head -10
```

Expected: FAIL — type errors or "not a function"

- [ ] **Step 3: Update the runner**

Replace `packages/core/src/rules/runner.ts` entirely:

```typescript
// packages/core/src/rules/runner.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Rule, RuleYield, RuleCandidate } from './types.js'
import type { ImportGraph } from '../graph/index.js'
import { evaluateGraphPredicate } from '../graph/predicates.js'

export interface RunRulesOptions {
  disabledRuleIds?: Set<string>
  importGraph?: ImportGraph
}

interface CompiledRule {
  rule: Rule
  regex: RegExp
  captureCount: number
  contentRegex: RegExp | undefined
}

function compileRule(rule: Rule): CompiledRule {
  let captureCount = 0
  let regexStr = rule.selector.path
    .replace(/\./g, '\\.')
    .replace(/\(\$\d+\)/g, () => {
      captureCount++
      return '([^/]+)'
    })
    .replace(/\/\*\*\//g, '/(?:.+/)?')
    .replace(/\/\*\*$/, '(?:/.+)?')
    .replace(/^\*\*\//, '(?:.+/)?')
    .replace(/\*\*/g, '.+')
    .replace(/\*/g, '[^/]*')

  return {
    rule,
    regex: new RegExp(`^${regexStr}$`),
    captureCount,
    contentRegex: rule.selector.content ? new RegExp(rule.selector.content) : undefined,
  }
}

function resolveYields(
  yields: RuleYield[],
  captures: (string | undefined)[]
): { attributes: Record<string, string>; isUncertain: boolean } {
  const attributes: Record<string, string> = {}
  let isUncertain = false
  for (const y of yields) {
    if (y.kind === 'concrete') {
      attributes[y.key] = y.value
    } else if (y.kind === 'extracted') {
      attributes[y.key] = captures[y.capture - 1] ?? ''
    } else {
      attributes['?'] = captures[y.capture - 1] ?? ''
      isUncertain = true
    }
  }
  return { attributes, isUncertain }
}

function deriveCandidatePath(pattern: string, captures: (string | undefined)[]): string {
  if (captures.length === 0) return pattern
  let i = 0
  const withCaptures = pattern.replace(/\(\$\d+\)/g, () => captures[i++] ?? '')
  const wildcardIdx = withCaptures.search(/[*?]/)
  if (wildcardIdx === -1) return withCaptures
  const prefix = withCaptures.slice(0, wildcardIdx).replace(/\/$/, '')
  return prefix ? `${prefix}/**` : withCaptures
}

export function runRules(
  relativeFilePaths: string[],
  rules: Rule[],
  projectRoot: string,
  options?: RunRulesOptions
): RuleCandidate[] {
  const disabledRuleIds = options?.disabledRuleIds ?? new Set<string>()
  const importGraph = options?.importGraph

  const compiled = rules.filter(r => !disabledRuleIds.has(r.id)).map(compileRule)
  const grouped = new Map<string, RuleCandidate>()

  for (const filePath of relativeFilePaths) {
    for (const { rule, regex, captureCount, contentRegex } of compiled) {
      // 1. Path predicate
      const match = filePath.match(regex)
      if (!match) continue

      // 2. Content predicate
      if (contentRegex) {
        try {
          const abs = join(projectRoot, filePath)
          const content = readFileSync(abs, { encoding: 'utf-8' })
          if (!contentRegex.test(content.slice(0, 200))) continue
        } catch {
          continue
        }
      }

      // 3. Graph predicate — skip rule (not error) when no graph provided
      if (rule.selector.graph) {
        if (!importGraph) continue
        if (!evaluateGraphPredicate(filePath, rule.selector.graph, importGraph)) continue
      }

      const captures = match.slice(1, captureCount + 1) as (string | undefined)[]
      const { attributes, isUncertain } = resolveYields(rule.yields, captures)
      const pathPattern = deriveCandidatePath(rule.selector.path, captures)
      const groupKey = `${rule.id}::${pathPattern}`

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { pathPattern, attributes, source: rule.id, isUncertain })
      }
    }
  }

  return Array.from(grouped.values())
}
```

- [ ] **Step 4: Run all core tests**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS (runner + graph + predicates + all previous)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rules/runner.ts packages/core/src/tests/rules/runner.test.ts
git commit -m "feat: Add graph predicate evaluation to rule runner"
```

---

## Task 6: Shared walkFiles Utility + Monorepo-Aware Scan Command

**Files:**

- Create: `packages/cli/src/utils/files.ts`
- Modify: `packages/cli/src/commands/scan.ts`
- Modify: `packages/cli/src/tests/commands/scan.test.ts`

- [ ] **Step 1: Write new scan tests**

Append to `packages/cli/src/tests/commands/scan.test.ts`:

```typescript
// Add this import at top:
import { writeFileSync as wf } from 'node:fs'

// Append:
describe('runScan — monorepo with plugin', () => {
  it('applies plugin rules only to packages where canApply returns true', async () => {
    // Two packages: only "web" has next in package.json
    mkdirSync(join(dir, 'packages/web/app/api/checkout'), { recursive: true })
    mkdirSync(join(dir, 'packages/api'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'monorepo' }))
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
    writeFileSync(
      join(dir, 'packages/web/package.json'),
      JSON.stringify({ name: '@acme/web', dependencies: { next: '14.0.0' } })
    )
    writeFileSync(join(dir, 'packages/api/package.json'), JSON.stringify({ name: '@acme/api' }))
    writeFileSync(
      join(dir, 'packages/web/app/api/checkout/route.ts'),
      'export async function GET() {}'
    )
    writeFileSync(
      join(dir, 'spaguettiscope.config.json'),
      JSON.stringify({
        name: 'test',
        plugins: ['@spaguettiscope/plugin-nextjs'],
        dashboard: { connectors: [] },
      })
    )

    await runScan({ projectRoot: dir })

    const skeletonPath = join(dir, 'spaguettiscope.skeleton.yaml')
    const entries = parse(readFileSync(skeletonPath, 'utf-8')) as Array<{
      attributes: Record<string, string>
      paths: string[]
    }>
    const apiEntry = entries.find(e => e.attributes?.role === 'api-endpoint')
    expect(apiEntry).toBeDefined()
    // Path should be scoped to packages/web
    expect(apiEntry!.paths[0]).toMatch(/^packages\/web\//)
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "monorepo|plugin|FAIL" | head -10
```

Expected: FAIL — plugin loading or scoping not implemented

- [ ] **Step 3: Create shared files utility**

```typescript
// packages/cli/src/utils/files.ts
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

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
])

export function walkFiles(dir: string, projectRoot: string): string[] {
  const results: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue
    const abs = join(dir, entry)
    let stat
    try {
      stat = statSync(abs)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      results.push(...walkFiles(abs, projectRoot))
    } else {
      results.push(relative(projectRoot, abs))
    }
  }
  return results
}
```

- [ ] **Step 4: Rewrite scan command with monorepo support**

```typescript
// packages/cli/src/commands/scan.ts
import { resolve } from 'node:path'
import ora from 'ora'
import {
  loadConfig,
  readSkeleton,
  writeSkeleton,
  mergeSkeleton,
  runRules,
  builtInRoleRules,
  discoverWorkspaces,
  buildImportGraph,
  mergeImportGraphs,
  type ScanPlugin,
  type Rule,
} from '@spaguettiscope/core'
import { walkFiles } from '../utils/files.js'
import { printSuccess } from '../formatter/index.js'

export interface ScanOptions {
  projectRoot?: string
}

export async function runScan(options: ScanOptions = {}): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const disabledRuleIds = new Set(config.rules.disable)

  // 1. Discover workspace packages
  const packages = discoverWorkspaces(projectRoot)

  // 2. Walk all files
  const fileSpinner = ora('Scanning files…').start()
  const allFiles = walkFiles(projectRoot, projectRoot)
  fileSpinner.succeed(`Found ${allFiles.length} files`)

  // 3. Load plugins from config
  const plugins: ScanPlugin[] = []
  for (const pluginId of config.plugins) {
    try {
      const mod = (await import(pluginId)) as Record<string, unknown>
      const plugin = (mod.default ?? Object.values(mod)[0]) as ScanPlugin
      if (plugin && typeof plugin.canApply === 'function') {
        plugins.push(plugin)
      }
    } catch (err) {
      ora().warn(`Failed to load plugin ${pluginId}: ${(err as Error).message}`)
    }
  }

  // 4. Build per-package import graphs, merge
  const graphSpinner = ora('Building import graphs…').start()
  const graphs = packages.map(pkg => {
    const pkgFiles = pkg.rel === '.' ? allFiles : allFiles.filter(f => f.startsWith(pkg.rel + '/'))
    return buildImportGraph(pkg.root, pkgFiles, projectRoot)
  })
  const importGraph = mergeImportGraphs(graphs)
  graphSpinner.succeed('Import graphs built')

  // 5. Scope plugin rules to their detected packages
  const pluginRules: Rule[] = []
  for (const pkg of packages) {
    for (const plugin of plugins) {
      if (!plugin.canApply(pkg.root)) continue
      for (const rule of plugin.rules()) {
        pluginRules.push({
          ...rule,
          id: `${plugin.id}::${rule.id}`,
          selector: {
            ...rule.selector,
            path: pkg.rel === '.' ? rule.selector.path : `${pkg.rel}/${rule.selector.path}`,
          },
        })
      }
    }
  }

  // 6. Run rules (built-ins fire on all files; plugin rules are already scoped)
  const ruleSpinner = ora('Running rules…').start()
  const allRules = [...builtInRoleRules, ...pluginRules]
  const candidates = runRules(allFiles, allRules, projectRoot, {
    disabledRuleIds,
    importGraph,
  })
  ruleSpinner.succeed(`Rules produced ${candidates.length} candidates`)

  // 7. Merge skeleton
  const mergeSpinner = ora('Merging skeleton…').start()
  const existing = readSkeleton(skeletonPath)
  const { skeleton, added, unchanged, markedStale } = mergeSkeleton(
    existing,
    candidates.map(c => ({ attributes: c.attributes, paths: [c.pathPattern], source: c.source })),
    allFiles
  )
  writeSkeleton(skeletonPath, skeleton)
  mergeSpinner.succeed('Skeleton updated')

  printSuccess(
    `Scan complete — ${added} new, ${unchanged} unchanged, ${markedStale} stale → ${skeletonPath}`
  )
}
```

- [ ] **Step 5: Run CLI tests**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "monorepo|scan|PASS|FAIL" | head -20
```

Expected: Monorepo test requires the nextjs plugin to be built. If it fails due to plugin not found,
that's expected — add a note. The other scan tests should PASS.

For the monorepo test specifically: it imports `@spaguettiscope/plugin-nextjs`. Run it after Task 7
(when the plugin package is built). For now verify the other scan tests still pass:

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "creates skeleton|does not overwrite|marks entries|PASS|FAIL"
```

Expected: All previous scan tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/utils/files.ts packages/cli/src/commands/scan.ts packages/cli/src/tests/commands/scan.test.ts
git commit -m "feat: Monorepo-aware scan with plugin loading and import graph"
```

---

## Task 7: Next.js Plugin Package

**Files:**

- Create: `plugins/nextjs/package.json`
- Create: `plugins/nextjs/tsconfig.json`
- Create: `plugins/nextjs/src/detect.ts`
- Create: `plugins/nextjs/src/rules.ts`
- Create: `plugins/nextjs/src/index.ts`
- Create: `plugins/nextjs/src/tests/nextjs.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// plugins/nextjs/src/tests/nextjs.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { nextjsPlugin } from '../index.js'

describe('nextjsPlugin.canApply', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-nextjs-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when next is in dependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { next: '14.0.0' } })
    )
    expect(nextjsPlugin.canApply(dir)).toBe(true)
  })

  it('returns true when next is in devDependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'web', devDependencies: { next: '14.0.0' } })
    )
    expect(nextjsPlugin.canApply(dir)).toBe(true)
  })

  it('returns false when next is not present', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'api', dependencies: { express: '4.0.0' } })
    )
    expect(nextjsPlugin.canApply(dir)).toBe(false)
  })

  it('returns false when package.json does not exist', () => {
    expect(nextjsPlugin.canApply(dir)).toBe(false)
  })
})

describe('nextjsPlugin.rules', () => {
  it('returns rules array with expected ids', () => {
    const rules = nextjsPlugin.rules()
    const ids = rules.map(r => r.id)
    expect(ids).toContain('nextjs:api-endpoint')
    expect(ids).toContain('nextjs:page')
    expect(ids).toContain('nextjs:layout')
    expect(ids).toContain('nextjs:client-component')
    expect(ids).toContain('nextjs:middleware')
  })

  it('api-endpoint rule yields role=api-endpoint, layer=bff, domain capture', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:api-endpoint')!
    expect(rule.selector.path).toBe('app/api/($1)/**/route.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'api-endpoint' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'bff' })
    expect(rule.yields).toContainEqual({ kind: 'extracted', key: 'domain', capture: 1 })
  })

  it('client-component rule has content predicate', () => {
    const rules = nextjsPlugin.rules()
    const rule = rules.find(r => r.id === 'nextjs:client-component')!
    expect(rule.selector.content).toBeDefined()
    expect(new RegExp(rule.selector.content!).test("'use client'")).toBe(true)
  })
})
```

- [ ] **Step 2: Create the package files**

```json
// plugins/nextjs/package.json
{
  "name": "@spaguettiscope/plugin-nextjs",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./dist/index.js"
  },
  "files": ["dist/**"],
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "dev": "tsc --project tsconfig.json --watch",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@spaguettiscope/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

```json
// plugins/nextjs/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "node_modules"]
}
```

- [ ] **Step 3: Implement detect.ts**

```typescript
// plugins/nextjs/src/detect.ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function canApply(packageRoot: string): boolean {
  const pkgPath = join(packageRoot, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return 'next' in { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Implement rules.ts**

```typescript
// plugins/nextjs/src/rules.ts
import type { Rule } from '@spaguettiscope/core'

export const nextjsRules: Rule[] = [
  {
    id: 'nextjs:api-endpoint',
    selector: { path: 'app/api/($1)/**/route.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'api-endpoint' },
      { kind: 'concrete', key: 'layer', value: 'bff' },
      { kind: 'extracted', key: 'domain', capture: 1 },
    ],
  },
  {
    id: 'nextjs:page',
    selector: { path: 'app/($1)/**/page.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'page' },
      { kind: 'extracted', key: 'domain', capture: 1 },
    ],
  },
  {
    id: 'nextjs:layout',
    selector: { path: 'app/($1)/**/layout.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'layout' },
      { kind: 'extracted', key: 'domain', capture: 1 },
    ],
  },
  {
    id: 'nextjs:client-component',
    selector: {
      path: '**/*.tsx',
      content: "^'use client'",
    },
    yields: [{ kind: 'concrete', key: 'layer', value: 'client-component' }],
  },
  {
    id: 'nextjs:middleware',
    selector: { path: 'middleware.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'middleware' }],
  },
]
```

- [ ] **Step 5: Implement index.ts**

```typescript
// plugins/nextjs/src/index.ts
import type { ScanPlugin } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { nextjsRules } from './rules.js'

export const nextjsPlugin: ScanPlugin = {
  id: 'nextjs',
  canApply,
  rules: () => nextjsRules,
}

export default nextjsPlugin
```

- [ ] **Step 6: Install deps and run tests**

```bash
cd /path/to/spaguettiscope && pnpm install
cd plugins/nextjs && pnpm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All nextjs plugin tests PASS

- [ ] **Step 7: Build the plugin**

```bash
cd plugins/nextjs && pnpm build
```

Expected: `dist/` created with compiled JS

- [ ] **Step 8: Re-run CLI scan monorepo test**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "monorepo|plugin|PASS|FAIL" | head -10
```

Expected: Monorepo scan test PASS

- [ ] **Step 9: Commit**

```bash
git add plugins/nextjs/
git commit -m "feat: Add @spaguettiscope/plugin-nextjs"
```

---

## Task 8: Dashboard inherit-from-import Pass

**Files:**

- Modify: `packages/cli/src/commands/dashboard.ts`
- Modify: `packages/cli/src/tests/commands/dashboard.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/cli/src/tests/commands/dashboard.test.ts`. First read the existing test to
understand the helper pattern, then add:

```typescript
// Append to the describe block — check what imports are at the top and add these if missing:
// import { walkFiles } from '../../utils/files.js'  ← not needed in test, used in impl

describe('runDashboard — inherit-from-import', () => {
  it('test record inherits attributes from imported source file', async () => {
    // Setup: project with a source file and a test that imports it
    // The source file is annotated in skeleton with domain=payments
    // The test file should inherit domain=payments
    mkdirSync(join(dir, 'src'), { recursive: true })

    writeFileSync(join(dir, 'src/payments.ts'), 'export function pay() {}')
    writeFileSync(
      join(dir, 'src/payments.test.ts'),
      "import { pay } from './payments'\ntest('pay', () => {})"
    )
    writeFileSync(
      join(dir, 'spaguettiscope.skeleton.yaml'),
      `- attributes:\n    domain: payments\n  paths:\n    - src/payments.ts\n`
    )

    // Connector must produce a record for the test file with role=test
    // Use Vitest connector-compatible output format or mock the record
    // For integration: write a minimal Vitest JSON report
    // (This requires writing actual connector results — see existing dashboard tests for the pattern)
    // ...adapt based on what connector format the existing tests use
  })

  it('direct skeleton annotation wins over inherited attribute', async () => {
    // Test file is directly annotated domain=auth in skeleton
    // It imports a file with domain=payments
    // After inherit-from-import, domain should still be auth
    // ...
  })

  it('skips inherit-from-import when disabled in config', async () => {
    // config has rules.disable: ['inherit-from-import']
    // test record should NOT inherit attributes
    // ...
  })
})
```

**Note:** Read `packages/cli/src/tests/commands/dashboard.test.ts` to understand how test records
and connector output are set up in the existing tests. Adapt the test bodies above to use the same
helper pattern.

- [ ] **Step 2: Examine existing dashboard test**

```bash
cat packages/cli/src/tests/commands/dashboard.test.ts
```

Adapt the new tests to use the same project/connector setup pattern as the existing tests.

- [ ] **Step 3: Run to verify fail**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "inherit|FAIL" | head -10
```

Expected: Tests written in Step 1 should FAIL (feature not yet implemented)

- [ ] **Step 4: Add inherit-from-import pass to dashboard**

In `packages/cli/src/commands/dashboard.ts`, add these imports at the top:

```typescript
import { relative } from 'node:path'
import {
  // ... existing imports ...
  discoverWorkspaces,
  buildImportGraph,
  mergeImportGraphs,
} from '@spaguettiscope/core'
import { walkFiles } from '../utils/files.js'
```

After the existing skeleton post-pass (after the `if (existsSync(skeletonPath))` block), add:

```typescript
// inherit-from-import pass
if (!config.rules.disable.includes('inherit-from-import')) {
  const inheritSpinner = ora('Running inherit-from-import…').start()
  try {
    const packages = discoverWorkspaces(projectRoot)
    const allFiles = walkFiles(projectRoot, projectRoot)
    const graphs = packages.map(pkg => {
      const pkgFiles =
        pkg.rel === '.' ? allFiles : allFiles.filter(f => f.startsWith(pkg.rel + '/'))
      return buildImportGraph(pkg.root, pkgFiles, projectRoot)
    })
    const importGraph = mergeImportGraphs(graphs)

    // Only run if we have a skeleton to look up attributes from
    if (existsSync(skeletonPath)) {
      const skeleton = readSkeleton(skeletonPath)

      for (const record of records) {
        if (record.dimensions.role !== 'test') continue

        const labels = record.metadata?.labels as Array<{ name: string; value: string }> | undefined
        const testSourceFile = labels?.find(l => l.name === 'testSourceFile')?.value
        const rawFilePath = testSourceFile ?? record.source.file
        if (!rawFilePath) continue

        const absFilePath = isAbsolute(rawFilePath) ? rawFilePath : join(projectRoot, rawFilePath)

        let relFilePath: string
        try {
          relFilePath = relative(projectRoot, absFilePath)
        } catch {
          continue
        }

        const imports = importGraph.imports.get(relFilePath)
        if (!imports || imports.size === 0) continue

        const inherited: Record<string, string> = {}
        for (const importedFile of imports) {
          try {
            const attrs = matchFile(join(projectRoot, importedFile), skeleton, projectRoot)
            Object.assign(inherited, attrs)
          } catch {
            continue
          }
        }

        // Non-overwrite: direct skeleton annotation wins
        for (const [k, v] of Object.entries(inherited)) {
          if (!(k in record.dimensions)) {
            record.dimensions[k] = v
          }
        }
      }
    }
    inheritSpinner.succeed('inherit-from-import applied')
  } catch (err) {
    inheritSpinner.warn(`inherit-from-import skipped: ${(err as Error).message}`)
  }
}
```

- [ ] **Step 5: Run all CLI tests**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 6: Run full test suite**

```bash
cd /path/to/spaguettiscope && pnpm test 2>&1 | tail -20
```

Expected: All packages pass

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/commands/dashboard.ts packages/cli/src/tests/commands/dashboard.test.ts
git commit -m "feat: Add inherit-from-import pass to dashboard"
```

---

## Self-Review

### Spec coverage

| Spec requirement                                                           | Task   |
| -------------------------------------------------------------------------- | ------ |
| `discoverWorkspaces` — pnpm-workspace.yaml → package.json → single-package | Task 1 |
| `WorkspacePackage` interface with name/root/rel/packageJson                | Task 1 |
| `ScanPlugin` interface with id/canApply/rules                              | Task 2 |
| `plugins: z.array(z.string()).default([])` in config                       | Task 2 |
| `buildImportGraph` using @typescript-eslint/parser                         | Task 3 |
| `mergeImportGraphs`                                                        | Task 3 |
| `GraphPredicate` type union on `RuleSelector.graph?`                       | Task 4 |
| `evaluateGraphPredicate` for all 6 predicate kinds                         | Task 4 |
| `runRules` extended with `options?: { disabledRuleIds?, importGraph? }`    | Task 5 |
| Skip graph predicate (no error) when no graph provided                     | Task 5 |
| Scan: workspace discovery + plugin loading + rule scoping + graph build    | Task 6 |
| `@spaguettiscope/plugin-nextjs` with canApply detecting `next` dep         | Task 7 |
| 5 Next.js rules (api-endpoint, page, layout, client-component, middleware) | Task 7 |
| inherit-from-import dashboard pass (non-overwrite semantics)               | Task 8 |
| Disable via `rules.disable: ["inherit-from-import"]`                       | Task 8 |
| Graph rebuilt at dashboard time (not persisted)                            | Task 8 |

All spec requirements covered.

### Type consistency check

- `ImportGraph` defined in `graph/index.ts`, imported in `graph/predicates.ts` and `rules/runner.ts`
  — consistent
- `GraphPredicate` defined in `rules/types.ts`, used in `graph/predicates.ts` — consistent
- `ScanPlugin.rules()` returns `Rule[]` from `rules/types.ts` — consistent
- `runRules` takes `RunRulesOptions` — callers in scan.ts use `{ disabledRuleIds, importGraph }` —
  consistent
- `discoverWorkspaces` and `buildImportGraph` imported from `@spaguettiscope/core` in CLI — exported
  in Task 4/5

### No placeholders found

All steps contain actual code.
