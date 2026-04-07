# Enhanced Scan Detection Design

## Goal

Make `spasco scan` and `spasco init` extract every pattern they can from the codebase — confidently
where justified, as proposed drafts where uncertain — so the skeleton starts as close to complete as
possible before human review.

## Architecture

Three layers of change:

1. **Import graph** — distinguish type-only from concrete imports
2. **Scan pipeline** — workspace-derived domains, directory heuristics, import direction analysis,
   layer policy proposal
3. **Skeleton format** — `key?` proposed draft convention, `layerPolicy` section

All new detection produces candidates that flow through the existing `mergeSkeleton` path. No new
storage backends. The skeleton remains the single source of truth for topology.

## 1. Type-Aware Import Graph

### Problem

`extractSpecifiers` in `packages/core/src/graph/index.ts` returns bare `string[]` — no distinction
between `import { foo }` and `import type { Foo }`. Type-only imports create zero runtime coupling
and must be treated differently for layer policy enforcement.

### Changes to `extractSpecifiers`

Return type changes from `string[]` to `Array<{ specifier: string; typeOnly: boolean }>`.

The AST visitor classifies each import:

| AST node                 | Type-only when                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| `ImportDeclaration`      | `node.importKind === 'type'`, OR all specifiers have `type` qualifier |
| `ExportNamedDeclaration` | `node.exportKind === 'type'`                                          |
| `ExportAllDeclaration`   | `node.exportKind === 'type'`                                          |
| `TSImportType`           | Always                                                                |
| `require()`              | Never (always concrete)                                               |
| `import()` (dynamic)     | Never (always concrete)                                               |

When the same specifier appears in both a type-only and a concrete import within the same file,
concrete wins — the edge is concrete.

### Changes to `ImportGraph`

```typescript
export interface ImportGraph {
  /** All imports (concrete + type) — unchanged for backward compat */
  imports: Map<string, Set<string>>
  importedBy: Map<string, Set<string>>
  /** Subset: edges where ALL imports from source to target are type-only */
  typeOnlyImports: Map<string, Set<string>>
}
```

Existing consumers (`imports`/`importedBy`) are unaffected. New consumers check membership in
`typeOnlyImports` to distinguish edge types.

`mergeImportGraphs` merges `typeOnlyImports` alongside the other two maps. An edge is type-only in
the merged graph only if it is type-only in every source graph that contains it (i.e., if any graph
has a concrete edge for the same source→target pair, the merged edge is concrete). Within a single
file, if the same specifier is imported both as `import type` and as a concrete `import`, the edge
from that file is concrete.

## 2. Bug Fix: Wire `builtInSchemaRules` into Scan

`packages/core/src/rules/built-in/schema.ts` defines rules that yield `role: schema` +
`layer: validation` for Zod files. These are exported from `@spaguettiscope/core` but never included
in scan.

Fix in `scan.ts`:

```typescript
import { builtInRoleRules, builtInSchemaRules } from '@spaguettiscope/core'
// ...
const allRules = [...builtInRoleRules, ...builtInSchemaRules, ...pluginRules]
```

## 3. Register `layer` as a Built-in Dimension

New file `packages/core/src/classification/built-in/layer.ts`:

```typescript
export const layerDimension: DimensionDefinition = {
  name: 'layer',
  patterns: [],
}
```

Added to `defaultDefinitions` in `classification/built-in/index.ts`. Empty patterns — layer values
come from scan rules and the layer policy, not pattern-based inference.

`BUILT_IN_DIMENSION_NAMES` in `model.ts` updated to include `'layer'`.

## 4. `key?` Proposed Draft Convention

### The three attribute states

| Attribute          | Meaning                        | Skeleton state |
| ------------------ | ------------------------------ | -------------- |
| `layer: renderer`  | Confirmed                      | Not draft      |
| `layer?: renderer` | Proposed, pending confirmation | `draft: true`  |
| `?: renderer`      | Unknown dimension              | `draft: true`  |

### Type changes

`isPending()` in `skeleton/types.ts` checks for any attribute key ending in `?` (in addition to the
existing bare `'?'` check):

```typescript
export function isPending(entry: SkeletonFileEntry): boolean {
  return isDraft(entry) && Object.keys(entry.attributes).some(k => k.endsWith('?'))
}
```

### Merger changes

In `mergeSkeleton`, the `isUncertain` check broadens to include `key?` attributes:

```typescript
const isUncertain = Object.keys(candidate.attributes).some(k => k.endsWith('?'))
```

### `annotate resolve` confirmation flow

`annotate list` shows all pending entries, including `key?` entries with their proposed values.

`annotate resolve` iterates `key?` entries and prompts:

```
Accept layer=renderer for packages/reports/src/renderer/**? [Y/n/override]
  Y (default) → rename layer? to layer, remove draft
  n → remove the entry
  override → prompt for replacement value, write as confirmed
```

