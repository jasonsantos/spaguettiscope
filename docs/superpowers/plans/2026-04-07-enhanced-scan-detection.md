# Enhanced Scan Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `spasco scan` and `spasco init` extract every detectable pattern — confidently or as
proposed drafts — so the skeleton starts near-complete before human review.

**Architecture:** Extend the import graph with type-only edge tracking, add a `key?` proposed-draft
convention to the skeleton, teach scan to derive domains from workspace names, layers from directory
heuristics and import direction analysis, and teach init to discover plugins via convention.

**Tech Stack:** TypeScript, vitest, @typescript-eslint/parser AST, YAML skeleton format

**Spec:** `docs/superpowers/specs/2026-04-07-enhanced-scan-detection-design.md`

---

## File Structure

| File                                                     | Responsibility                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/core/src/graph/index.ts`                       | Type-aware `extractSpecifiers`, `buildImportGraph`, `mergeImportGraphs` |
| `packages/core/src/graph/layers.ts`                      | NEW: Import direction analysis → layer policy proposal                  |
| `packages/core/src/classification/built-in/layer.ts`     | NEW: Layer dimension stub                                               |
| `packages/core/src/classification/built-in/index.ts`     | Register layer dimension                                                |
| `packages/core/src/classification/model.ts`              | Add `'layer'` to built-in names                                         |
| `packages/core/src/skeleton/types.ts`                    | `LayerPolicyEdge`, extended `SkeletonFile`, updated `isPending()`       |
| `packages/core/src/skeleton/io.ts`                       | Read/write `layerPolicy` and `layerPolicyDraft`                         |
| `packages/core/src/skeleton/merger.ts`                   | Handle `key?` as draft trigger                                          |
| `packages/core/src/rules/built-in/index.ts`              | Export `builtInSchemaRules`                                             |
| `packages/core/src/analysis/built-in/layer-violation.ts` | NEW: `built-in:layer-violation` rule                                    |
| `packages/core/src/analysis/built-in/layer-type-leak.ts` | NEW: `built-in:layer-type-leak` rule                                    |
| `packages/core/src/analysis/built-in/index.ts`           | Register new analysis rules                                             |
| `packages/core/src/init/interface.ts`                    | `PluginDetector` interface                                              |
| `packages/core/src/init/index.ts`                        | Export `PluginDetector`                                                 |
| `packages/cli/src/commands/scan.ts`                      | Workspace domains, directory heuristics, layer policy, schema rules     |
| `packages/cli/src/commands/annotate.ts`                  | `key?` confirmation flow                                                |
| `packages/cli/src/commands/init.ts`                      | Convention-based plugin discovery                                       |
| `plugins/*/src/index.ts`                                 | Each plugin exports a `detector`                                        |

---

### Task 1: Type-Aware Import Graph

**Files:**

- Modify: `packages/core/src/graph/index.ts`
- Test: `packages/core/src/tests/graph/graph.test.ts`

- [ ] **Step 1: Write failing tests for type-only import detection**

Add these tests to `packages/core/src/tests/graph/graph.test.ts`:

```typescript
it('marks import type as typeOnly edge', () => {
  write('src/a.ts', "import type { Foo } from './b'")
  write('src/b.ts', 'export type Foo = string')

  const graph = buildImportGraph(dir, ['src/a.ts', 'src/b.ts'], dir)

  expect(graph.imports.get('src/a.ts')).toContain('src/b.ts')
  expect(graph.typeOnlyImports.get('src/a.ts')).toContain('src/b.ts')
})

it('marks inline type specifiers as typeOnly when all are type', () => {
  write('src/a.ts', "import { type Foo, type Bar } from './b'")
  write('src/b.ts', 'export type Foo = string\nexport type Bar = number')

  const graph = buildImportGraph(dir, ['src/a.ts', 'src/b.ts'], dir)

  expect(graph.typeOnlyImports.get('src/a.ts')).toContain('src/b.ts')
})

it('marks edge as concrete when mixed type and value imports', () => {
  write('src/a.ts', "import { type Foo, bar } from './b'")
  write('src/b.ts', 'export type Foo = string\nexport const bar = 1')

  const graph = buildImportGraph(dir, ['src/a.ts', 'src/b.ts'], dir)

  expect(graph.imports.get('src/a.ts')).toContain('src/b.ts')
  expect(graph.typeOnlyImports.get('src/a.ts') ?? new Set()).not.toContain('src/b.ts')
})

it('concrete wins when same specifier has both type and value import', () => {
  write('src/a.ts', "import type { Foo } from './b'\nimport { bar } from './b'")
  write('src/b.ts', 'export type Foo = string\nexport const bar = 1')

  const graph = buildImportGraph(dir, ['src/a.ts', 'src/b.ts'], dir)

  expect(graph.imports.get('src/a.ts')).toContain('src/b.ts')
  expect(graph.typeOnlyImports.get('src/a.ts') ?? new Set()).not.toContain('src/b.ts')
})

it('export type is typeOnly', () => {
  write('src/a.ts', "export type { Foo } from './b'")
  write('src/b.ts', 'export type Foo = string')

  const graph = buildImportGraph(dir, ['src/a.ts', 'src/b.ts'], dir)

  expect(graph.typeOnlyImports.get('src/a.ts')).toContain('src/b.ts')
})

it('TSImportType is typeOnly', () => {
  write('src/a.ts', "type X = import('./b').Foo")
  write('src/b.ts', 'export type Foo = string')

  const graph = buildImportGraph(dir, ['src/a.ts', 'src/b.ts'], dir)

  expect(graph.typeOnlyImports.get('src/a.ts')).toContain('src/b.ts')
})

it('require() is always concrete', () => {
  write('src/a.js', "const b = require('./b')")
  write('src/b.js', 'module.exports = {}')

  const graph = buildImportGraph(dir, ['src/a.js', 'src/b.js'], dir)

  expect(graph.imports.get('src/a.js')).toContain('src/b.js')
  expect(graph.typeOnlyImports.get('src/a.js') ?? new Set()).not.toContain('src/b.js')
})

it('dynamic import() is always concrete', () => {
  write('src/a.ts', "const mod = import('./b')")
  write('src/b.ts', 'export const b = 2')

  const graph = buildImportGraph(dir, ['src/a.ts', 'src/b.ts'], dir)

  expect(graph.typeOnlyImports.get('src/a.ts') ?? new Set()).not.toContain('src/b.ts')
})
```

Also update the existing `mergeImportGraphs` tests to handle `typeOnlyImports`:

```typescript
it('merges typeOnlyImports across graphs', () => {
  const g1 = {
    imports: new Map([['a.ts', new Set(['b.ts'])]]),
    importedBy: new Map([['b.ts', new Set(['a.ts'])]]),
    typeOnlyImports: new Map([['a.ts', new Set(['b.ts'])]]),
  }
  const g2 = {
    imports: new Map([['c.ts', new Set(['d.ts'])]]),
    importedBy: new Map([['d.ts', new Set(['c.ts'])]]),
    typeOnlyImports: new Map([['c.ts', new Set(['d.ts'])]]),
  }

  const merged = mergeImportGraphs([g1, g2])

  expect(merged.typeOnlyImports.get('a.ts')).toContain('b.ts')
  expect(merged.typeOnlyImports.get('c.ts')).toContain('d.ts')
})

it('demotes typeOnly to concrete when merging graphs with conflicting edge types', () => {
  const g1 = {
    imports: new Map([['a.ts', new Set(['b.ts'])]]),
    importedBy: new Map([['b.ts', new Set(['a.ts'])]]),
    typeOnlyImports: new Map([['a.ts', new Set(['b.ts'])]]),
  }
  const g2 = {
    imports: new Map([['a.ts', new Set(['b.ts'])]]),
    importedBy: new Map([['b.ts', new Set(['a.ts'])]]),
    typeOnlyImports: new Map(), // concrete in g2
  }

  const merged = mergeImportGraphs([g1, g2])

  expect(merged.imports.get('a.ts')).toContain('b.ts')
  expect(merged.typeOnlyImports.get('a.ts') ?? new Set()).not.toContain('b.ts')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- --run src/tests/graph/graph.test.ts` Expected: FAIL —
`typeOnlyImports` does not exist on `ImportGraph`

- [ ] **Step 3: Implement type-aware `extractSpecifiers`**

In `packages/core/src/graph/index.ts`, change `extractSpecifiers` return type from `string[]` to
`Array<{ specifier: string; typeOnly: boolean }>`. Update the function:

```typescript
interface SpecifierInfo {
  specifier: string
  typeOnly: boolean
}

function extractSpecifiers(code: string, isJsx: boolean): SpecifierInfo[] {
  const specifiers: SpecifierInfo[] = []
  let program: { body: AstNode[] }

  try {
    program = parse(code, { jsx: isJsx, range: false, loc: false } as Parameters<
      typeof parse
    >[1]) as unknown as { body: AstNode[] }
  } catch {
    try {
      program = parse(code, { jsx: false, range: false, loc: false } as Parameters<
        typeof parse
      >[1]) as unknown as { body: AstNode[] }
    } catch {
      return specifiers
    }
  }

  function visit(node: AstNode): void {
    if (!node || typeof node.type !== 'string') return

    if (node.type === 'ImportDeclaration' && (node.source as AstNode)?.type === 'Literal') {
      const importKind = node.importKind as string | undefined
      const nodeSpecifiers = node.specifiers as AstNode[] | undefined
      const allSpecsType =
        importKind === 'type' ||
        (nodeSpecifiers != null &&
          nodeSpecifiers.length > 0 &&
          nodeSpecifiers.every(s => (s as any).importKind === 'type'))
      specifiers.push({
        specifier: (node.source as { value: string }).value,
        typeOnly: allSpecsType,
      })
    } else if (
      node.type === 'ExportAllDeclaration' &&
      (node.source as AstNode)?.type === 'Literal'
    ) {
      const exportKind = node.exportKind as string | undefined
      specifiers.push({
        specifier: (node.source as { value: string }).value,
        typeOnly: exportKind === 'type',
      })
    } else if (
      node.type === 'ExportNamedDeclaration' &&
      node.source != null &&
      (node.source as AstNode).type === 'Literal'
    ) {
      const exportKind = node.exportKind as string | undefined
      specifiers.push({
        specifier: (node.source as { value: string }).value,
        typeOnly: exportKind === 'type',
      })
    } else if (node.type === 'ImportExpression' && (node.source as AstNode)?.type === 'Literal') {
      specifiers.push({
        specifier: (node.source as { value: string }).value,
        typeOnly: false,
      })
    } else if (node.type === 'TSImportType' && (node.argument as AstNode)?.type === 'Literal') {
      specifiers.push({
        specifier: (node.argument as { value: string }).value,
        typeOnly: true,
      })
    } else if (
      node.type === 'CallExpression' &&
      (node.callee as AstNode)?.type === 'Identifier' &&
      (node.callee as { name: string }).name === 'require'
    ) {
      const args = node.arguments as AstNode[]
      if (args?.[0]?.type === 'Literal') {
        const val = (args[0] as unknown as { value: unknown }).value
        if (typeof val === 'string') specifiers.push({ specifier: val, typeOnly: false })
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
```

- [ ] **Step 4: Add `typeOnlyImports` to `ImportGraph` and update `buildImportGraph`**

Update the `ImportGraph` interface:

```typescript
export interface ImportGraph {
  imports: Map<string, Set<string>>
  importedBy: Map<string, Set<string>>
  /** Subset of imports where ALL imports from source→target are type-only */
  typeOnlyImports: Map<string, Set<string>>
}
```

Update `buildImportGraph` to track type-only edges. After resolving each specifier, track whether it
was type-only. When the same target is imported both as type and concrete from the same file,
concrete wins:

```typescript
export function buildImportGraph(
  packageRoot: string,
  filePaths: string[],
  projectRoot: string
): ImportGraph {
  const graph: ImportGraph = {
    imports: new Map(),
    importedBy: new Map(),
    typeOnlyImports: new Map(),
  }

  for (const relPath of filePaths) {
    const dotIdx = relPath.lastIndexOf('.')
    const ext = dotIdx === -1 ? '' : relPath.slice(dotIdx)
    if (!PARSEABLE_EXTS.has(ext)) continue

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

    // Track per-target: is it type-only? Concrete wins over type-only.
    const targetTypeOnly = new Map<string, boolean>()

    for (const { specifier, typeOnly } of extractSpecifiers(code, isJsx)) {
      const resolved = resolveSpecifier(specifier, absPath, packageRoot, projectRoot)
      if (!resolved) continue

      graph.imports.get(relPath)!.add(resolved)

      if (!graph.importedBy.has(resolved)) {
        graph.importedBy.set(resolved, new Set())
      }
      graph.importedBy.get(resolved)!.add(relPath)

      // If we already saw a concrete import for this target, keep it concrete
      const prev = targetTypeOnly.get(resolved)
      if (prev === undefined) {
        targetTypeOnly.set(resolved, typeOnly)
      } else if (!typeOnly) {
        targetTypeOnly.set(resolved, false)
      }
    }

    // Populate typeOnlyImports
    for (const [target, isTypeOnly] of targetTypeOnly) {
      if (isTypeOnly) {
        if (!graph.typeOnlyImports.has(relPath)) {
          graph.typeOnlyImports.set(relPath, new Set())
        }
        graph.typeOnlyImports.get(relPath)!.add(target)
      }
    }
  }

  return graph
}
```

- [ ] **Step 5: Update `mergeImportGraphs` to merge `typeOnlyImports`**

An edge is type-only in the merged graph only if no source graph has a concrete edge for the same
pair:

```typescript
export function mergeImportGraphs(graphs: ImportGraph[]): ImportGraph {
  const merged: ImportGraph = {
    imports: new Map(),
    importedBy: new Map(),
    typeOnlyImports: new Map(),
  }

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

  // An edge is typeOnly only if it is typeOnly in every graph that contains it.
  // First pass: collect all typeOnly edges. Second pass: remove any that appear
  // as concrete in any graph.
  const concreteEdges = new Set<string>()
  const typeOnlyEdges = new Set<string>()

  for (const g of graphs) {
    for (const [source, targets] of g.imports) {
      const typeOnlyTargets = g.typeOnlyImports.get(source)
      for (const target of targets) {
        const key = `${source}\0${target}`
        if (typeOnlyTargets?.has(target)) {
          typeOnlyEdges.add(key)
        } else {
          concreteEdges.add(key)
        }
      }
    }
  }

  for (const key of typeOnlyEdges) {
    if (concreteEdges.has(key)) continue
    const [source, target] = key.split('\0')
    if (!merged.typeOnlyImports.has(source)) {
      merged.typeOnlyImports.set(source, new Set())
    }
    merged.typeOnlyImports.get(source)!.add(target)
  }

  return merged
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- --run src/tests/graph/graph.test.ts` Expected: All tests PASS

- [ ] **Step 7: Fix any existing tests that break due to the interface change**

The existing `mergeImportGraphs` tests pass graph objects without `typeOnlyImports`. Add
`typeOnlyImports: new Map()` to each existing test graph literal. Then run:

Run: `cd packages/core && pnpm test -- --run` Expected: All core tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/graph/index.ts packages/core/src/tests/graph/graph.test.ts
git commit -m "feat(core): Add type-only edge tracking to import graph"
```

---

### Task 2: Register Layer Dimension and Wire Schema Rules

**Files:**

- Create: `packages/core/src/classification/built-in/layer.ts`
- Modify: `packages/core/src/classification/built-in/index.ts`
- Modify: `packages/core/src/classification/model.ts`
- Modify: `packages/cli/src/commands/scan.ts` (import `builtInSchemaRules`)

- [ ] **Step 1: Create layer dimension stub**

Create `packages/core/src/classification/built-in/layer.ts`:

```typescript
import type { DimensionDefinition } from '../model.js'

export const layerDimension: DimensionDefinition = {
  name: 'layer',
  patterns: [],
}
```

- [ ] **Step 2: Register layer in built-in index**

In `packages/core/src/classification/built-in/index.ts`, add the layer export and include it in
`defaultDefinitions`:

```typescript
export { roleDimension } from './role.js'
export { domainDimension } from './domain.js'
export { packageDimension } from './package.js'
export { layerDimension } from './layer.js'

import { roleDimension } from './role.js'
import { domainDimension } from './domain.js'
import { packageDimension } from './package.js'
import { layerDimension } from './layer.js'
import type { DimensionDefinition } from '../model.js'

export const defaultDefinitions: DimensionDefinition[] = [
  roleDimension,
  domainDimension,
  packageDimension,
  layerDimension,
]
```

- [ ] **Step 3: Add `'layer'` to `BUILT_IN_DIMENSION_NAMES`**

In `packages/core/src/classification/model.ts`:

```typescript
export const BUILT_IN_DIMENSION_NAMES = ['role', 'domain', 'package', 'layer'] as const
```

- [ ] **Step 4: Wire `builtInSchemaRules` into scan**

In `packages/cli/src/commands/scan.ts`, update the import:

```typescript
import {
  // ... existing imports ...
  builtInRoleRules,
  builtInSchemaRules,
  // ...
} from '@spaguettiscope/core'
```

And update the rules array:

```typescript
const allRules = [...builtInRoleRules, ...builtInSchemaRules, ...pluginRules]
```

- [ ] **Step 5: Run tests**

Run: `cd packages/core && pnpm test -- --run` Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/classification/built-in/layer.ts \
  packages/core/src/classification/built-in/index.ts \
  packages/core/src/classification/model.ts \
  packages/cli/src/commands/scan.ts
git commit -m "feat(core): Register layer as built-in dimension, wire schema rules into scan"
```

---

### Task 3: `key?` Proposed Draft Convention in Skeleton

**Files:**

- Modify: `packages/core/src/skeleton/types.ts`
- Modify: `packages/core/src/skeleton/merger.ts`
- Test: `packages/core/src/tests/skeleton/merger.test.ts`

- [ ] **Step 1: Write failing tests for `key?` draft behavior**

Add to `packages/core/src/tests/skeleton/merger.test.ts`:

```typescript
it('marks candidates with key? attributes as draft', () => {
  const { skeleton } = mergeSkeleton(
    { entries: [] },
    [{ attributes: { 'layer?': 'renderer' }, paths: ['src/renderer/**'], source: 'heuristic' }],
    ['src/renderer/index.ts']
  )
  const entry = skeleton.entries[0] as any
  expect(entry.draft).toBe(true)
  expect(entry.attributes['layer?']).toBe('renderer')
  expect(entry.source).toBe('heuristic')
})

it('marks concrete attributes (no ?) as non-draft', () => {
  const { skeleton } = mergeSkeleton(
    { entries: [] },
    [{ attributes: { domain: 'plugin:nextjs' }, paths: ['plugins/nextjs/**'] }],
    ['plugins/nextjs/src/index.ts']
  )
  const entry = skeleton.entries[0] as any
  expect(entry.draft).toBeUndefined()
})

it('isPending returns true for key? entries', () => {
  const { skeleton } = mergeSkeleton(
    { entries: [] },
    [{ attributes: { 'domain?': 'core' }, paths: ['packages/core/**'], source: 'workspace' }],
    ['packages/core/src/index.ts']
  )
  expect(isPending(skeleton.entries[0])).toBe(true)
})
```

Add `isPending` to the test imports:

```typescript
import { mergeSkeleton } from '../../skeleton/merger.js'
import { isPending } from '../../skeleton/types.js'
import type { SkeletonFile } from '../../skeleton/types.js'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- --run src/tests/skeleton/merger.test.ts` Expected: FAIL —
`isPending` returns false for `key?` entries

- [ ] **Step 3: Update `isPending` in `skeleton/types.ts`**

```typescript
export function isPending(entry: SkeletonFileEntry): boolean {
  return isDraft(entry) && Object.keys(entry.attributes).some(k => k.endsWith('?'))
}
```

- [ ] **Step 4: Update `mergeSkeleton` in `skeleton/merger.ts`**

Change the `isUncertain` check from `'?' in candidate.attributes` to also handle `key?`:

```typescript
const isUncertain = Object.keys(candidate.attributes).some(k => k.endsWith('?'))
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- --run src/tests/skeleton/merger.test.ts` Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/skeleton/types.ts packages/core/src/skeleton/merger.ts \
  packages/core/src/tests/skeleton/merger.test.ts
git commit -m "feat(core): Support key? proposed draft convention in skeleton"
```

---

### Task 4: Skeleton IO for `layerPolicy`

**Files:**

- Modify: `packages/core/src/skeleton/types.ts`
- Modify: `packages/core/src/skeleton/io.ts`
- Modify: `packages/core/src/skeleton/index.ts`
- Test: `packages/core/src/tests/skeleton/io.test.ts`

- [ ] **Step 1: Add `LayerPolicyEdge` and extend `SkeletonFile` in types**

Add to `packages/core/src/skeleton/types.ts`:

```typescript
export interface LayerPolicyEdge {
  from: string
  to: string
  kind: 'concrete' | 'typeOnly'
}

export interface SkeletonFile {
  entries: SkeletonFileEntry[]
  layerPolicy?: Record<string, LayerPolicyEdge[]>
  layerPolicyDraft?: boolean
}
```

- [ ] **Step 2: Write failing tests for layerPolicy IO**

Add to `packages/core/src/tests/skeleton/io.test.ts`:

```typescript
import { readSkeleton, writeSkeleton } from '../../skeleton/io.js'

describe('layerPolicy IO', () => {
  let dir: string
  let filePath: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-skio-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    filePath = join(dir, 'skeleton.yaml')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('round-trips layerPolicy through write and read', () => {
    const skeleton = {
      entries: [{ attributes: { role: 'test' }, paths: ['src/**/*.test.ts'] }],
      layerPolicy: {
        'packages/core': [
          { from: 'rules', to: 'graph', kind: 'concrete' as const },
          { from: 'analysis', to: 'graph', kind: 'typeOnly' as const },
        ],
      },
      layerPolicyDraft: true,
    }

    writeSkeleton(filePath, skeleton)
    const loaded = readSkeleton(filePath)

    expect(loaded.layerPolicy).toEqual(skeleton.layerPolicy)
    expect(loaded.layerPolicyDraft).toBe(true)
  })

  it('reads skeleton without layerPolicy (backwards compat)', () => {
    writeFileSync(filePath, '- attributes:\n    role: test\n  paths:\n    - "src/**"\n')
    const loaded = readSkeleton(filePath)

    expect(loaded.entries).toHaveLength(1)
    expect(loaded.layerPolicy).toBeUndefined()
    expect(loaded.layerPolicyDraft).toBeUndefined()
  })

  it('round-trips layerPolicy with arrow syntax in YAML', () => {
    const skeleton = {
      entries: [],
      layerPolicy: {
        'packages/reports': [
          { from: 'renderer', to: 'model', kind: 'concrete' as const },
          { from: 'connectors', to: 'renderer', kind: 'typeOnly' as const },
        ],
      },
    }

    writeSkeleton(filePath, skeleton)
    const loaded = readSkeleton(filePath)

    expect(loaded.layerPolicy!['packages/reports']).toEqual(
      skeleton.layerPolicy['packages/reports']
    )
    expect(loaded.layerPolicyDraft).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- --run src/tests/skeleton/io.test.ts` Expected: FAIL —
`readSkeleton` doesn't read `layerPolicy`

- [ ] **Step 4: Update `readSkeleton` and `writeSkeleton` in `io.ts`**

The skeleton YAML currently stores entries as a top-level array. To support `layerPolicy`, the
format needs to handle both the legacy array format and a new object format with `entries`,
`layerPolicy`, and `layerPolicyDraft` keys.

```typescript
export function readSkeleton(filePath: string): SkeletonFile {
  if (!existsSync(filePath)) return { entries: [] }
  const raw = readFileSync(filePath, 'utf-8')
  let parsed: unknown
  try {
    parsed = parse(raw)
  } catch (err) {
    throw new Error(`Failed to parse skeleton file at ${filePath}: ${(err as Error).message}`)
  }

  // Legacy format: top-level array of entries
  if (Array.isArray(parsed)) {
    return { entries: filterEntries(parsed) }
  }

  // New format: object with entries, layerPolicy, layerPolicyDraft
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    const entries = Array.isArray(obj.entries) ? filterEntries(obj.entries) : []
    const layerPolicy = obj.layerPolicy as Record<string, LayerPolicyEdge[]> | undefined
    const layerPolicyDraft = obj.layerPolicyDraft === true ? true : undefined
    return {
      entries,
      ...(layerPolicy ? { layerPolicy } : {}),
      ...(layerPolicyDraft ? { layerPolicyDraft } : {}),
    }
  }

  return { entries: [] }
}

function filterEntries(arr: unknown[]): SkeletonFileEntry[] {
  return arr.filter(
    (e): e is SkeletonFileEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as Record<string, unknown>).attributes === 'object' &&
      (e as Record<string, unknown>).attributes !== null &&
      Array.isArray((e as Record<string, unknown>).paths)
  )
}

export function writeSkeleton(filePath: string, skeleton: SkeletonFile): void {
  if (!skeleton.layerPolicy && !skeleton.layerPolicyDraft) {
    // Legacy format: write entries as top-level array
    writeFileSync(filePath, stringify(skeleton.entries, { lineWidth: 0 }), 'utf-8')
    return
  }
  // New format: object
  const doc: Record<string, unknown> = { entries: skeleton.entries }
  if (skeleton.layerPolicy) doc.layerPolicy = skeleton.layerPolicy
  if (skeleton.layerPolicyDraft) doc.layerPolicyDraft = skeleton.layerPolicyDraft
  writeFileSync(filePath, stringify(doc, { lineWidth: 0 }), 'utf-8')
}
```

Import `LayerPolicyEdge` from types:

```typescript
import type { SkeletonFile, SkeletonFileEntry, LayerPolicyEdge } from './types.js'
```

- [ ] **Step 5: Update skeleton index exports**

In `packages/core/src/skeleton/index.ts`, ensure `LayerPolicyEdge` is exported if not already.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- --run src/tests/skeleton/io.test.ts` Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/skeleton/types.ts packages/core/src/skeleton/io.ts \
  packages/core/src/skeleton/index.ts packages/core/src/tests/skeleton/io.test.ts
git commit -m "feat(core): Support layerPolicy section in skeleton IO"
```

---

### Task 5: Workspace-Derived Domain Candidates in Scan

**Files:**

- Modify: `packages/cli/src/commands/scan.ts`

This task adds workspace-derived domain candidates to `runScan()`. After `discoverWorkspaces()`,
parse each package's `package.json#name` and generate domain candidates.

- [ ] **Step 1: Add workspace domain candidate generation**

In `packages/cli/src/commands/scan.ts`, after the `filesByPackage` bucketing (around line 70) and
before running rules, add:

```typescript
// 4b. Generate domain candidates from workspace package names
const DOMAIN_PREFIXES = [{ prefix: 'plugin-', separator: ':' }]

const workspaceDomainCandidates: Array<{
  attributes: Record<string, string>
  paths: string[]
  source: string
}> = []
for (const pkg of packages) {
  if (pkg.rel === '.') continue
  const name = pkg.packageJson.name as string | undefined
  if (!name) continue

  const segment = name.includes('/') ? name.split('/').pop()! : name
  let domain: string
  let isProposed = true

  for (const { prefix, separator } of DOMAIN_PREFIXES) {
    if (segment.startsWith(prefix)) {
      domain = `${prefix.slice(0, -1)}${separator}${segment.slice(prefix.length)}`
      isProposed = false
      break
    }
  }
  domain ??= segment

  const attrKey = isProposed ? 'domain?' : 'domain'
  workspaceDomainCandidates.push({
    attributes: { [attrKey]: domain },
    paths: [`${pkg.rel}/**`],
    source: `workspace:${name}`,
  })
}
```

Then in the merge step, append these candidates:

```typescript
const { skeleton, added, unchanged, markedStale } = mergeSkeleton(
  existing,
  [
    ...candidates.map(c => ({
      attributes: c.attributes,
      paths: [c.pathPattern],
      source: c.source,
    })),
    ...workspaceDomainCandidates,
  ],
  allFiles
)
```

- [ ] **Step 2: Run `pnpm build` and verify scan works**

Run: `pnpm build && node packages/cli/dist/index.js scan` Expected: Scan completes, skeleton
contains domain entries for workspace packages.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/scan.ts
git commit -m "feat(cli): Generate workspace-derived domain candidates in scan"
```

---

### Task 6: Directory Name Heuristics for Layer in Scan

**Files:**

- Modify: `packages/cli/src/commands/scan.ts`

- [ ] **Step 1: Add directory name heuristic layer candidates**

In `packages/cli/src/commands/scan.ts`, after the workspace domain candidates block, add:

```typescript
// 4c. Directory name heuristics for layer
const LAYER_DICTIONARY = new Map<string, string>([
  ['components', 'component'],
  ['ui', 'component'],
  ['primitives', 'component'],
  ['hooks', 'hook'],
  ['utils', 'utility'],
  ['helpers', 'utility'],
  ['lib', 'utility'],
  ['services', 'service'],
  ['model', 'model'],
  ['models', 'model'],
  ['types', 'types'],
  ['schemas', 'types'],
  ['api', 'api'],
  ['routes', 'api'],
  ['middleware', 'middleware'],
  ['views', 'view'],
  ['controllers', 'controller'],
  ['handlers', 'controller'],
  ['adapters', 'adapter'],
  ['connectors', 'adapter'],
  ['renderer', 'renderer'],
  ['renderers', 'renderer'],
])

const layerHeuristicCandidates: Array<{
  attributes: Record<string, string>
  paths: string[]
  source: string
}> = []
for (const pkg of packages) {
  const prefix = pkg.rel === '.' ? 'src/' : `${pkg.rel}/src/`
  // Extract first-level directories under src/ from the file list
  const srcDirs = new Set<string>()
  for (const f of allFiles) {
    if (!f.startsWith(prefix)) continue
    const rest = f.slice(prefix.length)
    const slashIdx = rest.indexOf('/')
    if (slashIdx === -1) continue
    srcDirs.add(rest.slice(0, slashIdx))
  }

  for (const dirName of srcDirs) {
    const layerValue = LAYER_DICTIONARY.get(dirName)
    if (!layerValue) continue
    layerHeuristicCandidates.push({
      attributes: { 'layer?': layerValue },
      paths: [`${prefix}${dirName}/**`],
      source: 'built-in:layer:directory-heuristic',
    })
  }
}
```

Add these to the merge candidates array alongside workspace domains:

```typescript
const { skeleton, added, unchanged, markedStale } = mergeSkeleton(
  existing,
  [
    ...candidates.map(c => ({
      attributes: c.attributes,
      paths: [c.pathPattern],
      source: c.source,
    })),
    ...workspaceDomainCandidates,
    ...layerHeuristicCandidates,
  ],
  allFiles
)
```

- [ ] **Step 2: Run `pnpm build` and verify scan works**

Run: `pnpm build && node packages/cli/dist/index.js scan` Expected: Skeleton contains `layer?`
entries for recognized directory names.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/scan.ts
git commit -m "feat(cli): Add directory name heuristics for layer detection in scan"
```

---

### Task 7: Import Direction Analysis and Layer Policy

**Files:**

- Create: `packages/core/src/graph/layers.ts`
- Modify: `packages/core/src/index.ts` (export new module)
- Modify: `packages/cli/src/commands/scan.ts`
- Test: `packages/core/src/tests/graph/layers.test.ts`

- [ ] **Step 1: Write failing tests for `analyzeLayerDirections`**

Create `packages/core/src/tests/graph/layers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { analyzeLayerDirections } from '../../graph/layers.js'
import type { ImportGraph } from '../../graph/index.js'
import type { LayerPolicyEdge } from '../../skeleton/types.js'

function makeGraph(edges: Array<{ from: string; to: string; typeOnly?: boolean }>): ImportGraph {
  const imports = new Map<string, Set<string>>()
  const importedBy = new Map<string, Set<string>>()
  const typeOnlyImports = new Map<string, Set<string>>()

  for (const { from, to, typeOnly } of edges) {
    if (!imports.has(from)) imports.set(from, new Set())
    imports.get(from)!.add(to)
    if (!importedBy.has(to)) importedBy.set(to, new Set())
    importedBy.get(to)!.add(from)
    if (typeOnly) {
      if (!typeOnlyImports.has(from)) typeOnlyImports.set(from, new Set())
      typeOnlyImports.get(from)!.add(to)
    }
  }

  return { imports, importedBy, typeOnlyImports }
}

describe('analyzeLayerDirections', () => {
  it('detects one-directional concrete dependency', () => {
    const graph = makeGraph([
      { from: 'pkg/src/views/page.ts', to: 'pkg/src/model/user.ts' },
      { from: 'pkg/src/views/list.ts', to: 'pkg/src/model/item.ts' },
    ])

    const policy = analyzeLayerDirections(graph, 'pkg', [
      'pkg/src/views/page.ts',
      'pkg/src/views/list.ts',
      'pkg/src/model/user.ts',
      'pkg/src/model/item.ts',
    ])

    expect(policy).toContainEqual({ from: 'views', to: 'model', kind: 'concrete' })
  })

  it('detects type-only dependency when all imports are type-only', () => {
    const graph = makeGraph([
      { from: 'pkg/src/connectors/a.ts', to: 'pkg/src/renderer/types.ts', typeOnly: true },
    ])

    // Need at least 2 edges for the threshold — add another
    const graph2 = makeGraph([
      { from: 'pkg/src/connectors/a.ts', to: 'pkg/src/renderer/types.ts', typeOnly: true },
      { from: 'pkg/src/connectors/b.ts', to: 'pkg/src/renderer/other.ts', typeOnly: true },
    ])

    const policy = analyzeLayerDirections(graph2, 'pkg', [
      'pkg/src/connectors/a.ts',
      'pkg/src/connectors/b.ts',
      'pkg/src/renderer/types.ts',
      'pkg/src/renderer/other.ts',
    ])

    expect(policy).toContainEqual({ from: 'connectors', to: 'renderer', kind: 'typeOnly' })
  })

  it('skips pairs with bidirectional concrete imports (peers)', () => {
    const graph = makeGraph([
      { from: 'pkg/src/a/x.ts', to: 'pkg/src/b/y.ts' },
      { from: 'pkg/src/a/z.ts', to: 'pkg/src/b/w.ts' },
      { from: 'pkg/src/b/y.ts', to: 'pkg/src/a/x.ts' },
      { from: 'pkg/src/b/w.ts', to: 'pkg/src/a/z.ts' },
    ])

    const policy = analyzeLayerDirections(graph, 'pkg', [
      'pkg/src/a/x.ts',
      'pkg/src/a/z.ts',
      'pkg/src/b/y.ts',
      'pkg/src/b/w.ts',
    ])

    const aToB = policy.find(e => e.from === 'a' && e.to === 'b')
    const bToA = policy.find(e => e.from === 'b' && e.to === 'a')
    // Peers: either no edges or both directions present
    expect(aToB && bToA).toBeFalsy()
  })

  it('skips pairs with fewer than 2 total imports', () => {
    const graph = makeGraph([{ from: 'pkg/src/a/x.ts', to: 'pkg/src/b/y.ts' }])

    const policy = analyzeLayerDirections(graph, 'pkg', ['pkg/src/a/x.ts', 'pkg/src/b/y.ts'])

    expect(policy).toHaveLength(0)
  })

  it('ignores files not under src/', () => {
    const graph = makeGraph([{ from: 'pkg/scripts/build.ts', to: 'pkg/src/model/user.ts' }])

    const policy = analyzeLayerDirections(graph, 'pkg', [
      'pkg/scripts/build.ts',
      'pkg/src/model/user.ts',
    ])

    expect(policy).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- --run src/tests/graph/layers.test.ts` Expected: FAIL — module
`../../graph/layers.js` not found

- [ ] **Step 3: Implement `analyzeLayerDirections`**

Create `packages/core/src/graph/layers.ts`:

```typescript
import type { ImportGraph } from './index.js'
import type { LayerPolicyEdge } from '../skeleton/types.js'

/**
 * Analyze import directions between first-level directories under `src/`
 * within a single package, and propose a layer policy.
 *
 * @param graph    Merged import graph (file-level edges)
 * @param pkgRel  Package relative path (e.g. 'packages/core' or '.')
 * @param files   All files belonging to this package (relative to project root)
 * @returns        Proposed layer policy edges for this package
 */
export function analyzeLayerDirections(
  graph: ImportGraph,
  pkgRel: string,
  files: string[]
): LayerPolicyEdge[] {
  const srcPrefix = pkgRel === '.' ? 'src/' : `${pkgRel}/src/`

  // Group files by first directory under src/
  function getLayer(file: string): string | null {
    if (!file.startsWith(srcPrefix)) return null
    const rest = file.slice(srcPrefix.length)
    const slashIdx = rest.indexOf('/')
    if (slashIdx === -1) return null // file directly in src/, no layer
    return rest.slice(0, slashIdx)
  }

  // Build directory-level import counts
  interface DirFlow {
    concrete: number
    typeOnly: number
  }

  const flows = new Map<string, DirFlow>() // key: "fromDir\0toDir"

  for (const file of files) {
    const fromDir = getLayer(file)
    if (!fromDir) continue

    const targets = graph.imports.get(file)
    if (!targets) continue

    const typeOnlyTargets = graph.typeOnlyImports.get(file)

    for (const target of targets) {
      const toDir = getLayer(target)
      if (!toDir || toDir === fromDir) continue

      const key = `${fromDir}\0${toDir}`
      const flow = flows.get(key) ?? { concrete: 0, typeOnly: 0 }

      if (typeOnlyTargets?.has(target)) {
        flow.typeOnly++
      } else {
        flow.concrete++
      }

      flows.set(key, flow)
    }
  }

  // Classify each directory pair
  const edges: LayerPolicyEdge[] = []
  const processed = new Set<string>()

  for (const [key, flow] of flows) {
    const [fromDir, toDir] = key.split('\0')
    const pairKey = [fromDir, toDir].sort().join('\0')
    if (processed.has(pairKey)) continue
    processed.add(pairKey)

    const reverseKey = `${toDir}\0${fromDir}`
    const reverseFlow = flows.get(reverseKey) ?? { concrete: 0, typeOnly: 0 }

    const forwardTotal = flow.concrete + flow.typeOnly
    const reverseTotal = reverseFlow.concrete + reverseFlow.typeOnly
    const total = forwardTotal + reverseTotal

    // Skip pairs with too few imports
    if (total < 2) continue

    // Skip bidirectional concrete (peers)
    if (flow.concrete > 0 && reverseFlow.concrete > 0) continue

    // Forward has imports, reverse doesn't (or only type-only reverse)
    if (forwardTotal > 0 && reverseFlow.concrete === 0) {
      if (flow.concrete > 0) {
        edges.push({ from: fromDir, to: toDir, kind: 'concrete' })
      } else {
        edges.push({ from: fromDir, to: toDir, kind: 'typeOnly' })
      }
      // If there's a type-only reverse, add it too
      if (reverseFlow.typeOnly > 0) {
        edges.push({ from: toDir, to: fromDir, kind: 'typeOnly' })
      }
    }

    // Reverse has imports, forward doesn't
    if (reverseTotal > 0 && flow.concrete === 0 && forwardTotal === 0) {
      if (reverseFlow.concrete > 0) {
        edges.push({ from: toDir, to: fromDir, kind: 'concrete' })
      } else {
        edges.push({ from: toDir, to: fromDir, kind: 'typeOnly' })
      }
    }
  }

  return edges
}
```

- [ ] **Step 4: Export from core index**

In `packages/core/src/index.ts`, add:

```typescript
export * from './graph/layers.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- --run src/tests/graph/layers.test.ts` Expected: All PASS

- [ ] **Step 6: Wire into scan — layer policy proposal**

In `packages/cli/src/commands/scan.ts`, import the new function:

```typescript
import {
  // ... existing imports ...
  analyzeLayerDirections,
  type LayerPolicyEdge,
} from '@spaguettiscope/core'
```

After the import graph is built and before merging the skeleton, add layer policy analysis:

```typescript
// 4d. Import direction analysis for layer policy
const layerPolicySpinner = ora('Analyzing import directions…').start()
const proposedLayerPolicy: Record<string, LayerPolicyEdge[]> = {}

for (const pkg of packages) {
  const pkgFiles = filesByPackage.get(pkg.rel) ?? []
  const edges = analyzeLayerDirections(importGraph, pkg.rel, pkgFiles)
  if (edges.length > 0) {
    proposedLayerPolicy[pkg.rel] = edges
  }
}
layerPolicySpinner.succeed(
  `Layer policy: ${Object.keys(proposedLayerPolicy).length} packages analyzed`
)
```

After `mergeSkeleton`, apply the layer policy to the skeleton if it's new or still draft:

```typescript
// Apply proposed layer policy
if (Object.keys(proposedLayerPolicy).length > 0) {
  if (!skeleton.layerPolicy || skeleton.layerPolicyDraft) {
    skeleton.layerPolicy = proposedLayerPolicy
    skeleton.layerPolicyDraft = true
  }
}
```

Note: `mergeSkeleton` returns `{ skeleton, ... }` — the skeleton object needs to be mutable for
this. Adjust the merge call to capture it mutably:

```typescript
const mergeResult = mergeSkeleton(existing, [...candidates...], allFiles)
const skeleton = mergeResult.skeleton
// ... apply layer policy ...
writeSkeleton(skeletonPath, skeleton)
```

- [ ] **Step 7: Run `pnpm build` and verify scan works**

Run: `pnpm build && node packages/cli/dist/index.js scan` Expected: Skeleton now has a `layerPolicy`
section with proposed edges.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/graph/layers.ts packages/core/src/tests/graph/layers.test.ts \
  packages/core/src/index.ts packages/cli/src/commands/scan.ts
git commit -m "feat(core): Import direction analysis for layer policy proposal"
```

---

### Task 8: Layer Policy Analysis Rules

**Files:**

- Create: `packages/core/src/analysis/built-in/layer-violation.ts`
- Create: `packages/core/src/analysis/built-in/layer-type-leak.ts`
- Modify: `packages/core/src/analysis/built-in/index.ts`
- Modify: `packages/core/src/analysis/types.ts` (extend `AnalysisContext`)
- Test: `packages/core/src/tests/analysis/built-in/layer-violation.test.ts`
- Test: `packages/core/src/tests/analysis/built-in/layer-type-leak.test.ts`

- [ ] **Step 1: Extend `AnalysisContext` with layer policy**

In `packages/core/src/analysis/types.ts`, add to `AnalysisContext`:

```typescript
import type { LayerPolicyEdge } from '../skeleton/types.js'

export interface AnalysisContext {
  topology: Map<string, DimensionSet>
  importGraph?: ImportGraph
  testRecords?: TestRecord[]
  cache: IntermediateCache
  /** Layer policy from the skeleton — edges are per-package. */
  layerPolicy?: Record<string, LayerPolicyEdge[]>
  /** True when the policy is scan-proposed and not yet confirmed by user. */
  layerPolicyDraft?: boolean
}
```

Also add `'layer-violation'` to `FindingKind`:

```typescript
export type FindingKind =
  | 'violation'
  | 'coverage-gap'
  | 'flakiness'
  | 'unused'
  | 'metric'
  | 'layer-violation'
```

- [ ] **Step 2: Write failing tests for layer-violation rule**

Create `packages/core/src/tests/analysis/built-in/layer-violation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { layerViolationRule } from '../../../analysis/built-in/layer-violation.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { EdgeItem, AnalysisContext } from '../../../analysis/types.js'
import type { LayerPolicyEdge } from '../../../skeleton/types.js'

function makeCtx(policy: Record<string, LayerPolicyEdge[]>, draft = false): AnalysisContext {
  return {
    topology: new Map([
      ['pkg/src/views/page.ts', { package: 'pkg', layer: 'views', role: 'component' }],
      ['pkg/src/model/user.ts', { package: 'pkg', layer: 'model', role: 'business-logic' }],
      ['pkg/src/utils/fmt.ts', { package: 'pkg', layer: 'utils', role: 'utility' }],
    ]),
    cache: createIntermediateCache(),
    layerPolicy: policy,
    layerPolicyDraft: draft,
  }
}

describe('built-in:layer-violation', () => {
  it('emits no finding for allowed concrete edge', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] })
    const edge: EdgeItem = {
      from: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
      to: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
    }
    expect(layerViolationRule.run(edge, ctx)).toHaveLength(0)
  })

  it('emits error for unlisted concrete edge', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] })
    const edge: EdgeItem = {
      from: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
      to: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
    }
    const findings = layerViolationRule.run(edge, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('error')
  })

  it('skips when policy is draft', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] }, true)
    const edge: EdgeItem = {
      from: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
      to: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
    }
    expect(layerViolationRule.run(edge, ctx)).toHaveLength(0)
  })

  it('skips when either file has no layer', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] })
    const edge: EdgeItem = {
      from: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
      to: { file: 'pkg/src/other.ts', dimensions: { package: 'pkg' } },
    }
    expect(layerViolationRule.run(edge, ctx)).toHaveLength(0)
  })

  it('skips when files are in different packages', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] })
    const edge: EdgeItem = {
      from: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
      to: { file: 'other/src/model/user.ts', dimensions: { package: 'other', layer: 'model' } },
    }
    expect(layerViolationRule.run(edge, ctx)).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run src/tests/analysis/built-in/layer-violation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement `layerViolationRule`**

