# Topology Model — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete scan → annotate → dashboard enrichment workflow via a committed
skeleton YAML file that classifies files into named dimensions using a rule-based engine.

**Architecture:** A new `skeleton` module in `@spaguettiscope/core` reads/writes/merges a YAML
skeleton file; a new `rules` module fires path + content predicates against a file tree to produce
candidate entries. The CLI gains `spasco scan` and `spasco annotate` commands; `spasco dashboard`
gains a post-pass that applies skeleton attributes to records.

**Tech Stack:** TypeScript (NodeNext ESM), Vitest, `yaml` npm package, `minimatch`, Commander.js,
existing `ora`/`chalk` for CLI output.

**Out of scope (Phase 2):** Graph predicates (`imported-by`, `imports`), `inherit-from-import` yield
type, Next.js plugin rules.

---

## File Map

| File                                                  | Status | Responsibility                                                    |
| ----------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `packages/core/src/skeleton/types.ts`                 | Create | `SkeletonEntry`, `DraftEntry`, `SkeletonFile` types + type guards |
| `packages/core/src/skeleton/io.ts`                    | Create | `readSkeleton` / `writeSkeleton` using `yaml` package             |
| `packages/core/src/skeleton/merger.ts`                | Create | `mergeSkeleton` — append-only merge, stale detection              |
| `packages/core/src/skeleton/matcher.ts`               | Create | `matchFile` — applies skeleton attributes to a file path          |
| `packages/core/src/skeleton/index.ts`                 | Create | Re-exports all skeleton modules                                   |
| `packages/core/src/rules/types.ts`                    | Create | `Rule`, `RuleSelector`, `RuleYield`, `RuleCandidate` types        |
| `packages/core/src/rules/runner.ts`                   | Create | `runRules` — fires rules against file list, returns candidates    |
| `packages/core/src/rules/built-in/role.ts`            | Create | Built-in role rules (test/e2e/mock patterns)                      |
| `packages/core/src/rules/built-in/index.ts`           | Create | Re-exports built-in rules                                         |
| `packages/core/src/rules/index.ts`                    | Create | Re-exports all rules modules                                      |
| `packages/core/src/index.ts`                          | Modify | Export `skeleton` and `rules` modules                             |
| `packages/core/src/config/schema.ts`                  | Modify | Add `skeleton` path + `rules.disable[]` to config                 |
| `packages/core/package.json`                          | Modify | Add `yaml` dependency                                             |
| `packages/cli/src/commands/scan.ts`                   | Create | `runScan` — walk files, fire rules, merge skeleton, report        |
| `packages/cli/src/commands/annotate.ts`               | Create | `runAnnotateList` + `runAnnotateResolve`                          |
| `packages/cli/src/index.ts`                           | Modify | Register `scan` and `annotate` commands                           |
| `packages/cli/src/commands/dashboard.ts`              | Modify | Apply skeleton post-pass after connector reads                    |
| `packages/core/src/tests/skeleton/io.test.ts`         | Create | Tests for readSkeleton / writeSkeleton                            |
| `packages/core/src/tests/skeleton/merger.test.ts`     | Create | Tests for mergeSkeleton                                           |
| `packages/core/src/tests/skeleton/matcher.test.ts`    | Create | Tests for matchFile                                               |
| `packages/core/src/tests/rules/runner.test.ts`        | Create | Tests for runRules                                                |
| `packages/core/src/tests/rules/built-in/role.test.ts` | Create | Tests for built-in role rules                                     |
| `packages/cli/src/tests/commands/scan.test.ts`        | Create | Integration test for runScan                                      |
| `packages/cli/src/tests/commands/annotate.test.ts`    | Create | Tests for runAnnotateList + runAnnotateResolve                    |

---

## Task 1: Skeleton types + YAML IO

**Files:**

- Create: `packages/core/src/skeleton/types.ts`
- Create: `packages/core/src/skeleton/io.ts`
- Create: `packages/core/src/skeleton/index.ts`
- Create: `packages/core/src/tests/skeleton/io.test.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Add `yaml` dependency**

```bash
cd packages/core && pnpm add yaml
```

Expected: `yaml` appears in `packages/core/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `packages/core/src/tests/skeleton/io.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readSkeleton, writeSkeleton } from '../../skeleton/io.js'
import type { SkeletonFile } from '../../skeleton/types.js'

describe('skeleton IO', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-io-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty skeleton when file does not exist', () => {
    const result = readSkeleton(join(dir, 'missing.yaml'))
    expect(result).toEqual({ entries: [] })
  })

  it('round-trips a resolved entry', () => {
    const path = join(dir, 'skeleton.yaml')
    const skeleton: SkeletonFile = {
      entries: [
        { attributes: { domain: 'checkout', layer: 'bff' }, paths: ['app/api/checkout/**'] },
      ],
    }
    writeSkeleton(path, skeleton)
    const read = readSkeleton(path)
    expect(read.entries).toHaveLength(1)
    expect(read.entries[0].attributes).toEqual({ domain: 'checkout', layer: 'bff' })
    expect(read.entries[0].paths).toEqual(['app/api/checkout/**'])
  })

  it('round-trips a draft entry with ? key', () => {
    const path = join(dir, 'skeleton.yaml')
    const skeleton: SkeletonFile = {
      entries: [
        { attributes: { '?': 'auth' }, paths: ['src/auth/**'], draft: true, source: 'test-rule' },
      ],
    }
    writeSkeleton(path, skeleton)
    const read = readSkeleton(path)
    expect((read.entries[0] as any).draft).toBe(true)
    expect(read.entries[0].attributes['?']).toBe('auth')
    expect((read.entries[0] as any).source).toBe('test-rule')
  })

  it('round-trips a stale entry', () => {
    const path = join(dir, 'skeleton.yaml')
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { domain: 'old' }, paths: ['src/old/**'], stale: true }],
    }
    writeSkeleton(path, skeleton)
    const read = readSkeleton(path)
    expect((read.entries[0] as any).stale).toBe(true)
  })
})
```

- [ ] **Step 3: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "io.test|FAIL|Cannot find"
```

Expected: FAIL with module not found error.

- [ ] **Step 4: Create `packages/core/src/skeleton/types.ts`**

```typescript
export interface SkeletonEntry {
  attributes: Record<string, string>
  paths: string[]
  stale?: true
}

export interface DraftEntry {
  attributes: Record<string, string>
  paths: string[]
  draft: true
  source?: string
}

export type SkeletonFileEntry = SkeletonEntry | DraftEntry

