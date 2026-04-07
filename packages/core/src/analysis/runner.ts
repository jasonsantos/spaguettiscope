import type {
  AnalysisRule,
  AnalysisContext,
  Finding,
  FileItem,
  EdgeItem,
  TestRecord,
  IntermediateCache,
} from './types.js'
import type { DimensionSet } from '../classification/model.js'
import type { ImportGraph } from '../graph/index.js'
import type { LayerPolicyEdge } from '../skeleton/types.js'

export interface RunAnalysisOptions {
  /** All project file paths (relative to project root). */
  files: string[]
  /** Flat map of file path → dimensions from the skeleton. */
  topology: Map<string, DimensionSet>
  rules: AnalysisRule[]
  importGraph?: ImportGraph
  testRecords?: TestRecord[]
  cache: IntermediateCache
  layerPolicy?: Record<string, LayerPolicyEdge[]>
  layerPolicyDraft?: boolean
}

export function runAnalysis(options: RunAnalysisOptions): Finding[] {
  const { files, topology, rules, importGraph, testRecords, cache, layerPolicy, layerPolicyDraft } = options

  const ctx: AnalysisContext = { topology, importGraph, testRecords, cache, layerPolicy, layerPolicyDraft }
  const findings: Finding[] = []

  // ── Files corpus ─────────────────────────────────────────────────────────
  const fileRules = rules.filter(r => r.corpus === 'files')
  if (fileRules.length > 0) {
    for (const file of files) {
      const dimensions = topology.get(file) ?? {}
      const item: FileItem = { file, dimensions }
      for (const rule of fileRules) {
        findings.push(...rule.run(item as never, ctx))
      }
    }
  }

  // ── Edges corpus ─────────────────────────────────────────────────────────
  const edgeRules = rules.filter(r => r.corpus === 'edges')
  if (edgeRules.length > 0 && importGraph) {
    for (const [fromFile, targets] of importGraph.imports) {
      const fromDimensions = topology.get(fromFile) ?? {}
      for (const toFile of targets) {
        const toDimensions = topology.get(toFile) ?? {}
        const item: EdgeItem = {
          from: { file: fromFile, dimensions: fromDimensions },
          to: { file: toFile, dimensions: toDimensions },
        }
        for (const rule of edgeRules) {
          findings.push(...rule.run(item as never, ctx))
        }
      }
    }
  }

  // ── Records corpus ────────────────────────────────────────────────────────
  const recordRules = rules.filter(r => r.corpus === 'records')
  if (recordRules.length > 0 && testRecords) {
    for (const record of testRecords) {
      for (const rule of recordRules) {
        findings.push(...rule.run(record as never, ctx))
      }
    }
  }

  return findings
}