Create `packages/core/src/analysis/built-in/layer-violation.ts`:

```typescript
import type { AnalysisRule, EdgeItem, Finding, AnalysisContext } from '../types.js'

export const layerViolationRule: AnalysisRule<'edges'> = {
  id: 'built-in:layer-violation',
  severity: 'error',
  needs: ['importGraph'],
  corpus: 'edges',
  run(item: EdgeItem, ctx: AnalysisContext): Finding[] {
    if (!ctx.layerPolicy || ctx.layerPolicyDraft) return []

    const fromLayer = item.from.dimensions.layer
    const toLayer = item.to.dimensions.layer
    if (!fromLayer || !toLayer) return []
    if (fromLayer === toLayer) return []

    const fromPkg = item.from.dimensions.package
    const toPkg = item.to.dimensions.package
    if (!fromPkg || fromPkg !== toPkg) return []

    const policy = ctx.layerPolicy[fromPkg]
    if (!policy) return []

    // Check if this is a type-only edge — if so, this rule doesn't apply
    // (layer-type-leak handles type-only edges)
    const typeOnly = ctx.importGraph?.typeOnlyImports.get(item.from.file)?.has(item.to.file)
    if (typeOnly) return []

    // Check if a concrete edge is allowed
    const allowed = policy.some(
      e => e.from === fromLayer && e.to === toLayer && e.kind === 'concrete'
    )
    if (allowed) return []

    return [
      {
        ruleId: 'built-in:layer-violation',
        kind: 'layer-violation',
        severity: 'error',
        subject: { type: 'edge', from: item.from.file, to: item.to.file },
        dimensions: item.from.dimensions,
        message: `Concrete import from ${fromLayer} to ${toLayer} violates layer policy (${item.from.file} → ${item.to.file})`,
      },
    ]
  },
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --run src/tests/analysis/built-in/layer-violation.test.ts`
Expected: All PASS

