import type { EntropyInput, EntropyResult, ImportGraph, Finding, DimensionSet } from '@spaguettiscope/core'
import { computeEntropy } from '@spaguettiscope/core'
import type { NormalizedRunRecord } from '@spaguettiscope/reports'

export interface GatherEntropyInputOptions {
  files: string[]
  importGraph: ImportGraph
  findings: Finding[]
  topology: Map<string, DimensionSet>
  records: NormalizedRunRecord[]
}

export function gatherEntropyInput(opts: GatherEntropyInputOptions): EntropyInput {
  const { files, importGraph, findings, topology, records } = opts

  // Pass rate from testing records (exclude coverage/lint connectors)
  const testRecords = records
    .filter(r => r.status === 'passed' || r.status === 'failed' || r.status === 'skipped' || r.status === 'broken')
    .filter(r => r.connectorId !== 'lcov' && r.connectorId !== 'eslint' && r.connectorId !== 'typescript')
  const passedCount = testRecords.filter(r => r.status === 'passed').length
  const totalTests = testRecords.length
  const passRate = totalTests > 0 ? passedCount / totalTests : undefined

  // Flaky ratio from flakiness findings
  const flakyFindings = findings.filter(f => f.kind === 'flakiness')
  const flakyRatio = totalTests > 0 ? flakyFindings.length / totalTests : 0

  // Circular deps from findings
  const circularDepFiles = new Set(
    findings
      .filter(f => f.ruleId === 'built-in:circular-dep')
      .map(f => (f.subject.type === 'file' ? f.subject.path : ''))
      .filter(Boolean)
  ).size

  // Graph metrics
  let edgeCount = 0
  let maxFanOut = 0
  for (const [, targets] of importGraph.imports) {
    edgeCount += targets.size
    if (targets.size > maxFanOut) maxFanOut = targets.size
  }

  // Unused exports from findings
  const unusedExports = findings.filter(f => f.ruleId === 'built-in:unused-export').length

  // LCov coverage
  const lcovRecords = records.filter(r => r.connectorId === 'lcov')
  const lcovPassed = lcovRecords.filter(r => r.status === 'passed').length
  const lcovCoverage = lcovRecords.length > 0 ? lcovPassed / lcovRecords.length : undefined

  // Coverage gaps from findings
  const coverageGaps = findings.filter(f => f.kind === 'coverage-gap').length

  // Findings by severity weight
  const findingsByWeight = findings.reduce((sum, f) => {
    if (f.severity === 'error') return sum + 3
    if (f.severity === 'warning') return sum + 1
    return sum + 0.5
  }, 0)

  // Classification completeness
  const totalEntries = topology.size
  const resolvedEntries = [...topology.values()].filter(dims => {
    const keys = Object.keys(dims)
    return keys.length > 0 && !keys.some(k => k.endsWith('?') || k === '?')
  }).length
  const resolvedRatio = totalEntries > 0 ? resolvedEntries / totalEntries : 1

  return {
    fileCount: files.length,
    passRate,
    flakyRatio,
    circularDepFiles,
    edgeCount,
    maxFanOut,
    unusedExports,
    lcovCoverage,
    coverageGaps,
    findingsByWeight,
    resolvedRatio,
  }
}

/**
 * Compute entropy overall and per-package.
 */
export function computeEntropyForProject(
  opts: GatherEntropyInputOptions,
  packages: Array<{ rel: string }>
): {
  overall: EntropyResult
  byPackage: Record<string, EntropyResult>
} {
  const overall = computeEntropy(gatherEntropyInput(opts))

  const byPackage: Record<string, EntropyResult> = {}
  for (const pkg of packages) {
    if (pkg.rel === '.') continue
    const pkgFiles = opts.files.filter(f => f.startsWith(pkg.rel + '/'))
    if (pkgFiles.length === 0) continue

    const pkgFindings = opts.findings.filter(f => {
      if (f.subject.type === 'file') return f.subject.path.startsWith(pkg.rel + '/')
      if (f.subject.type === 'edge') return f.subject.from.startsWith(pkg.rel + '/')
      return false
    })

    // Build scoped import graph metrics
    const pkgImports = new Map<string, Set<string>>()
    for (const [src, targets] of opts.importGraph.imports) {
      if (!src.startsWith(pkg.rel + '/')) continue
      const filtered = new Set([...targets].filter(t => t.startsWith(pkg.rel + '/')))
      if (filtered.size > 0) pkgImports.set(src, filtered)
    }
    const scopedGraph: ImportGraph = {
      imports: pkgImports,
      importedBy: new Map(),
      typeOnlyImports: new Map(),
    }

    const pkgRecords = opts.records.filter(r => {
      const dims = r.dimensions as Record<string, string>
      return dims.package?.includes(pkg.rel) || false
    })

    const pkgTopology = new Map<string, DimensionSet>()
    for (const [file, dims] of opts.topology) {
      if (file.startsWith(pkg.rel + '/')) pkgTopology.set(file, dims)
    }

    const pkgInput = gatherEntropyInput({
      files: pkgFiles,
      importGraph: scopedGraph,
      findings: pkgFindings,
      topology: pkgTopology,
      records: pkgRecords,
    })

    byPackage[pkg.rel] = computeEntropy(pkgInput)
  }

  return { overall, byPackage }
}