This confirmation flow runs alongside the existing `?` (unknown dimension) resolution flow.

## 5. Workspace-Derived Domain Candidates

After `discoverWorkspaces()` in `runScan()`, generate domain candidates from `package.json#name` for
each non-root workspace package.

### Name parsing logic

Extract the last `/`-segment from the scoped name. Then check for known prefixes:

| Name segment     | Domain value     | Confidence                 |
| ---------------- | ---------------- | -------------------------- |
| `plugin-nextjs`  | `plugin:nextjs`  | Concrete (not draft)       |
| `plugin-drizzle` | `plugin:drizzle` | Concrete                   |
| `core`           | `core`           | Proposed draft (`domain?`) |
| `cli`            | `cli`            | Proposed draft (`domain?`) |

The `plugin-` prefix is the first recognized prefix. The prefix table is a simple data structure —
extensible for `adapter-`, `connector-`, etc. without code changes:

```typescript
const DOMAIN_PREFIXES = [
  { prefix: 'plugin-', separator: ':' },
  // future: { prefix: 'adapter-', separator: ':' },
]
```

For each prefix match, the result is concrete (the npm convention is strong enough). For no prefix
match, the bare segment becomes a proposed draft.

### Candidate generation

Each package produces one `MergeCandidate`:

```typescript
{
  attributes: { domain: 'plugin:nextjs' },  // or { 'domain?': 'cli' } for drafts
  paths: ['plugins/nextjs/**'],
  source: 'workspace:@spaguettiscope/plugin-nextjs',
}
```

These candidates go through `mergeSkeleton` alongside rule-generated candidates.

## 6. Directory Name Heuristics for Layer

Within each package, examine first-level directories under `src/`. Match against a curated
dictionary of layer-suggestive names:

| Directory name(s)                | Proposed layer value |
| -------------------------------- | -------------------- |
| `components`, `ui`, `primitives` | `component`          |
| `hooks`                          | `hook`               |
| `utils`, `helpers`, `lib`        | `utility`            |
| `services`                       | `service`            |
| `model`, `models`                | `model`              |
| `types`, `schemas`               | `types`              |
| `api`, `routes`                  | `api`                |
| `middleware`                     | `middleware`         |
| `views`                          | `view`               |
| `controllers`, `handlers`        | `controller`         |
| `adapters`, `connectors`         | `adapter`            |
| `renderer`, `renderers`          | `renderer`           |

Dictionary matches produce proposed draft candidates:

```typescript
{
  attributes: { 'layer?': 'renderer' },
  paths: ['packages/reports/src/renderer/**'],
  source: 'built-in:layer:directory-heuristic',
}
```

Directories not in the dictionary get no layer candidate — they may be domain directories or
organizational groupings. No guessing.

This step runs in `runScan()` after file walking. It iterates first-level `src/` subdirectories for
each package (using the already-walked file list, not additional filesystem reads).

## 7. Import Direction Analysis and Layer Policy

### Analysis step

For each package, after the import graph is built:

1. **Group files by first directory under `src/`.** Files not under `src/` are excluded. Files
   directly in `src/` (no subdirectory) are excluded.

2. **Build a directory-level import matrix.** For each ordered pair of directories (A, B), count:
   - `concreteCount`: number of concrete import edges from files in A to files in B
   - `typeOnlyCount`: number of type-only import edges from A to B

3. **Classify each directory pair** using the matrix:
   - A has concrete imports from B, B has zero from A → `A -> B`
   - A has only type-only imports from B, B has zero from A → `A ~ B`
   - Both directions have significant concrete imports → peers (no edge)
   - Very few total imports between the pair (< 2) → skip (insufficient signal)

4. **Propose a `layerPolicy` section** for the package.

### Skeleton representation

```yaml
layerPolicy:
  packages/reports:
    - renderer -> model
    - renderer -> aggregator
    - renderer -> connectors
    - aggregator -> model
    - connectors -> model
    - connectors ~ renderer
layerPolicyDraft: true

entries:
  # ...
```

`layerPolicyDraft: true` signals that the policy is scan-proposed, not yet confirmed by the user.
Analysis rules skip enforcement when the policy is draft.

### Skeleton types

```typescript
export interface LayerPolicyEdge {
  from: string
  to: string
  kind: 'concrete' | 'typeOnly' // -> vs ~
}

export interface SkeletonFile {
  entries: SkeletonFileEntry[]
  layerPolicy?: Record<string, LayerPolicyEdge[]>
  layerPolicyDraft?: boolean
}
```

### Merge behavior

If a `layerPolicy` already exists in the skeleton and `layerPolicyDraft` is false (user has
confirmed it), scan does not overwrite it. Scan only proposes a policy when none exists or the
existing one is still draft.

When updating a draft policy, scan replaces the entire section with the freshly computed policy
(draft policies are not human-curated yet, so full replacement is safe).

## 8. Analysis Rules for Layer Policy Validation