- [ ] **Step 6: Write failing tests for layer-type-leak rule**

Create `packages/core/src/tests/analysis/built-in/layer-type-leak.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { layerTypeLeakRule } from '../../../analysis/built-in/layer-type-leak.js'
import { createIntermediateCache } from '../../../analysis/intermediates.js'
import type { EdgeItem, AnalysisContext } from '../../../analysis/types.js'
import type { ImportGraph } from '../../../graph/index.js'
import type { LayerPolicyEdge } from '../../../skeleton/types.js'

function makeCtx(
  policy: Record<string, LayerPolicyEdge[]>,
  typeOnlyEdges: Array<[string, string]>,
  draft = false
): AnalysisContext {
  const typeOnlyImports = new Map<string, Set<string>>()
  for (const [from, to] of typeOnlyEdges) {
    if (!typeOnlyImports.has(from)) typeOnlyImports.set(from, new Set())
    typeOnlyImports.get(from)!.add(to)
  }
  return {
    topology: new Map(),
    cache: createIntermediateCache(),
    layerPolicy: policy,
    layerPolicyDraft: draft,
    importGraph: {
      imports: new Map(),
      importedBy: new Map(),
      typeOnlyImports,
    },
  }
}

describe('built-in:layer-type-leak', () => {
  it('emits no finding when type-only edge has ~ policy', () => {
    const ctx = makeCtx({ pkg: [{ from: 'connectors', to: 'renderer', kind: 'typeOnly' }] }, [
      ['pkg/src/connectors/a.ts', 'pkg/src/renderer/types.ts'],
    ])
    const edge: EdgeItem = {
      from: {
        file: 'pkg/src/connectors/a.ts',
        dimensions: { package: 'pkg', layer: 'connectors' },
      },
      to: { file: 'pkg/src/renderer/types.ts', dimensions: { package: 'pkg', layer: 'renderer' } },
    }
    expect(layerTypeLeakRule.run(edge, ctx)).toHaveLength(0)
  })

  it('emits no finding when type-only edge has -> policy (concrete allows type too)', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] }, [
      ['pkg/src/views/page.ts', 'pkg/src/model/user.ts'],
    ])
    const edge: EdgeItem = {
      from: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
      to: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
    }
    expect(layerTypeLeakRule.run(edge, ctx)).toHaveLength(0)
  })

  it('emits warning when type-only edge has no policy edge', () => {
    const ctx = makeCtx({ pkg: [{ from: 'views', to: 'model', kind: 'concrete' }] }, [
      ['pkg/src/model/user.ts', 'pkg/src/views/page.ts'],
    ])
    const edge: EdgeItem = {
      from: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
      to: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
    }
    const findings = layerTypeLeakRule.run(edge, ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('warning')
  })

  it('skips when policy is draft', () => {
    const ctx = makeCtx({ pkg: [] }, [['pkg/src/model/user.ts', 'pkg/src/views/page.ts']], true)
    const edge: EdgeItem = {
      from: { file: 'pkg/src/model/user.ts', dimensions: { package: 'pkg', layer: 'model' } },
      to: { file: 'pkg/src/views/page.ts', dimensions: { package: 'pkg', layer: 'views' } },
    }
    expect(layerTypeLeakRule.run(edge, ctx)).toHaveLength(0)
  })
})
```

