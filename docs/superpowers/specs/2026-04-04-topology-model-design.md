# Topology Model Design

## Problem Statement

SpaguettiScope currently infers dimensions (domain, package, role) on every run using heuristics
that are project-specific, brittle, and produce `unknown` for most real-world projects. The
inference engine has no memory between runs, no mechanism for user correction, and no way to express
structural knowledge that only the team possesses.

The root issue: the tool treats classification as a computation problem when it is partly an
annotation problem. Some things can be inferred from structure. Others must be declared.

---

## Design Principles

**The primary value is "what is this codebase?" — a navigable map.** Navigation itself answers
derivative questions (health, drift, priorities). The map must be built collaboratively: the machine
contributes what it can observe; the team contributes what it knows.

**Two phases, two artifacts.**

- _Committed skeleton_: what the team says the codebase is. Lives in the repo. Source of truth.
- _Generated enrichment_: what the codebase structurally is. Produced on every run. Never committed.

**Rules surface patterns. Annotation gives them names.** Rules fire during scan and produce
candidate entries. Candidates with unresolved dimension names carry a `?` marker. Annotation
resolves `?` into real dimension keys. Once resolved, entries are never touched by scan again.

**Config is additive. Scan is a merge.** Re-running scan never destroys annotations. It only adds
new draft entries for newly discovered patterns and flags entries whose paths no longer exist on
disk.

---

## Architecture Overview

```
spasco scan
  └── fires rules (path + content + graph predicates)
  └── merges results into skeleton (draft entries with ?)
  └── [--interactive] prompts for ? resolution inline

spasco annotate list / resolve
  └── lists unresolved ? entries
  └── resolves ? → dimension key, optionally adds attributes

spasco dashboard
  └── reads committed skeleton
  └── reads connector results (Allure, Playwright, etc.)
  └── matches records to skeleton entries → populates dimensions
  └── outputs enriched dashboard + terminal summary
```

---

## Rules

Rules live inside framework plugins (extending the existing plugin architecture). The Next.js plugin
ships Next.js rules alongside its existing discovery/analysis capabilities.

### Rule Anatomy

Each rule has:

- **Selector**: path glob + optional content predicate + optional graph predicate
- **Yield**: one or more attribute assignments

```
selector:
  path: "app/api/($1)/**/route.ts"
yields:
  - role: api-endpoint
  - layer: bff
  - domain: $1              # extracted from capture group

selector:
  path: "src/($1)/**"
  graph: imported-by "src/index.ts"
yields:
  - "?": $1                 # uncertain: value known, dimension unknown

selector:
  path: "**/utils/**"
yields:
  - tag: utils              # sharp, no annotation needed
```

### Certainty is Implicit

The `?` marker in the yield is what makes an entry require annotation. Rules with fully concrete
yields need no annotation. There is no separate `assertive` flag — the yield syntax carries the
certainty.

A rule yields either:

- **Concrete attributes**: dimension key and value both known → entry written directly to skeleton
- **Uncertain attributes** (`?=value`): value known (extracted or inferred), dimension key unknown →
  entry written as draft, awaiting annotation
- **Inherit-from-import**: test file inherits attributes from the source files it imports (see
  Test-to-Source Linking below)

### Graph DSL

Rules may include graph predicates to express structural relationships:

| Predicate              | Meaning                                        |
| ---------------------- | ---------------------------------------------- |
| `imported-by "<glob>"` | this file is imported by a file matching glob  |
| `imports "<glob>"`     | this file imports a file matching glob         |
| `no-imports`           | this file has no outgoing imports              |
| `imports-count > N`    | this file has more than N import relationships |

Predicates can be combined with `and` / `or`.

### Built-in Rules (framework-agnostic)

These ship with core and fire on every project:

| Selector                              | Yield                 |
| ------------------------------------- | --------------------- |
| `**/*.test.ts`, `**/*.spec.ts`, etc.  | role: test            |
| `**/*.e2e.ts`, `e2e/**`               | role: e2e             |
| `__tests__/**`                        | role: test            |
| `__mocks__/**`                        | role: mock            |
| imports a test file matching skeleton | (inherit-from-import) |

### Next.js Plugin Rules

| Selector                            | Yield                                   |
| ----------------------------------- | --------------------------------------- |
| `app/api/($1)/**/route.ts`          | role=api-endpoint, layer=bff, domain=$1 |
| `app/($1)/**/page.tsx`              | role=page, domain=$1                    |
| `app/($1)/**/layout.tsx`            | role=layout, domain=$1                  |
| `**/*.tsx` content: `^'use client'` | layer=client-component                  |
| `**/*.tsx` no `'use client'`        | layer=server-component                  |
| `middleware.ts` at project root     | role=middleware                         |

Route groups `(group)/` are stripped; dynamic params `[slug]` use the parent segment.

---

## Skeleton

### Format

Expanded format. One entry per resolved name. Human-readable and manually editable.

```yaml
# spaguettiscope.skeleton.yaml
- attributes:
    domain: checkout
    layer: bff
    role: api-endpoint
  paths:
    - 'app/api/checkout/**'

- attributes:
    domain: auth
    layer: service
  paths:
    - 'src/auth/**'

- attributes:
    tag: utils
  paths:
    - '**/utils/**'
```

Draft entries (awaiting annotation) carry a `?` key:

```yaml
- attributes:
    '?': clients
  paths:
    - 'src/clients/**'
  draft: true
  source: 'rule: src/($1)/** imported-by src/index.ts'
```

