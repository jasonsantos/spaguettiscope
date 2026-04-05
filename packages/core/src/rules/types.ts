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