- [ ] **Step 7: Implement `layerTypeLeakRule`**

Create `packages/core/src/analysis/built-in/layer-type-leak.ts`:

```typescript
import type { AnalysisRule, EdgeItem, Finding, AnalysisContext } from '../types.js'

export const layerTypeLeakRule: AnalysisRule<'edges'> = {
  id: 'built-in:layer-type-leak',
  severity: 'warning',
  needs: ['importGraph'],
  corpus: 'edges',
  run(item: EdgeItem, ctx: AnalysisContext): Finding[] {
    if (!ctx.layerPolicy || ctx.layerPolicyDraft) return []

    const fromLayer = item.from.dimensions.layer
    const toLayer = item.to.dimensions.layer
    if (!fromLayer || !toLayer) return []
    if (fromLayer === toLayer) return []

    const fromPkg = item.from.dimensions.package
    const toPkg = item.to.dimensions.package
    if (!fromPkg || fromPkg !== toPkg) return []

    // Only applies to type-only edges
    const isTypeOnly = ctx.importGraph?.typeOnlyImports.get(item.from.file)?.has(item.to.file)
    if (!isTypeOnly) return []

    const policy = ctx.layerPolicy[fromPkg]
    if (!policy) return []

    // Any policy edge (concrete or typeOnly) covers this
    const covered = policy.some(e => e.from === fromLayer && e.to === toLayer)
    if (covered) return []

    return [
      {
        ruleId: 'built-in:layer-type-leak',
        kind: 'layer-violation',
        severity: 'warning',
        subject: { type: 'edge', from: item.from.file, to: item.to.file },
        dimensions: item.from.dimensions,
        message: `Type-only import from ${fromLayer} to ${toLayer} has no policy edge (${item.from.file} → ${item.to.file})`,
      },
    ]
  },
}
```