export interface SkeletonFile {
  entries: SkeletonFileEntry[]
}

export function isDraft(entry: SkeletonFileEntry): entry is DraftEntry {
  return (entry as DraftEntry).draft === true
}

export function isStale(entry: SkeletonFileEntry): boolean {
  return !isDraft(entry) && (entry as SkeletonEntry).stale === true
}

export function isPending(entry: SkeletonFileEntry): boolean {
  return isDraft(entry) && '?' in entry.attributes
}
```

- [ ] **Step 5: Create `packages/core/src/skeleton/io.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { parse, stringify } from 'yaml'
import type { SkeletonFile, SkeletonFileEntry } from './types.js'

export function readSkeleton(filePath: string): SkeletonFile {
  if (!existsSync(filePath)) return { entries: [] }
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parse(raw) as SkeletonFileEntry[] | null
  return { entries: Array.isArray(parsed) ? parsed : [] }
}

export function writeSkeleton(filePath: string, skeleton: SkeletonFile): void {
  writeFileSync(filePath, stringify(skeleton.entries, { lineWidth: 0 }), 'utf-8')
}
```

- [ ] **Step 6: Create `packages/core/src/skeleton/index.ts`**

```typescript
export * from './types.js'
export * from './io.js'
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "io.test|✓|✗|PASS|FAIL"
```

Expected: all 4 io.test cases pass.

- [ ] **Step 8: Commit**

```bash
cd packages/core && git add src/skeleton/ src/tests/skeleton/io.test.ts package.json pnpm-lock.yaml
git commit -m "feat: Add skeleton types and YAML IO"
```

---

## Task 2: Skeleton merger

**Files:**

- Create: `packages/core/src/skeleton/merger.ts`
- Create: `packages/core/src/tests/skeleton/merger.test.ts`
- Modify: `packages/core/src/skeleton/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/tests/skeleton/merger.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mergeSkeleton } from '../../skeleton/merger.js'
import type { SkeletonFile } from '../../skeleton/types.js'

