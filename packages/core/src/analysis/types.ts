import type { DimensionSet } from '../classification/model.js'
import type { ImportGraph } from '../graph/index.js'

// ── Finding ─────────────────────────────────────────────────────────────────

export type FindingKind = 'violation' | 'coverage-gap' | 'flakiness' | 'unused' | 'metric'
export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
  ruleId: string
  kind: FindingKind
  severity: Severity
  subject:
    | { type: 'file'; path: string }
    | { type: 'edge'; from: string; to: string }
    | { type: 'slice'; dimensions: DimensionSet }
  /** Topology dimensions of the subject — enables aggregation by dimension. */
  dimensions: DimensionSet
  /** For metric findings: a ratio, count, or score (0–1 or raw number). */
  value?: number
  message: string
}

// ── Corpus ───────────────────────────────────────────────────────────────────

export type Corpus = 'files' | 'edges' | 'records'
export type DataSource = 'importGraph' | 'testRecords'

export interface FileItem {
  file: string
  dimensions: DimensionSet
}

export interface EdgeItem {
  from: FileItem
  to: FileItem
}

/** Minimal test record consumed by analysis rules. */
export interface TestRecord {
  id: string
  historyId?: string
  status: 'passed' | 'failed' | 'skipped' | 'broken' | 'unknown'
  dimensions: DimensionSet
}

export type RecordItem = TestRecord

export type CorpusItem<C extends Corpus> = C extends 'files'
  ? FileItem
  : C extends 'edges'
    ? EdgeItem
    : C extends 'records'
      ? RecordItem
      : never

// ── Rule ─────────────────────────────────────────────────────────────────────

export interface AnalysisRule<C extends Corpus = Corpus> {
  id: string
  severity: Severity
  needs: DataSource[]
  corpus: C
  run(item: CorpusItem<C>, ctx: AnalysisContext): Finding[]
}

// ── Plugin ───────────────────────────────────────────────────────────────────

export interface AnalysisPlugin {
  id: string
  canApply(packageRoot: string): boolean
  rules(): AnalysisRule[]
}

// ── Context ──────────────────────────────────────────────────────────────────

export interface IntermediateCache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
}

export interface AnalysisContext {
  /** Full skeleton as a flat map: relative file path → DimensionSet. */
  topology: Map<string, DimensionSet>
  /** Present only if at least one active rule declared 'importGraph' in needs. */
  importGraph?: ImportGraph
  /** Present only if at least one active rule declared 'testRecords' in needs. */
  testRecords?: TestRecord[]
  cache: IntermediateCache
}