- [ ] **Step 8: Register rules in built-in index**

Update `packages/core/src/analysis/built-in/index.ts`:

```typescript
export { coverageGapRule } from './coverage.js'
export { unusedExportRule } from './unused.js'
export { circularDepRule } from './circular.js'
export { flakyTestRule } from './flakiness.js'
export { layerViolationRule } from './layer-violation.js'
export { layerTypeLeakRule } from './layer-type-leak.js'

import { coverageGapRule } from './coverage.js'
import { unusedExportRule } from './unused.js'
import { circularDepRule } from './circular.js'
import { flakyTestRule } from './flakiness.js'
import { layerViolationRule } from './layer-violation.js'
import { layerTypeLeakRule } from './layer-type-leak.js'
import type { AnalysisRule } from '../types.js'

export const builtInAnalysisRules: AnalysisRule[] = [
  coverageGapRule,
  unusedExportRule,
  circularDepRule,
  flakyTestRule,
  layerViolationRule,
  layerTypeLeakRule,
]
```

- [ ] **Step 9: Run all analysis tests**

Run: `cd packages/core && pnpm test -- --run src/tests/analysis/` Expected: All PASS

- [ ] **Step 10: Wire layer policy into `runAnalysis` call in dashboard**

In `packages/cli/src/commands/dashboard.ts`, when calling `runAnalysis`, pass the skeleton's layer
policy via the context. The `runAnalysis` function creates an `AnalysisContext` — it needs to
forward `layerPolicy` and `layerPolicyDraft`. Update `RunAnalysisOptions` in
`packages/core/src/analysis/runner.ts` to accept these:

```typescript
export interface RunAnalysisOptions {
  files: string[]
  topology: Map<string, DimensionSet>
  rules: AnalysisRule[]
  importGraph?: ImportGraph
  testRecords?: TestRecord[]
  cache: IntermediateCache
  layerPolicy?: Record<string, LayerPolicyEdge[]>
  layerPolicyDraft?: boolean
}
```

And in `runAnalysis`, pass them to the context:

```typescript
const ctx: AnalysisContext = {
  topology,
  importGraph,
  testRecords,
  cache,
  layerPolicy: options.layerPolicy,
  layerPolicyDraft: options.layerPolicyDraft,
}
```

In `dashboard.ts`, read the skeleton's layer policy and pass it:

```typescript
const skeletonData = existsSync(skeletonPath) ? readSkeleton(skeletonPath) : null
// ... existing skeleton code ...

const findings: Finding[] = runAnalysis({
  files: allFiles,
  topology: analysisTopology,
  rules: [...builtInAnalysisRules, ...pluginRules],
  importGraph: analysisImportGraph,
  cache: analysisCache,
  layerPolicy: skeletonData?.layerPolicy,
  layerPolicyDraft: skeletonData?.layerPolicyDraft,
})
```

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/analysis/types.ts \
  packages/core/src/analysis/built-in/layer-violation.ts \
  packages/core/src/analysis/built-in/layer-type-leak.ts \
  packages/core/src/analysis/built-in/index.ts \
  packages/core/src/analysis/runner.ts \
  packages/core/src/tests/analysis/built-in/layer-violation.test.ts \
  packages/core/src/tests/analysis/built-in/layer-type-leak.test.ts \
  packages/cli/src/commands/dashboard.ts