Stale entries (paths no longer exist on disk) carry a `stale` marker:

```yaml
- attributes:
    domain: legacy-payments
  paths:
    - 'src/legacy/payments/**'
  stale: true
```

### Merge Behavior

`spasco scan` reads the existing skeleton before writing anything:

1. Fires all rules against the current file tree and import graph
2. For each rule result, checks whether a matching entry already exists in the skeleton
3. If matched → skip (annotation is preserved)
4. If unmatched → append as draft entry
5. For each existing entry, checks whether its paths still match files on disk
6. If paths resolve to zero files → mark `stale: true` (not deleted)

Manual entries (added directly to the file) are preserved exactly like annotated entries.

---

## Commands

### `spasco scan`

Fires all rules, merges results into skeleton. Reports:

- N new draft entries added
- N existing entries unchanged
- N entries newly marked stale

```bash
spasco scan
spasco scan --interactive    # after scan, prompts for each ? entry in sequence (same as annotate resolve, one by one)
```

### `spasco annotate list`

Lists all unresolved draft entries:

```
? entries requiring annotation (3):

  [1] ? = "clients"   src/clients/**   (imported-by src/index.ts)
  [2] ? = "orders"    src/orders/**    (imported-by src/index.ts)
  [3] ? = "auth"      src/auth/**      (imported-by src/index.ts)
```

### `spasco annotate resolve`

Resolves a `?` group. The `<group>` argument identifies by the captured value or by index:

```bash
# Resolve a single entry
spasco annotate resolve auth --as domain

# Resolve all entries from the same rule match as a group, add extra attributes
spasco annotate resolve clients,orders,auth --as domain --add layer=service

# Resolve all pending ? entries from a specific rule at once
spasco annotate resolve --all --as domain --add layer=service
```

`--add` accepts comma-separated `key=value` pairs. These are stamped onto every resolved entry.

### `spasco dashboard`

Unchanged externally. Internally, before populating `dimensions` on records, it now also applies the
skeleton: for each record, walks the skeleton entries and applies attributes from any entry whose
paths match the record's `source.file`.

---

## Test-to-Source Linking

Test files inherit dimension attributes from the source files they import.

### Mechanism

Expressed as a special yield type `inherit-from-import` available in rule definitions:

```yaml
selector:
  path: '**/*.test.ts'
  imports: 'src/**'
yields:
  - inherit-from-import
```

At execution time, `inherit-from-import` means: resolve all import targets for this file, look each
up in the skeleton, collect their attributes, apply to the test record.

### First Version: File-Level

A test file's record inherits all attributes from all imported source files. If a test file imports
from both `domain=checkout` and `domain=payments`, its record carries both.

### Full Version: Identifier-Level (future)

When the import graph resolves to function/class identifiers, individual test cases inherit only
from the identifiers they exercise. A test file importing from two domains produces records that are
filtered separately — each test case belongs to the domain of the identifier it tests.

### Configuration

Because this is expressed as a rule, users can disable it:

```json
{
  "rules": {
    "disable": ["inherit-from-import"]
  }
}
```

---

## Skeleton File Location

The skeleton lives at `spaguettiscope.skeleton.yaml` in the project root, alongside
`spaguettiscope.config.json`. It is committed to version control.

The config file references the skeleton path (overridable):

```json
{
  "skeleton": "./spaguettiscope.skeleton.yaml"
}
```

---

## Relation to Existing Infrastructure

| Component             | Change                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| Connectors            | Unchanged — produce `NormalizedRunRecord[]` as before                                   |
| `NormalizedRunRecord` | Unchanged — `dimensions: Record<string, string>` already supports this                  |
| `InferenceEngine`     | Remains for single-file inference during connector reads; skeleton applied as post-pass |
| Aggregator            | Unchanged                                                                               |
| Dashboard renderer    | Unchanged — dimensions already drive dynamic filters                                    |
| Terminal summary      | Unchanged                                                                               |
| CI mode               | Unchanged                                                                               |

The skeleton enrichment is a post-processing pass after connector reads, before aggregation.
Skeleton attributes take precedence over inference engine results — skeleton represents deliberate
team annotation, inference is a heuristic. The skeleton fills in missing dimensions and overrides
inferred ones.

---

## What This Does NOT Change

- Connector read logic
- `NormalizedRunRecord` shape
- Aggregator logic (`aggregateAll`, `aggregateByConnector`)
- Dashboard output format
- History file format
- Terminal summary format

---

## Files Affected

| File / Location                          | Change                                                      |
| ---------------------------------------- | ----------------------------------------------------------- |
| `spaguettiscope.skeleton.yaml` (new)     | Committed skeleton — created by first `spasco scan`         |
| `packages/core/src/skeleton/`            | New package: skeleton reader, writer, merge logic           |
| `packages/core/src/rules/`               | New: rule DSL types, rule runner, graph predicate evaluator |
| `packages/core/src/rules/built-in/`      | Built-in rules (role, test-to-source linking)               |
| `plugins/nextjs/src/rules.ts`            | Next.js rules export                                        |
| `packages/cli/src/commands/scan.ts`      | New: `spasco scan` command                                  |
| `packages/cli/src/commands/annotate.ts`  | New: `spasco annotate list / resolve`                       |
| `packages/cli/src/commands/dashboard.ts` | Apply skeleton as post-pass before aggregation              |
| `packages/core/src/config/schema.ts`     | Add `skeleton` path + `rules.disable[]` to config schema    |