describe('mergeSkeleton', () => {
  it('adds new candidate to empty skeleton', () => {
    const { skeleton, added } = mergeSkeleton(
      { entries: [] },
      [{ attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] }],
      ['src/checkout/service.ts']
    )
    expect(added).toBe(1)
    expect(skeleton.entries).toHaveLength(1)
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'checkout' })
  })

  it('skips candidates already covered by existing entries', () => {
    const existing: SkeletonFile = {
      entries: [{ attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] }],
    }
    const { added, unchanged } = mergeSkeleton(
      existing,
      [{ attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] }],
      ['src/checkout/service.ts']
    )
    expect(added).toBe(0)
    expect(unchanged).toBe(1)
  })

  it('marks resolved entries stale when no files match their paths', () => {
    const existing: SkeletonFile = {
      entries: [{ attributes: { domain: 'old' }, paths: ['src/old/**'] }],
    }
    const { skeleton, markedStale } = mergeSkeleton(existing, [], ['src/checkout/service.ts'])
    expect(markedStale).toBe(1)
    expect((skeleton.entries[0] as any).stale).toBe(true)
  })

  it('does not mark draft entries stale', () => {
    const existing: SkeletonFile = {
      entries: [{ attributes: { '?': 'auth' }, paths: ['src/auth/**'], draft: true }],
    }
    const { markedStale } = mergeSkeleton(existing, [], [])
    expect(markedStale).toBe(0)
  })

  it('marks uncertain candidates as draft entries', () => {
    const { skeleton } = mergeSkeleton(
      { entries: [] },
      [{ attributes: { '?': 'auth' }, paths: ['src/auth/**'], source: 'test-rule' }],
      ['src/auth/service.ts']
    )
    const entry = skeleton.entries[0] as any
    expect(entry.draft).toBe(true)
    expect(entry.attributes['?']).toBe('auth')
    expect(entry.source).toBe('test-rule')
  })

  it('preserves existing annotated entry and does not mark stale if files exist', () => {
    const existing: SkeletonFile = {
      entries: [{ attributes: { domain: 'auth', layer: 'service' }, paths: ['src/auth/**'] }],
    }
    const { skeleton, markedStale } = mergeSkeleton(
      existing,
      [],
      ['src/auth/service.ts', 'src/auth/types.ts']
    )
    expect(markedStale).toBe(0)
    expect((skeleton.entries[0] as any).stale).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "merger.test|Cannot find"
```

Expected: FAIL with module not found.

- [ ] **Step 3: Create `packages/core/src/skeleton/merger.ts`**

```typescript
import { minimatch } from 'minimatch'
import type { SkeletonFile, SkeletonFileEntry, DraftEntry } from './types.js'
import { isDraft, isStale } from './types.js'

export interface MergeCandidate {
  attributes: Record<string, string>
  paths: string[]
  source?: string
}

export interface MergeResult {
  skeleton: SkeletonFile
  added: number
  unchanged: number
  markedStale: number
}

export function mergeSkeleton(
  existing: SkeletonFile,
  candidates: MergeCandidate[],
  allRelativeFilePaths: string[]
): MergeResult {
  // Deep-copy entries so we don't mutate the input
  const entries: SkeletonFileEntry[] = existing.entries.map(e => ({
    ...e,
    attributes: { ...e.attributes },
  }))
  let markedStale = 0
  let added = 0
  let unchanged = 0

  // Mark resolved entries stale if no current files match their paths
  for (const entry of entries) {
    if (isDraft(entry) || isStale(entry)) continue
    const hasFiles = entry.paths.some(p =>
      allRelativeFilePaths.some(f => minimatch(f, p, { dot: true }))
    )
    if (!hasFiles) {
      ;(entry as any).stale = true
      markedStale++
    }
  }

  // Add new candidates not covered by any existing entry
  for (const candidate of candidates) {
    const alreadyExists = entries.some(e => candidate.paths.some(cp => e.paths.includes(cp)))
    if (alreadyExists) {
      unchanged++
      continue
    }
    const isUncertain = '?' in candidate.attributes
    const newEntry: SkeletonFileEntry = isUncertain
      ? ({
          attributes: candidate.attributes,
          paths: candidate.paths,
          draft: true,
          source: candidate.source,
        } as DraftEntry)
      : { attributes: candidate.attributes, paths: candidate.paths }
    entries.push(newEntry)
    added++
  }

  return { skeleton: { entries }, added, unchanged, markedStale }
}
```

- [ ] **Step 4: Add merger export to `packages/core/src/skeleton/index.ts`**

```typescript
export * from './types.js'
export * from './io.js'
export * from './merger.js'
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "merger.test|✓|✗|PASS|FAIL"
```

Expected: all 6 merger tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/skeleton/merger.ts packages/core/src/skeleton/index.ts packages/core/src/tests/skeleton/merger.test.ts
git commit -m "feat: Add skeleton merger with append-only merge and stale detection"
```

---

## Task 3: Skeleton matcher

**Files:**

- Create: `packages/core/src/skeleton/matcher.ts`
- Create: `packages/core/src/tests/skeleton/matcher.test.ts`
- Modify: `packages/core/src/skeleton/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/tests/skeleton/matcher.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { matchFile } from '../../skeleton/matcher.js'
import type { SkeletonFile } from '../../skeleton/types.js'

describe('matchFile', () => {
  const projectRoot = '/project'

  it('returns empty object when no entries match', () => {
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] }],
    }
    expect(matchFile('/project/src/other/file.ts', skeleton, projectRoot)).toEqual({})
  })

  it('returns attributes when path matches a glob', () => {
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { domain: 'checkout', layer: 'bff' }, paths: ['src/checkout/**'] }],
    }
    const result = matchFile('/project/src/checkout/service.ts', skeleton, projectRoot)
    expect(result).toEqual({ domain: 'checkout', layer: 'bff' })
  })

  it('merges attributes from multiple matching entries', () => {
    const skeleton: SkeletonFile = {
      entries: [
        { attributes: { domain: 'checkout' }, paths: ['src/checkout/**'] },
        { attributes: { tag: 'utils' }, paths: ['**/utils/**'] },
      ],
    }
    const result = matchFile('/project/src/checkout/utils/format.ts', skeleton, projectRoot)
    expect(result).toEqual({ domain: 'checkout', tag: 'utils' })
  })

  it('skips draft entries', () => {
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { '?': 'auth' }, paths: ['src/auth/**'], draft: true }],
    }
    expect(matchFile('/project/src/auth/service.ts', skeleton, projectRoot)).toEqual({})
  })

  it('works with absolute file path at project root', () => {
    const skeleton: SkeletonFile = {
      entries: [{ attributes: { tag: 'utils' }, paths: ['**/utils/**'] }],
    }
    expect(matchFile('/project/src/utils/format.ts', skeleton, projectRoot)).toEqual({
      tag: 'utils',
    })
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "matcher.test|Cannot find"
```

Expected: FAIL.

- [ ] **Step 3: Create `packages/core/src/skeleton/matcher.ts`**

```typescript
import { minimatch } from 'minimatch'
import type { SkeletonFile } from './types.js'
import { isDraft } from './types.js'

export function matchFile(
  absoluteFilePath: string,
  skeleton: SkeletonFile,
  projectRoot: string
): Record<string, string> {
  const relPath = absoluteFilePath.startsWith(projectRoot + '/')
    ? absoluteFilePath.slice(projectRoot.length + 1)
    : absoluteFilePath

  const result: Record<string, string> = {}

  for (const entry of skeleton.entries) {
    if (isDraft(entry)) continue
    const matches = entry.paths.some(p => minimatch(relPath, p, { dot: true }))
    if (matches) {
      Object.assign(result, entry.attributes)
    }
  }

  return result
}
```

- [ ] **Step 4: Update `packages/core/src/skeleton/index.ts`**

```typescript
export * from './types.js'
export * from './io.js'
export * from './merger.js'
export * from './matcher.js'
```

- [ ] **Step 5: Update `packages/core/src/index.ts`** to export skeleton:

```typescript
export * from './classification/index.js'
export * from './config/index.js'
export * from './skeleton/index.js'
```

- [ ] **Step 6: Run all core tests**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all tests pass including new matcher tests.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/skeleton/matcher.ts packages/core/src/skeleton/index.ts packages/core/src/index.ts packages/core/src/tests/skeleton/matcher.test.ts
git commit -m "feat: Add skeleton matcher and export skeleton from core"
```

---

## Task 4: Rule types + runner

**Files:**

- Create: `packages/core/src/rules/types.ts`
- Create: `packages/core/src/rules/runner.ts`
- Create: `packages/core/src/rules/index.ts`
- Create: `packages/core/src/tests/rules/runner.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/tests/rules/runner.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRules } from '../../rules/runner.js'
import type { Rule } from '../../rules/types.js'

describe('runRules', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-rules-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('returns empty when no rules match', () => {
    const rules: Rule[] = [
      {
        id: 'r1',
        selector: { path: 'src/checkout/**' },
        yields: [{ kind: 'concrete', key: 'domain', value: 'checkout' }],
      },
    ]
    expect(runRules(['src/other/file.ts'], rules, projectRoot)).toHaveLength(0)
  })

  it('returns concrete yield for matching path', () => {
    const rules: Rule[] = [
      {
        id: 'utils',
        selector: { path: '**/utils/**' },
        yields: [{ kind: 'concrete', key: 'tag', value: 'utils' }],
      },
    ]
    const result = runRules(['src/auth/utils/format.ts'], rules, projectRoot)
    expect(result).toHaveLength(1)
    expect(result[0].attributes).toEqual({ tag: 'utils' })
    expect(result[0].isUncertain).toBe(false)
  })

  it('extracts capture group into dimension value', () => {
    const rules: Rule[] = [
      {
        id: 'api',
        selector: { path: 'app/api/($1)/**/route.ts' },
        yields: [
          { kind: 'concrete', key: 'role', value: 'api-endpoint' },
          { kind: 'extracted', key: 'domain', capture: 1 },
        ],
      },
    ]
    const result = runRules(
      ['app/api/checkout/route.ts', 'app/api/payments/route.ts'],
      rules,
      projectRoot
    )
    expect(result).toHaveLength(2)
    const checkout = result.find(r => r.attributes.domain === 'checkout')!
    expect(checkout.attributes).toEqual({ role: 'api-endpoint', domain: 'checkout' })
    expect(checkout.pathPattern).toBe('app/api/checkout/**')
  })

  it('produces uncertain candidate with ? key', () => {
    const rules: Rule[] = [
      {
        id: 'modules',
        selector: { path: 'src/($1)/**' },
        yields: [{ kind: 'uncertain', capture: 1 }],
      },
    ]
    const result = runRules(['src/auth/service.ts', 'src/auth/types.ts'], rules, projectRoot)
    expect(result).toHaveLength(1)
    expect(result[0].attributes['?']).toBe('auth')
    expect(result[0].isUncertain).toBe(true)
    expect(result[0].source).toBe('modules')
  })

  it('collapses multiple files into one candidate per rule+captured value', () => {
    const rules: Rule[] = [
      {
        id: 'dom',
        selector: { path: 'src/checkout/**' },
        yields: [{ kind: 'concrete', key: 'domain', value: 'checkout' }],
      },
    ]
    const result = runRules(
      ['src/checkout/service.ts', 'src/checkout/types.ts'],
      rules,
      projectRoot
    )
    expect(result).toHaveLength(1)
  })

  it('skips disabled rules', () => {
    const rules: Rule[] = [
      {
        id: 'skip-me',
        selector: { path: '**/*.ts' },
        yields: [{ kind: 'concrete', key: 'tag', value: 'ts' }],
      },
    ]
    expect(runRules(['src/index.ts'], rules, projectRoot, new Set(['skip-me']))).toHaveLength(0)
  })

  it('applies content predicate — only matches files with matching content', () => {
    writeFileSync(
      join(projectRoot, 'Button.tsx'),
      "'use client'\nexport default function Button() {}"
    )
    writeFileSync(join(projectRoot, 'Page.tsx'), 'export default function Page() {}')

    const rules: Rule[] = [
      {
        id: 'client',
        selector: { path: '**/*.tsx', content: "^'use client'" },
        yields: [{ kind: 'concrete', key: 'layer', value: 'client-component' }],
      },
    ]
    const result = runRules(['Button.tsx', 'Page.tsx'], rules, projectRoot)
    expect(result).toHaveLength(1)
    expect(result[0].attributes.layer).toBe('client-component')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "runner.test|Cannot find"
```

Expected: FAIL.

- [ ] **Step 3: Create `packages/core/src/rules/types.ts`**

```typescript
export interface RuleSelector {
  /** Glob pattern. Use ($1), ($2), etc. for capture groups (single segment each). */
  path: string
  /** Regex string tested against the first 200 chars of the file content. */
  content?: string
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

- [ ] **Step 4: Create `packages/core/src/rules/runner.ts`**

```typescript
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Rule, RuleYield, RuleCandidate } from './types.js'

interface CompiledRule {
  rule: Rule
  regex: RegExp
  captureCount: number
}

function compileRule(rule: Rule): CompiledRule {
  let captureCount = 0
  let regexStr = rule.selector.path
    // Escape literal dots
    .replace(/\./g, '\\.')
    // Replace ($N) capture groups — each matches one path segment
    .replace(/\(\$\d+\)/g, () => {
      captureCount++
      return '([^/]+)'
    })
    // Replace /**/ (zero or more segments in the middle)
    .replace(/\/\*\*\//g, '/(?:.+/)?')
    // Replace /** at end (everything under a directory)
    .replace(/\/\*\*$/, '(?:/.+)?')
    // Replace **/ at start (any prefix path)
    .replace(/^\*\*\//, '(?:.+/)?')
    // Replace any remaining **
    .replace(/\*\*/g, '.+')
    // Replace single * (one segment, no slashes)
    .replace(/\*/g, '[^/]*')

  return { rule, regex: new RegExp(`^${regexStr}$`), captureCount }
}

function resolveYields(
  yields: RuleYield[],
  captures: string[]
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

function deriveCandidatePath(pattern: string, captures: string[]): string {
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
  disabledRuleIds: Set<string> = new Set()
): RuleCandidate[] {
  const compiled = rules.filter(r => !disabledRuleIds.has(r.id)).map(compileRule)

  const grouped = new Map<string, RuleCandidate>()

  for (const filePath of relativeFilePaths) {
    for (const { rule, regex, captureCount } of compiled) {
      const match = filePath.match(regex)
      if (!match) continue

      if (rule.selector.content) {
        try {
          const abs = join(projectRoot, filePath)
          const content = readFileSync(abs, { encoding: 'utf-8' })
          if (!new RegExp(rule.selector.content).test(content.slice(0, 200))) continue
        } catch {
          continue
        }
      }

      const captures = match.slice(1, captureCount + 1) as string[]
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

- [ ] **Step 5: Create `packages/core/src/rules/index.ts`**

```typescript
export * from './types.js'
export * from './runner.js'
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "runner.test|✓|✗|PASS|FAIL"
```

Expected: all 7 runner tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/rules/
git commit -m "feat: Add rule types and runner with path and content predicates"
```

---

## Task 5: Built-in role rules

**Files:**

- Create: `packages/core/src/rules/built-in/role.ts`
- Create: `packages/core/src/rules/built-in/index.ts`
- Create: `packages/core/src/tests/rules/built-in/role.test.ts`
- Modify: `packages/core/src/rules/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/tests/rules/built-in/role.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { runRules } from '../../../rules/runner.js'
import { builtInRoleRules } from '../../../rules/built-in/role.js'

describe('builtInRoleRules', () => {
  const projectRoot = '/project'

  it('assigns role=test to *.test.ts', () => {
    const r = runRules(['src/auth/auth.test.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=test to *.test.tsx', () => {
    const r = runRules(['src/Button.test.tsx'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=test to *.spec.ts', () => {
    const r = runRules(['src/auth/auth.spec.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=test to *.spec.tsx', () => {
    const r = runRules(['src/Button.spec.tsx'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=test to files under __tests__/', () => {
    const r = runRules(['src/__tests__/util.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=mock to files under __mocks__/', () => {
    const r = runRules(['src/__mocks__/api.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'mock')).toBe(true)
  })

  it('assigns role=e2e to *.e2e.ts', () => {
    const r = runRules(['tests/login.e2e.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'e2e')).toBe(true)
  })

  it('assigns role=e2e to *.e2e.tsx', () => {
    const r = runRules(['tests/login.e2e.tsx'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'e2e')).toBe(true)
  })

  it('assigns role=e2e to files under e2e/', () => {
    const r = runRules(['e2e/flows/checkout.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'e2e')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "role.test|Cannot find"
```

Expected: FAIL.

- [ ] **Step 3: Create `packages/core/src/rules/built-in/role.ts`**

```typescript
import type { Rule } from '../types.js'

export const builtInRoleRules: Rule[] = [
  {
    id: 'built-in:role:e2e-dir',
    selector: { path: 'e2e/**' },
    yields: [{ kind: 'concrete', key: 'role', value: 'e2e' }],
  },
  {
    id: 'built-in:role:e2e-ts',
    selector: { path: '**/*.e2e.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'e2e' }],
  },
  {
    id: 'built-in:role:e2e-tsx',
    selector: { path: '**/*.e2e.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'e2e' }],
  },
  {
    id: 'built-in:role:mock',
    selector: { path: '**/__mocks__/**' },
    yields: [{ kind: 'concrete', key: 'role', value: 'mock' }],
  },
  {
    id: 'built-in:role:test-dir',
    selector: { path: '**/__tests__/**' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
  {
    id: 'built-in:role:test-ts',
    selector: { path: '**/*.test.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
  {
    id: 'built-in:role:test-tsx',
    selector: { path: '**/*.test.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
  {
    id: 'built-in:role:spec-ts',
    selector: { path: '**/*.spec.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
  {
    id: 'built-in:role:spec-tsx',
    selector: { path: '**/*.spec.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
]
```

- [ ] **Step 4: Create `packages/core/src/rules/built-in/index.ts`**

```typescript
export * from './role.js'
```

- [ ] **Step 5: Update `packages/core/src/rules/index.ts`**

```typescript
export * from './types.js'
export * from './runner.js'
export * from './built-in/index.js'
```

- [ ] **Step 6: Update `packages/core/src/index.ts`**

```typescript
export * from './classification/index.js'
export * from './config/index.js'
export * from './skeleton/index.js'
export * from './rules/index.js'
```

- [ ] **Step 7: Run all core tests**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/built-in/ packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/src/tests/rules/built-in/
git commit -m "feat: Add built-in role rules and export rules from core"
```

---

## Task 6: Config schema — skeleton path + rules.disable

**Files:**

- Modify: `packages/core/src/config/schema.ts`
- Create: test additions in `packages/core/src/tests/config/loader.test.ts`

- [ ] **Step 1: Write the failing test**

Read the existing loader test first:

```bash
cat packages/core/src/tests/config/loader.test.ts
```

Add these cases to the existing `describe` block in `packages/core/src/tests/config/loader.test.ts`:

```typescript
it('defaults skeleton path to ./spaguettiscope.skeleton.yaml', async () => {
  writeFileSync(
    join(tmpDir, 'spaguettiscope.config.json'),
    JSON.stringify({ dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.skeleton).toBe('./spaguettiscope.skeleton.yaml')
})

it('reads custom skeleton path from config', async () => {
  writeFileSync(
    join(tmpDir, 'spaguettiscope.config.json'),
    JSON.stringify({ skeleton: './custom/skeleton.yaml', dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.skeleton).toBe('./custom/skeleton.yaml')
})

it('defaults rules.disable to empty array', async () => {
  writeFileSync(
    join(tmpDir, 'spaguettiscope.config.json'),
    JSON.stringify({ dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.rules.disable).toEqual([])
})

it('reads rules.disable from config', async () => {
  writeFileSync(
    join(tmpDir, 'spaguettiscope.config.json'),
    JSON.stringify({ rules: { disable: ['built-in:role:test-ts'] }, dashboard: { connectors: [] } })
  )
  const config = await loadConfig(tmpDir)
  expect(config.rules.disable).toEqual(['built-in:role:test-ts'])
})
```

- [ ] **Step 2: Run test — verify they fail**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "loader.test|skeleton|rules.disable|✗|Cannot"
```

Expected: the 4 new cases fail (skeleton and rules properties missing from parsed config).

- [ ] **Step 3: Update `packages/core/src/config/schema.ts`**

Replace the file with:

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
  skeleton: z.string().default('./spaguettiscope.skeleton.yaml'),
  rules: z
    .object({
      disable: z.array(z.string()).default([]),
    })
    .default({ disable: [] }),
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

export type SpascoConfig = z.infer<typeof SpascoConfigSchema>
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>
export type InferenceConfig = Record<string, InferenceRule[]>
```

- [ ] **Step 4: Run all core tests**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all tests pass including the 4 new loader cases.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/schema.ts packages/core/src/tests/config/loader.test.ts
git commit -m "feat: Add skeleton path and rules.disable to config schema"
```

---

## Task 7: `spasco scan` command

**Files:**

- Create: `packages/cli/src/commands/scan.ts`
- Create: `packages/cli/src/tests/commands/scan.test.ts`
- Modify: `packages/cli/src/index.ts`

Before writing this task, build core so the CLI can resolve `@spaguettiscope/core`:

```bash
cd packages/core && pnpm build
```

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/tests/commands/scan.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse } from 'yaml'
import { runScan } from '../../commands/scan.js'

function makeProject(dir: string, files: Record<string, string> = {}) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'spaguettiscope.config.json'),
    JSON.stringify({ name: 'test-project', dashboard: { connectors: [] } })
  )
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(abs.substring(0, abs.lastIndexOf('/')), { recursive: true })
    writeFileSync(abs, content)
  }
}

describe('runScan', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-scan-${Date.now()}`)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates skeleton file with draft entry for test files', async () => {
    makeProject(dir, { 'src/auth/auth.test.ts': '// test' })
    await runScan({ projectRoot: dir })
    const skeletonPath = join(dir, 'spaguettiscope.skeleton.yaml')
    expect(existsSync(skeletonPath)).toBe(true)
    const entries = parse(readFileSync(skeletonPath, 'utf-8')) as any[]
    const testEntry = entries.find((e: any) => e.attributes?.role === 'test')
    expect(testEntry).toBeDefined()
  })

  it('does not overwrite existing annotated entries on re-scan', async () => {
    makeProject(dir, { 'src/auth/auth.test.ts': '// test' })
    // First scan
    await runScan({ projectRoot: dir })
    // Manually annotate skeleton
    const skeletonPath = join(dir, 'spaguettiscope.skeleton.yaml')
    writeFileSync(
      skeletonPath,
      `- attributes:\n    domain: auth\n    layer: service\n  paths:\n    - src/auth/**\n`
    )
    // Second scan — should not remove the annotated entry
    await runScan({ projectRoot: dir })
    const entries = parse(readFileSync(skeletonPath, 'utf-8')) as any[]
    const authEntry = entries.find((e: any) => e.attributes?.domain === 'auth')
    expect(authEntry).toBeDefined()
    expect(authEntry.attributes.layer).toBe('service')
  })

  it('marks entries stale when their paths no longer exist', async () => {
    makeProject(dir, {})
    // Start with a skeleton entry for a path that has no files
    const skeletonPath = join(dir, 'spaguettiscope.skeleton.yaml')
    writeFileSync(skeletonPath, `- attributes:\n    domain: old\n  paths:\n    - src/old/**\n`)
    await runScan({ projectRoot: dir })
    const entries = parse(readFileSync(skeletonPath, 'utf-8')) as any[]
    const oldEntry = entries.find((e: any) => e.attributes?.domain === 'old')
    expect(oldEntry?.stale).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "scan.test|Cannot find"
```

Expected: FAIL.

- [ ] **Step 3: Create `packages/cli/src/commands/scan.ts`**

```typescript
import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ora from 'ora'
import {
  loadConfig,
  readSkeleton,
  writeSkeleton,
  mergeSkeleton,
  runRules,
  builtInRoleRules,
} from '@spaguettiscope/core'
import { printSuccess } from '../formatter/index.js'

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

function walkFiles(dir: string, projectRoot: string): string[] {
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

export interface ScanOptions {
  projectRoot?: string
}

export async function runScan(options: ScanOptions = {}): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const disabledRuleIds = new Set(config.rules.disable)

  const fileSpinner = ora('Scanning files…').start()
  const allFiles = walkFiles(projectRoot, projectRoot)
  fileSpinner.succeed(`Found ${allFiles.length} files`)

  const ruleSpinner = ora('Running rules…').start()
  const candidates = runRules(allFiles, builtInRoleRules, projectRoot, disabledRuleIds)
  ruleSpinner.succeed(`Rules produced ${candidates.length} candidates`)

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

- [ ] **Step 4: Register `scan` in `packages/cli/src/index.ts`**

Add after the existing `program.command('dashboard')` block:

```typescript
import { runScan } from './commands/scan.js'
```

And add the command:

```typescript
program
  .command('scan')
  .description('Scan project files with rules and merge results into skeleton')
  .action(async () => {
    try {
      await runScan()
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })
```

The full updated `packages/cli/src/index.ts`:

```typescript
import { Command } from 'commander'
import { runDashboard } from './commands/dashboard.js'
import { runScan } from './commands/scan.js'

const program = new Command()

program.name('spasco').description('SpaguettiScope — Look at your spaghetti.').version('2.0.0')

program
  .command('dashboard')
  .description('Generate run quality dashboard from CI artifacts')
  .option('--config <file>', 'Path to config file')
  .option('--output <dir>', 'Output directory for dashboard', './reports')
  .option('--open', 'Open dashboard in browser after generating')
  .option('--ci', 'CI mode: terminal summary only, no HTML output')
  .action(async options => {
    try {
      await runDashboard(options)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('scan')
  .description('Scan project files with rules and merge results into skeleton')
  .action(async () => {
    try {
      await runScan()
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

program.parse()
```

- [ ] **Step 5: Run all CLI tests**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all tests pass including the 3 new scan tests.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/scan.ts packages/cli/src/index.ts packages/cli/src/tests/commands/scan.test.ts
git commit -m "feat: Add spasco scan command"
```

---

## Task 8: `spasco annotate` commands

**Files:**

- Create: `packages/cli/src/commands/annotate.ts`
- Create: `packages/cli/src/tests/commands/annotate.test.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/tests/commands/annotate.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runAnnotateResolve } from '../../commands/annotate.js'
import { readSkeleton } from '@spaguettiscope/core'

function makeProject(dir: string, skeletonYaml: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'spaguettiscope.config.json'),
    JSON.stringify({ name: 'test', dashboard: { connectors: [] } })
  )
  writeFileSync(join(dir, 'spaguettiscope.skeleton.yaml'), skeletonYaml)
}

describe('runAnnotateResolve', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-annotate-${Date.now()}`)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('resolves ? entry to named dimension', async () => {
    makeProject(dir, `- attributes:\n    "?": auth\n  paths:\n    - src/auth/**\n  draft: true\n`)
    await runAnnotateResolve({ values: ['auth'], all: false, as: 'domain', projectRoot: dir })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'auth' })
    expect((skeleton.entries[0] as any).draft).toBeUndefined()
  })

  it('adds extra attributes during resolution', async () => {
    makeProject(dir, `- attributes:\n    "?": auth\n  paths:\n    - src/auth/**\n  draft: true\n`)
    await runAnnotateResolve({
      values: ['auth'],
      all: false,
      as: 'domain',
      add: 'layer=service,tag=tentative',
      projectRoot: dir,
    })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({
      domain: 'auth',
      layer: 'service',
      tag: 'tentative',
    })
  })

  it('resolves all ? entries when all=true', async () => {
    makeProject(
      dir,
      [
        `- attributes:`,
        `    "?": auth`,
        `  paths:`,
        `    - src/auth/**`,
        `  draft: true`,
        `- attributes:`,
        `    "?": clients`,
        `  paths:`,
        `    - src/clients/**`,
        `  draft: true`,
      ].join('\n')
    )
    await runAnnotateResolve({ values: [], all: true, as: 'domain', projectRoot: dir })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'auth' })
    expect(skeleton.entries[1].attributes).toEqual({ domain: 'clients' })
  })

  it('leaves non-targeted ? entries untouched', async () => {
    makeProject(
      dir,
      [
        `- attributes:`,
        `    "?": auth`,
        `  paths:`,
        `    - src/auth/**`,
        `  draft: true`,
        `- attributes:`,
        `    "?": clients`,
        `  paths:`,
        `    - src/clients/**`,
        `  draft: true`,
      ].join('\n')
    )
    await runAnnotateResolve({ values: ['auth'], all: false, as: 'domain', projectRoot: dir })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'auth' })
    expect(skeleton.entries[1].attributes['?']).toBe('clients')
  })

  it('does not touch already-resolved entries', async () => {
    makeProject(
      dir,
      [`- attributes:`, `    domain: checkout`, `  paths:`, `    - src/checkout/**`].join('\n')
    )
    await runAnnotateResolve({ values: [], all: true, as: 'domain', projectRoot: dir })
    const skeleton = readSkeleton(join(dir, 'spaguettiscope.skeleton.yaml'))
    expect(skeleton.entries[0].attributes).toEqual({ domain: 'checkout' })
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "annotate.test|Cannot find"
```

Expected: FAIL.

- [ ] **Step 3: Create `packages/cli/src/commands/annotate.ts`**

```typescript
import { resolve } from 'node:path'
import { loadConfig, readSkeleton, writeSkeleton, isDraft } from '@spaguettiscope/core'
import { printSuccess } from '../formatter/index.js'

export async function runAnnotateList(options: { projectRoot?: string } = {}): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const skeleton = readSkeleton(skeletonPath)

  const pending = skeleton.entries.filter(e => isDraft(e) && '?' in e.attributes)

  if (pending.length === 0) {
    console.log('No pending annotations. Skeleton is fully resolved.')
    return
  }

  console.log(`\n? entries requiring annotation (${pending.length}):\n`)
  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i]
    const value = entry.attributes['?']
    const paths = entry.paths.join(', ')
    const src = (entry as any).source ? `  (${(entry as any).source})` : ''
    console.log(`  [${i + 1}] ? = "${value}"   ${paths}${src}`)
  }
  console.log()
}

export interface ResolveOptions {
  values: string[]
  all: boolean
  as: string
  add?: string
  projectRoot?: string
}

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
    if (!isDraft(entry) || !('?' in entry.attributes)) return entry

    const uncertain = entry.attributes['?']
    const shouldResolve = options.all || options.values.includes(uncertain)
    if (!shouldResolve) return entry

    const newAttributes: Record<string, string> = { ...entry.attributes }
    delete newAttributes['?']
    newAttributes[options.as] = uncertain
    Object.assign(newAttributes, extraAttrs)

    resolved++
    // Remove draft flag — entry becomes resolved
    return { attributes: newAttributes, paths: entry.paths }
  })

  writeSkeleton(skeletonPath, { entries })
  printSuccess(`Resolved ${resolved} entr${resolved === 1 ? 'y' : 'ies'}`)
}
```

- [ ] **Step 4: Register `annotate` in `packages/cli/src/index.ts`**

Add import and command. The full updated file:

```typescript
import { Command } from 'commander'
import { runDashboard } from './commands/dashboard.js'
import { runScan } from './commands/scan.js'
import { runAnnotateList, runAnnotateResolve } from './commands/annotate.js'

const program = new Command()

program.name('spasco').description('SpaguettiScope — Look at your spaghetti.').version('2.0.0')

program
  .command('dashboard')
  .description('Generate run quality dashboard from CI artifacts')
  .option('--config <file>', 'Path to config file')
  .option('--output <dir>', 'Output directory for dashboard', './reports')
  .option('--open', 'Open dashboard in browser after generating')
  .option('--ci', 'CI mode: terminal summary only, no HTML output')
  .action(async options => {
    try {
      await runDashboard(options)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('scan')
  .description('Scan project files with rules and merge results into skeleton')
  .action(async () => {
    try {
      await runScan()
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

const annotate = program.command('annotate').description('Manage skeleton annotations')

annotate
  .command('list')
  .description('List all unresolved ? entries in the skeleton')
  .action(async () => {
    try {
      await runAnnotateList()
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

annotate
  .command('resolve [values]')
  .description(
    'Resolve ? entries. [values] is comma-separated captured values, or use --all to resolve all'
  )
  .option('--all', 'Resolve all pending ? entries', false)
  .option('--as <dimension>', 'Dimension name to assign (e.g. domain)')
  .option(
    '--add <attrs>',
    'Extra key=value pairs to add (comma-separated, e.g. layer=service,tag=tentative)'
  )
  .action(
    async (values: string | undefined, options: { all: boolean; as: string; add?: string }) => {
      try {
        await runAnnotateResolve({
          values: options.all
            ? []
            : (values ?? '')
                .split(',')
                .map(v => v.trim())
                .filter(Boolean),
          all: options.all,
          as: options.as,
          add: options.add,
        })
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    }
  )

program.parse()
```

- [ ] **Step 5: Run all CLI tests**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/annotate.ts packages/cli/src/index.ts packages/cli/src/tests/commands/annotate.test.ts
git commit -m "feat: Add spasco annotate list and annotate resolve commands"
```

---

## Task 9: Dashboard skeleton post-pass

**Files:**

- Modify: `packages/cli/src/commands/dashboard.ts`
- Modify: `packages/cli/src/tests/commands/dashboard.test.ts`

The post-pass reads the skeleton and applies its attributes to each record after connector reads,
overriding inference-engine dimensions.

- [ ] **Step 1: Write the failing test**

Add this test case to the existing `describe('runDashboard')` block in
`packages/cli/src/tests/commands/dashboard.test.ts`:

```typescript
it('applies skeleton attributes to records', async () => {
  const allureDir = join(tmpDir, 'allure-results')
  mkdirSync(allureDir)
  writeFileSync(
    join(allureDir, 'test-001-result.json'),
    JSON.stringify({
      uuid: 'test-001',
      name: 'checkout test',
      fullName: 'src/checkout/checkout.test.ts#Suite checkout test',
      status: 'passed',
      start: Date.now() - 500,
      stop: Date.now(),
      labels: [{ name: 'testSourceFile', value: 'src/checkout/checkout.test.ts' }],
    })
  )
  writeFileSync(
    join(tmpDir, 'spaguettiscope.config.json'),
    JSON.stringify({ dashboard: { connectors: [{ id: 'allure', resultsDir: allureDir }] } })
  )
  // Write a skeleton that assigns domain=checkout to src/checkout/**
  writeFileSync(
    join(tmpDir, 'spaguettiscope.skeleton.yaml'),
    `- attributes:\n    domain: checkout\n    layer: bff\n  paths:\n    - src/checkout/**\n`
  )

  const outputDir = join(tmpDir, 'reports')
  await runDashboard({ ci: false, output: outputDir, projectRoot: tmpDir })

  const records = JSON.parse(readFileSync(join(outputDir, 'data', 'records.json'), 'utf-8'))
  const record = records[0]
  expect(record.dimensions.domain).toBe('checkout')
  expect(record.dimensions.layer).toBe('bff')
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "applies skeleton|✗|Cannot"
```

Expected: FAIL — skeleton attributes not applied to records.

- [ ] **Step 3: Update `packages/cli/src/commands/dashboard.ts`**

Add these two imports at the top with existing imports from `@spaguettiscope/core`:

```typescript
import {
  loadConfig,
  InferenceEngine,
  defaultDefinitions,
  readSkeleton,
  matchFile,
} from '@spaguettiscope/core'
```

Then add the skeleton post-pass after the connector reads loop (after `records.push(...results)`
loop ends, before `const aggregated = aggregateAll(records)`):

```typescript
// Apply skeleton to enrich record dimensions — skeleton takes precedence over inference
const skeletonPath = resolve(projectRoot, config.skeleton)
const skeleton = readSkeleton(skeletonPath)
for (const record of records) {
  if (!record.source?.file) continue
  const skeletonAttrs = matchFile(record.source.file, skeleton, projectRoot)
  Object.assign(record.dimensions, skeletonAttrs)
}
```

The full updated `packages/cli/src/commands/dashboard.ts`:

```typescript
import { writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ora from 'ora'
import {
  loadConfig,
  InferenceEngine,
  defaultDefinitions,
  readSkeleton,
  matchFile,
} from '@spaguettiscope/core'
import {
  AllureConnector,
  PlaywrightConnector,
  VitestConnector,
  LcovConnector,
  EslintConnector,
  TypescriptConnector,
  aggregateAll,
  aggregateByConnector,
  buildDashboardHtml,
  writeDashboardData,
  getRendererAssetsDir,
  formatTerminalSummary,
  appendHistory,
  readHistory,
  type DashboardData,
  type AggregatedSlice,
  type NormalizedRunRecord,
} from '@spaguettiscope/reports'
import { printBanner, printSuccess, printWarning, printBox } from '../formatter/index.js'

const CONNECTORS = [
  new AllureConnector(),
  new PlaywrightConnector(),
  new VitestConnector(),
  new LcovConnector(),
  new EslintConnector(),
  new TypescriptConnector(),
]

export interface DashboardOptions {
  config?: string
  output?: string
  open?: boolean
  ci?: boolean
  projectRoot?: string
}

export async function runDashboard(options: DashboardOptions): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()

  if (!options.ci) printBanner()
  if (options.open)
    printWarning('--open is not yet implemented — dashboard will not open automatically')

  const spinner = ora('Loading configuration…').start()
  const config = await loadConfig(projectRoot)
  spinner.succeed('Configuration loaded')

  const engine = new InferenceEngine(defaultDefinitions, projectRoot, config.inference ?? {})
  const records: NormalizedRunRecord[] = []

  for (const connectorConfig of config.dashboard.connectors) {
    const connector = CONNECTORS.find(c => c.id === connectorConfig.id)
    if (!connector) {
      printWarning(`Unknown connector: ${connectorConfig.id} — skipping`)
      continue
    }

    const connectorSpinner = ora(`Reading ${connectorConfig.id}…`).start()
    try {
      const results = await connector.read(connectorConfig, engine)
      records.push(...results)
      connectorSpinner.succeed(`Read ${connectorConfig.id} (${results.length} records)`)
    } catch (err) {
      connectorSpinner.fail(`Failed to read ${connectorConfig.id}: ${(err as Error).message}`)
    }
  }

  // Apply skeleton to enrich record dimensions — skeleton takes precedence over inference
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const skeleton = readSkeleton(skeletonPath)
  for (const record of records) {
    if (!record.source?.file) continue
    const skeletonAttrs = matchFile(record.source.file, skeleton, projectRoot)
    Object.assign(record.dimensions, skeletonAttrs)
  }

  const aggregated = aggregateAll(records)

  const outputDir = resolve(projectRoot, options.output ?? config.dashboard.outputDir)
  mkdirSync(outputDir, { recursive: true })

  const historyPath = resolve(projectRoot, config.dashboard.historyFile)
  await appendHistory(historyPath, {
    runAt: new Date().toISOString(),
    connectors: config.dashboard.connectors.map(c => c.id),
    overall: aggregated.overall,
    dimensionSummary: Object.fromEntries(
      Object.entries(aggregated)
        .filter(([k]) => k !== 'overall')
        .map(([k, slices]) => [
          k,
          Object.fromEntries(
            (slices as AggregatedSlice[]).map(s => [
              s.value,
              { total: s.total, passed: s.passed, failed: s.failed },
            ])
          ),
        ])
    ),
  })
  const history = await readHistory(historyPath)

  if (!options.ci) {
    const dashboardData: DashboardData = {
      generatedAt: new Date().toISOString(),
      projectName: config.name,
      connectors: config.dashboard.connectors.map(c => c.id),
      overall: aggregated.overall,
      dimensions: Object.fromEntries(
        Object.entries(aggregated)
          .filter(([k]) => k !== 'overall')
          .map(([k, v]) => [k, v as AggregatedSlice[]])
      ),
      history,
      byConnector: aggregateByConnector(
        records,
        Object.fromEntries(CONNECTORS.map(c => [c.id, c.category]))
      ),
    }

    const html = buildDashboardHtml()
    const outputPath = join(outputDir, 'index.html')
    writeFileSync(outputPath, html, 'utf-8')

    writeDashboardData(outputDir, dashboardData, records)

    const rendererDist = getRendererAssetsDir()
    if (existsSync(rendererDist)) {
      cpSync(rendererDist, join(outputDir, 'assets'), { recursive: true })
    }

    printSuccess(`Dashboard generated → ${outputPath}`)
  }

  const summary = formatTerminalSummary(aggregated, {
    projectName: config.name,
    connectors: config.dashboard.connectors.map(c => c.id),
  })
  printBox(summary)
}
```

- [ ] **Step 4: Run all CLI tests**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: all tests pass including the new skeleton post-pass test.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/dashboard.ts packages/cli/src/tests/commands/dashboard.test.ts
git commit -m "feat: Apply skeleton post-pass to dashboard records"
```

---

## Task 10: Build and integration check

**Files:** None new — verifies the whole feature works end-to-end.

- [ ] **Step 1: Build all packages from root**

```bash
cd /Users/jasonsantos/personal/spaguettiscope/spaguettiscope && pnpm build 2>&1 | tail -20
```

Expected: exits 0, all packages compiled.

- [ ] **Step 2: Run all tests from root**

```bash
pnpm test 2>&1 | tail -30
```

Expected: all test suites pass with 0 failures.

- [ ] **Step 3: Smoke-test against qualitiss-workspace**

```bash
cd /Users/jasonsantos/personal/qualitiss/qualitiss-workspace
node /Users/jasonsantos/personal/spaguettiscope/spaguettiscope/packages/cli/bin/spasco.js scan
```

Expected: skeleton file created at `./spaguettiscope.skeleton.yaml`. Inspect it:

```bash
cat spaguettiscope.skeleton.yaml
```

Expected: entries for test/spec/e2e files found in the workspace.

- [ ] **Step 4: Check annotate list**

```bash
node /Users/jasonsantos/personal/spaguettiscope/spaguettiscope/packages/cli/bin/spasco.js annotate list
```

Expected: either "No pending annotations" (all entries are concrete role assignments) or a list of
`?` entries.

- [ ] **Step 5: Commit**

```bash
cd /Users/jasonsantos/personal/spaguettiscope/spaguettiscope
git add -A
git commit -m "chore: Verify topology model Phase 1 build and integration"
```

---

## Phase 2 (separate plan)

The following is explicitly out of scope for this plan and requires a separate spec + plan:

- Graph predicate evaluator (import graph construction with `acorn` or `ts-morph`)
- `graph:` predicate in rule selectors (`imported-by`, `imports`, `no-imports`)
- `inherit-from-import` yield type for test-to-source linking
- Next.js plugin package (`plugins/nextjs`) with App Router rules