git commit -m "feat(core): Add layer-violation and layer-type-leak analysis rules"
```

---

### Task 9: `annotate resolve` Confirmation Flow for `key?`

**Files:**

- Modify: `packages/cli/src/commands/annotate.ts`

- [ ] **Step 1: Update `runAnnotateList` to show `key?` entries**

In `packages/cli/src/commands/annotate.ts`, update the pending filter to include `key?` entries:

```typescript
export async function runAnnotateList(options: { projectRoot?: string } = {}): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const skeleton = readSkeleton(skeletonPath)

  const pending = skeleton.entries.filter(
    e => isDraft(e) && Object.keys(e.attributes).some(k => k.endsWith('?'))
  )

  if (pending.length === 0) {
    console.log('No pending annotations. Skeleton is fully resolved.')
    return
  }

  console.log(`\n? entries requiring annotation (${pending.length}):\n`)
  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i]
    const paths = entry.paths.join(', ')
    const src = (entry as any).source ? `  (${(entry as any).source})` : ''

    // Show proposed key? entries differently from bare ? entries
    const proposedKeys = Object.keys(entry.attributes).filter(k => k.endsWith('?') && k !== '?')
    if (proposedKeys.length > 0) {
      const proposals = proposedKeys
        .map(k => `${k.slice(0, -1)} = "${entry.attributes[k]}"`)
        .join(', ')
      console.log(`  [${i + 1}] ${proposals}   ${paths}${src}`)
    } else {
      const value = entry.attributes['?']
      console.log(`  [${i + 1}] ? = "${value}"   ${paths}${src}`)
    }
  }
  console.log()
}
```

- [ ] **Step 2: Add `key?` confirmation to `runAnnotateResolve`**

Update `runAnnotateResolve` to handle `key?` entries. When `--as` is not provided and the entry has
proposed keys, auto-confirm them:

```typescript
export async function runAnnotateResolve(options: ResolveOptions): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const skeleton = readSkeleton(skeletonPath)

  const extraAttrs: Record<string, string> = {}
  if (options.add) {
    for (const pair of options.add.split(',')) {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) continue
      const k = pair.slice(0, eqIdx).trim()
      const v = pair.slice(eqIdx + 1).trim()
      if (k && v) extraAttrs[k] = v
    }
  }

  let resolved = 0
  const entries = skeleton.entries.map(entry => {
    if (!isDraft(entry)) return entry

    const proposedKeys = Object.keys(entry.attributes).filter(k => k.endsWith('?') && k !== '?')

    // Handle key? proposed entries: confirm all proposed dimensions
    if (proposedKeys.length > 0 && (options.all || !options.as)) {
      const newAttributes: Record<string, string> = {}
      for (const [k, v] of Object.entries(entry.attributes)) {
        if (k.endsWith('?') && k !== '?') {
          newAttributes[k.slice(0, -1)] = v // layer? → layer
        } else {
          newAttributes[k] = v
        }
      }
      Object.assign(newAttributes, extraAttrs)
      resolved++
      return { attributes: newAttributes, paths: entry.paths }
    }

    // Handle bare ? entries (existing behavior)
    if (!('?' in entry.attributes) || !options.as) return entry

    const uncertain = entry.attributes['?']
    const shouldResolve = options.all || options.values.includes(uncertain)
    if (!shouldResolve) return entry

    const newAttributes: Record<string, string> = { ...entry.attributes }
    delete newAttributes['?']
    newAttributes[options.as] = uncertain
    Object.assign(newAttributes, extraAttrs)

    resolved++
    return { attributes: newAttributes, paths: entry.paths }
  })

  writeSkeleton(skeletonPath, { ...skeleton, entries })
  printSuccess(`Resolved ${resolved} entr${resolved === 1 ? 'y' : 'ies'}`)
}
```

- [ ] **Step 3: Build and test manually**

Run: `pnpm build && node packages/cli/dist/index.js annotate list` Expected: Shows proposed `key?`
entries from previous scan.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/annotate.ts
git commit -m "feat(cli): Support key? confirmation flow in annotate resolve"
```

