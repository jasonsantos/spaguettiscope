# Topology Model Phase 2 Design

## Problem Statement

Phase 1 delivered path and content predicates, skeleton IO, and a basic scan → annotate → dashboard
pipeline. Three capabilities remain from the original design:

1. **Monorepo-native scanning** — the scan engine must understand workspace structure and scope
   framework rules to the packages where they apply.
2. **Import graph + graph predicates** — structural rules (`imported-by`, `imports`, etc.) require a
   per-package dependency graph built from source files.
3. **inherit-from-import** — test records in the dashboard inherit dimension attributes from the
   source files those tests import.

These three capabilities share the import graph as foundational infrastructure and are designed
together in this phase.

---

## Design Principles

All Phase 1 design principles carry forward. Phase 2 adds one:

**Plugins are opt-in and detection is automatic.** A plugin declares how to detect the framework it
supports. The scan engine applies it automatically to every workspace package where detection
passes. Users never manually assign plugins to packages.

---

## Architecture Overview

```
spasco scan
  └── discoverWorkspaces → WorkspacePackage[]
  └── loadPlugins (from config.plugins) → ScanPlugin[]
  └── walkFiles → allRelativeFilePaths[]
  └── for each WorkspacePackage:
        matchingPlugins = plugins where canApply(package.root)
        scopedRules = prefix plugin rules with package.rel
        packageFiles = allFiles filtered to package.rel
        build per-package ImportGraph → merge into combined graph
  └── runRules(allFiles, allRules, projectRoot, { importGraph }) → candidates
  └── mergeSkeleton → writeSkeleton

spasco dashboard
  └── (existing) skeleton post-pass: matchFile → record.dimensions
  └── (new) inherit-from-import pass: test records inherit from imported source files
```

---

## New Modules

| Module / Package                     | Responsibility                                              |
| ------------------------------------ | ----------------------------------------------------------- |
| `packages/core/src/workspace/`       | Workspace discovery — pnpm/npm workspaces → package roots   |
| `packages/core/src/graph/`           | Import graph builder + graph predicate evaluator            |
| `packages/core/src/plugins/types.ts` | `ScanPlugin` interface                                      |
| `plugins/nextjs/`                    | `@spaguettiscope/plugin-nextjs` — detection + Next.js rules |

---

## Workspace Discovery

`packages/core/src/workspace/` exports one function:

```typescript
interface WorkspacePackage {
  name: string // from package.json "name"
  root: string // absolute path to package directory
  rel: string // relative to project root (e.g. "packages/web")
  packageJson: unknown
}

function discoverWorkspaces(projectRoot: string): WorkspacePackage[]
```

Discovery order:

1. Read `pnpm-workspace.yaml` → glob patterns → resolve matching directories that contain a
   `package.json`
2. Fall back to `package.json` `workspaces` field (npm/yarn format)
3. Fall back to single-package: the project root itself is the only package

The result is always non-empty (at minimum the project root). No plugin logic lives here.

---

## Plugin Interface

`packages/core/src/plugins/types.ts`:

```typescript
interface ScanPlugin {
  id: string
  /** Return true if this plugin applies to the given package root. Synchronous and cheap. */
  canApply(packageRoot: string): boolean
  /** Return rules with paths relative to the package root (not the project root). */
  rules(): Rule[]
}
```

The scan engine scopes plugin rules to their detected package:

```
for each WorkspacePackage:
  for each ScanPlugin where canApply(package.root):
    prefix each rule's path glob with package.rel
    e.g. "app/api/($1)/**/route.ts" → "packages/web/app/api/($1)/**/route.ts"
```

Built-in role rules (`**/*.test.ts`, etc.) fire on all files without scoping.

Plugins are registered in config:

```json
{
  "plugins": ["@spaguettiscope/plugin-nextjs"]
}
```

The scan engine loads registered plugins dynamically via `import()`. `plugins` is added to
`SpascoConfigSchema` as `z.array(z.string()).default([])`.

---

## Import Graph

### Data Structure

```typescript
interface ImportGraph {
  /** rel-to-projectRoot → Set of rel-to-projectRoot paths this file imports */
  imports: Map<string, Set<string>>
  /** reverse index: rel-to-projectRoot → Set of files that import it */
  importedBy: Map<string, Set<string>>
}
```

### Builder

```typescript
function buildImportGraph(
  packageRoot: string, // absolute path to the package
  filePaths: string[], // relative to project root
  projectRoot: string
): ImportGraph
```

Per-file extraction:

1. Parse with `@typescript-eslint/parser` in `module` mode (falls back to `script` for `.js` files
   that fail module parse)
2. Walk `ImportDeclaration`, `ExportNamedDeclaration` with `source`, `ExportAllDeclaration`, and
   `require()` call expressions
3. Skip any specifier that does not start with `.` or `/` — node_modules are ignored
4. Resolve the specifier to an actual file: try exact → `.ts` → `.tsx` → `/index.ts` → `/index.tsx`.
   Unresolvable imports are silently skipped.
5. Record the edge in both `imports` and `importedBy`

One graph is built per workspace package. The scan engine merges them into a single combined
`ImportGraph` by merging the maps. No cross-package edges are generated — each builder only resolves
paths within its own package root.

The graph is ephemeral: built in memory during scan, not persisted to disk. It is rebuilt at
dashboard time when inherit-from-import is needed.

---

## Graph Predicates

### Types

`RuleSelector` gains an optional `graph` field:

```typescript
interface RuleSelector {
  path: string
  content?: string
  graph?: GraphPredicate
}

type GraphPredicate =
  | { kind: 'imported-by'; glob: string }
  | { kind: 'imports'; glob: string }
  | { kind: 'no-imports' }
  | { kind: 'imports-count'; op: '>'; n: number }
  | { kind: 'and'; predicates: GraphPredicate[] }
  | { kind: 'or'; predicates: GraphPredicate[] }
```

### Evaluation

`runRules` options are extended:

```typescript
function runRules(
  relativeFilePaths: string[],
  rules: Rule[],
  projectRoot: string,
  options?: {
    disabledRuleIds?: Set<string>
    importGraph?: ImportGraph
  }
): RuleCandidate[]
```

Evaluation order per file: path glob → content predicate → graph predicate. A rule with a graph
predicate is skipped (not an error) when no import graph is provided.

Predicate semantics:

| Predicate            | Evaluation                                                       |
| -------------------- | ---------------------------------------------------------------- |
| `imported-by "glob"` | `importedBy.get(file)` contains at least one entry matching glob |
| `imports "glob"`     | `imports.get(file)` contains at least one entry matching glob    |
| `no-imports`         | `imports.get(file)?.size === 0`                                  |
| `imports-count > N`  | `imports.get(file)?.size > N`                                    |
| `and`                | all child predicates must pass (short-circuit)                   |
| `or`                 | at least one child predicate must pass (short-circuit)           |

---

## Next.js Plugin

`plugins/nextjs/` is a new pnpm workspace package: `@spaguettiscope/plugin-nextjs`.

### Detection

```typescript
canApply(packageRoot: string): boolean
```

Returns `true` if `next` appears in `dependencies` or `devDependencies` of the package's
`package.json`.

### Rules

All rules use path and content predicates only (no graph predicates required for v2). Paths are
relative to the package root and are prefixed by the scan engine.

| Selector                            | Yield                                     |
| ----------------------------------- | ----------------------------------------- |
| `app/api/($1)/**/route.ts`          | `role=api-endpoint, layer=bff, domain=$1` |
| `app/($1)/**/page.tsx`              | `role=page, domain=$1`                    |
| `app/($1)/**/layout.tsx`            | `role=layout, domain=$1`                  |
| `**/*.tsx` content: `^'use client'` | `layer=client-component`                  |
| `middleware.ts` at package root     | `role=middleware`                         |

Route group segments `(group)/` are stripped from captured values. Dynamic segments `[slug]` use the
parent segment name.

The plugin exports a single instance: `export const nextjsPlugin: ScanPlugin`.

---

## inherit-from-import

This capability runs entirely at dashboard time as a second post-pass after the existing skeleton
post-pass.

### Pass Order in `runDashboard`

```
1. Connector reads → records[]
2. Skeleton post-pass (existing): matchFile(record.source.file, skeleton) → record.dimensions
3. inherit-from-import pass (new):
   a. discoverWorkspaces(projectRoot) → packages
      for each package: buildImportGraph → merge into combined ImportGraph
   b. For each record where dimensions.role === 'test':
      - Resolve the test file path (testSourceFile label, falling back to source.file)
      - Get its imports from the import graph
      - For each imported file, call matchFile(importedFile, skeleton)
      - Merge resulting attributes into record.dimensions (do NOT overwrite already-set keys)
```

Step 3a rebuilds the graph once per dashboard run using the same workspace discovery and
`buildImportGraph` logic as scan. It is not persisted.

The non-overwrite rule means: if the skeleton directly matches a test file and sets `domain: auth`,
an inherited `domain: payments` from an imported file does not replace it. Direct skeleton
annotation always wins.

### Configuration

Disabled via:

```json
{ "rules": { "disable": ["inherit-from-import"] } }
```

The dashboard checks this before running the pass.

---

## Files Affected

| File / Location                          | Change                                                   |
| ---------------------------------------- | -------------------------------------------------------- |
| `packages/core/src/workspace/index.ts`   | New: `discoverWorkspaces`, `WorkspacePackage`            |
| `packages/core/src/graph/index.ts`       | New: `buildImportGraph`, `ImportGraph`, predicate types  |
| `packages/core/src/graph/predicates.ts`  | New: `evaluateGraphPredicate`                            |
| `packages/core/src/plugins/types.ts`     | New: `ScanPlugin` interface                              |
| `packages/core/src/rules/types.ts`       | Add `graph?: GraphPredicate` to `RuleSelector`           |
| `packages/core/src/rules/runner.ts`      | Accept `importGraph` option, evaluate graph predicates   |
| `packages/core/src/index.ts`             | Export workspace, graph, plugins modules                 |
| `packages/core/src/config/schema.ts`     | Add `plugins: z.array(z.string()).default([])`           |
| `packages/cli/src/commands/scan.ts`      | Workspace discovery, plugin loading/scoping, graph build |
| `packages/cli/src/commands/dashboard.ts` | inherit-from-import post-pass                            |
| `plugins/nextjs/package.json`            | New package: `@spaguettiscope/plugin-nextjs`             |
| `plugins/nextjs/src/index.ts`            | Export `nextjsPlugin: ScanPlugin`                        |
| `plugins/nextjs/src/rules.ts`            | Next.js rule definitions                                 |
| `plugins/nextjs/src/detect.ts`           | `canApply` — checks `next` in package.json deps          |
| `pnpm-workspace.yaml`                    | Add `plugins/*` to workspace packages                    |

---

## What This Does NOT Change

- `NormalizedRunRecord` shape
- Skeleton file format
- `spasco annotate` commands
- Aggregator logic
- Dashboard renderer
- History file format
- Terminal summary format
- Phase 1 rule DSL (path, content predicates) — fully backward compatible