Two new built-in analysis rules. Both are no-ops when `layerPolicy` is absent or `layerPolicyDraft`
is true.

### `built-in:layer-violation` (severity: `error`)

- **Corpus:** edges (import graph edges)
- **Needs:** `importGraph`, `layerPolicy`
- **Logic:** For each concrete import edge between two files in the same package, resolve both
  files' `layer` dimension values. Look up the edge in the package's `layerPolicy`. If the direction
  is not listed as `->`, emit an error finding.
- **Message:**
  `"Concrete import from {layer_a} to {layer_b} violates layer policy (file: {from} → {to})"`
- **Skip when:** Either file has no `layer` value, or the files are in different packages, or the
  policy is draft.

### `built-in:layer-type-leak` (severity: `warning`)

- **Corpus:** edges (import graph edges)
- **Needs:** `importGraph`, `layerPolicy`
- **Logic:** For each type-only import edge between two files in the same package, resolve layers.
  If there is no edge at all in the policy (neither `->` nor `~`), emit a warning.
- **Message:**
  `"Type-only import from {layer_a} to {layer_b} has no policy edge (file: {from} → {to})"`
- **Skip when:** Same conditions as `layer-violation`.

## 9. Init Plugin Detection

### Convention-based plugin discovery

`init` scans workspace packages for any whose `package.json#name` matches
`@spaguettiscope/plugin-*`. For each, it tries to `import()` the package and read a `detector`
export.

```typescript
export interface PluginDetector {
  id: string
  detect(packageRoot: string, projectRoot: string): boolean
}
```

Each plugin package exports a `detector` alongside its `ScanPlugin`. The detector checks whether the
plugin is relevant to a given workspace package (e.g., `plugin-nextjs` checks for `next` in
dependencies).

### Flow

1. `init` calls `discoverWorkspaces()`
2. For each workspace package whose name matches `@spaguettiscope/plugin-*`, try `import(name)`
3. Read the `detector` export
4. Run `detector.detect(pkg.root, projectRoot)` for each workspace package
5. If any package triggers the detector → suggest adding the plugin to `config.plugins`
6. Also try loading detectors from `--plugins` flag (existing behavior, unchanged)

In `--interactive` mode, each detected plugin is confirmed:

```
Include @spaguettiscope/plugin-nextjs? (detected next in apps/web) [Y/n]
```

Detected plugins are written to `config.plugins` in `spasco.config.json`.

### Plugin-side detector export

Each plugin package adds a named export:

```typescript
// plugins/nextjs/src/index.ts
export const detector: PluginDetector = {
  id: 'nextjs',
  detect(packageRoot) {
    // check for 'next' in dependencies/devDependencies
  },
}
```

## Summary of File Changes

| File                                                     | Change                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/graph/index.ts`                       | `extractSpecifiers` returns `{ specifier, typeOnly }[]`; `buildImportGraph` populates `typeOnlyImports`; `mergeImportGraphs` merges it |
| `packages/core/src/graph/index.ts`                       | `ImportGraph` gains `typeOnlyImports` field                                                                                            |
| `packages/core/src/classification/built-in/layer.ts`     | New: layer dimension stub                                                                                                              |
| `packages/core/src/classification/built-in/index.ts`     | Export layer dimension, add to `defaultDefinitions`                                                                                    |
| `packages/core/src/classification/model.ts`              | Add `'layer'` to `BUILT_IN_DIMENSION_NAMES`                                                                                            |
| `packages/core/src/skeleton/types.ts`                    | Add `LayerPolicyEdge`, extend `SkeletonFile`, update `isPending()`                                                                     |
| `packages/core/src/skeleton/io.ts`                       | Read/write `layerPolicy` and `layerPolicyDraft`                                                                                        |
| `packages/core/src/skeleton/merger.ts`                   | Handle `key?` attributes as draft triggers; layer policy merge logic                                                                   |
| `packages/core/src/rules/built-in/schema.ts`             | No change (already exists)                                                                                                             |
| `packages/core/src/analysis/built-in/layer-violation.ts` | New: `built-in:layer-violation` rule                                                                                                   |
| `packages/core/src/analysis/built-in/layer-type-leak.ts` | New: `built-in:layer-type-leak` rule                                                                                                   |
| `packages/core/src/analysis/built-in/index.ts`           | Export new rules                                                                                                                       |
| `packages/cli/src/commands/scan.ts`                      | Add `builtInSchemaRules`; workspace domain candidates; directory heuristics; import direction analysis; layer policy proposal          |
| `packages/cli/src/commands/init.ts`                      | Convention-based plugin discovery                                                                                                      |
| `packages/cli/src/commands/annotate.ts`                  | `key?` confirmation flow in `resolve`                                                                                                  |
| `packages/core/src/init/interface.ts`                    | `PluginDetector` interface                                                                                                             |
| `plugins/*/src/index.ts`                                 | Each plugin exports a `detector`                                                                                                       |