---

### Task 10: `PluginDetector` Interface and Init Plugin Discovery

**Files:**

- Modify: `packages/core/src/init/interface.ts`
- Modify: `packages/core/src/init/index.ts`
- Modify: `packages/cli/src/commands/init.ts`

- [ ] **Step 1: Add `PluginDetector` interface**

In `packages/core/src/init/interface.ts`:

```typescript
export interface PluginDetector {
  readonly id: string
  detect(packageRoot: string, projectRoot: string): boolean
}
```

- [ ] **Step 2: Export it from init index**

In `packages/core/src/init/index.ts`, add:

```typescript
export type { PluginDetector } from './interface.js'
```

- [ ] **Step 3: Add plugin discovery to `runInit`**

In `packages/cli/src/commands/init.ts`, after connector detection, add plugin discovery:

```typescript
import {
  discoverWorkspaces,
  builtInDetectors,
  type InitDetector,
  type DetectedConnector,
  type PluginDetector,
} from '@spaguettiscope/core'

// ... inside runInit, after connector detection ...

// Discover plugins from workspace packages matching @spaguettiscope/plugin-*
const detectedPlugins: Array<{ id: string; source: string }> = []
const pluginDetectors: Array<{ name: string; detector: PluginDetector }> = []

// Load detectors from workspace plugin packages
for (const pkg of packages) {
  const pkgName = pkg.packageJson.name as string | undefined
  if (!pkgName) continue
  const segment = pkgName.includes('/') ? pkgName.split('/').pop()! : pkgName
  if (!segment.startsWith('plugin-')) continue

  try {
    const mod = (await import(pkgName)) as Record<string, unknown>
    const det = mod.detector as PluginDetector | undefined
    if (det && typeof det.detect === 'function') {
      pluginDetectors.push({ name: pkgName, detector: det })
    }
  } catch {
    // Plugin not loadable — skip
  }
}

// Also try loading detectors from --plugins flag
if (options.plugins) {
  for (const pluginId of options.plugins
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)) {
    try {
      const mod = (await import(pluginId)) as Record<string, unknown>
      const det = mod.detector as PluginDetector | undefined
      if (det && typeof det.detect === 'function') {
        pluginDetectors.push({ name: pluginId, detector: det })
      }
    } catch {
      printWarning(`Failed to load plugin detector: ${pluginId}`)
    }
  }
}

// Run plugin detectors against all workspace packages
for (const { name, detector } of pluginDetectors) {
  for (const pkg of packages) {
    if (detector.detect(pkg.root, projectRoot)) {
      detectedPlugins.push({
        id: name,
        source: `detected ${detector.id} in ${pkg.packageJson.name ?? pkg.rel}`,
      })
      break // One match is enough — add the plugin once
    }
  }
}

// Deduplicate
const uniquePlugins = [...new Map(detectedPlugins.map(p => [p.id, p])).values()]

// Interactive confirmation for plugins
if (options.interactive && process.stdout.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const confirmedPlugins: typeof uniquePlugins = []
  for (const p of uniquePlugins) {
    const answer = await rl.question(`Include ${p.id}? (${p.source}) [Y/n] `)
    if (answer.trim().toLowerCase() !== 'n') confirmedPlugins.push(p)
  }
  uniquePlugins.length = 0
  uniquePlugins.push(...confirmedPlugins)
  rl.close()
}

// Add to config
if (uniquePlugins.length > 0) {
  ;(config as Record<string, unknown>).plugins = uniquePlugins.map(p => p.id)
}
```

- [ ] **Step 4: Build and verify**

Run: `pnpm build` Expected: Builds clean.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/init/interface.ts packages/core/src/init/index.ts \
  packages/cli/src/commands/init.ts
git commit -m "feat(core): Add PluginDetector interface and convention-based plugin discovery in init"
```

---

### Task 11: Plugin Detector Exports

**Files:**

- Modify: `plugins/nextjs/src/index.ts`
- Modify: `plugins/drizzle/src/index.ts`
- Modify: `plugins/electron/src/index.ts`
- Modify: `plugins/playwright/src/index.ts`
- Modify: `plugins/prisma/src/index.ts`
- Modify: `plugins/react/src/index.ts`
- Modify: `plugins/storybook/src/index.ts`

Each plugin needs a `detector` export. The pattern for each: check if a framework-specific
dependency exists in the target package's `package.json`.

- [ ] **Step 1: Add detector to nextjs plugin**

In `plugins/nextjs/src/index.ts`, add:

```typescript
import type { PluginDetector } from '@spaguettiscope/core'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function hasDep(packageRoot: string, dep: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8'))
    return dep in (pkg.dependencies ?? {}) || dep in (pkg.devDependencies ?? {})
  } catch {
    return false
  }
}

export const detector: PluginDetector = {
  id: 'nextjs',
  detect(packageRoot) {
    return hasDep(packageRoot, 'next')
  },
}
```

- [ ] **Step 2: Add detector to each remaining plugin**

Repeat the same pattern for each plugin, changing only the dependency name and id:

**`plugins/drizzle/src/index.ts`:**

```typescript
export const detector: PluginDetector = {
  id: 'drizzle',
  detect(packageRoot) {
    return hasDep(packageRoot, 'drizzle-orm')
  },
}
```

**`plugins/electron/src/index.ts`:**

```typescript
export const detector: PluginDetector = {
  id: 'electron',
  detect(packageRoot) {
    return hasDep(packageRoot, 'electron')
  },
}
```

**`plugins/playwright/src/index.ts`:**

```typescript
export const detector: PluginDetector = {
  id: 'playwright',
  detect(packageRoot) {
    return hasDep(packageRoot, '@playwright/test')
  },
}
```

**`plugins/prisma/src/index.ts`:**

```typescript
export const detector: PluginDetector = {
  id: 'prisma',
  detect(packageRoot) {
    return hasDep(packageRoot, '@prisma/client') || hasDep(packageRoot, 'prisma')
  },
}
```

**`plugins/react/src/index.ts`:**

```typescript
export const detector: PluginDetector = {
  id: 'react',
  detect(packageRoot) {
    return hasDep(packageRoot, 'react') && !hasDep(packageRoot, 'next')
  },
}
```

**`plugins/storybook/src/index.ts`:**

```typescript
export const detector: PluginDetector = {
  id: 'storybook',
  detect(packageRoot) {
    try {
      const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8'))
      const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
      return Object.keys(allDeps).some(d => d.startsWith('@storybook/'))
    } catch {
      return false
    }
  },
}
```

Each plugin needs the same `hasDep` helper and imports. Add
`import type { PluginDetector } from '@spaguettiscope/core'` and
`import { readFileSync } from 'node:fs'` and `import { join } from 'node:path'` to each file. Factor
out `hasDep` as a local function in each (since plugins are independent packages, they can't share
it without a new dependency).

- [ ] **Step 3: Build all plugins**

Run: `pnpm build` Expected: All packages build clean.

- [ ] **Step 4: Commit**

```bash
git add plugins/*/src/index.ts
git commit -m "feat(plugins): Export PluginDetector from all plugin packages"
```

---

## Dependency Graph

```
Task 1 (type-aware graph)  ──┐
Task 2 (layer dim + schema) ─┤
Task 3 (key? convention)  ───┼── Task 5 (workspace domains)
Task 4 (skeleton IO)  ───────┤   Task 6 (directory heuristics)
                              ├── Task 7 (import direction analysis) ── Task 8 (analysis rules)
                              └── Task 9 (annotate resolve)

Task 10 (PluginDetector + init) ── Task 11 (plugin exports)
```

Tasks 1, 2, 3, 4 can run in parallel (independent foundations). Tasks 5 and 6 depend on 3 (key?
convention). Task 7 depends on 1 (type-aware graph) + 4 (skeleton IO). Task 8 depends on 7 + 8's
context type changes. Task 9 depends on 3 (key? convention). Tasks 10 and 11 are independent of all
others.
