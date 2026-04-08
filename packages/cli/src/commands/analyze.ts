import { resolve, join } from 'node:path'
import ora from 'ora'
import {
  loadConfig,
  readSkeleton,
  matchFile,
  discoverWorkspaces,
  buildImportGraph,
  mergeImportGraphs,
  runAnalysis,
  builtInAnalysisRules,
  loadIntermediateCache,
  saveIntermediateCache,
  InferenceEngine,
  defaultDefinitions,
  computeEntropy,
  type AnalysisRule,
  type TestRecord,
  type Finding,
  type EntropyResult,
  type EntropyInput,
} from '@spaguettiscope/core'
import { walkFiles } from '../utils/files.js'
import { AllureConnector } from '@spaguettiscope/reports'
import { printSuccess, printWarning } from '../formatter/index.js'

export interface AnalyzeOptions {
  projectRoot?: string
  ci?: boolean
}

export interface AnalyzeResult {
  findings: Finding[]
  summary: { error: number; warning: number; info: number }
  entropy: EntropyResult
}

export async function runAnalyzeCommand(options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const intermediatesPath = resolve(projectRoot, config.analysis.intermediates)

  // 1. Read topology from skeleton
  const skeleton = readSkeleton(skeletonPath)
  const topology = new Map<string, Record<string, string>>()
  const allFiles = walkFiles(projectRoot, projectRoot)
  for (const relFile of allFiles) {
    const absFile = join(projectRoot, relFile)
    try {
      const match = matchFile(absFile, skeleton, projectRoot)
      topology.set(relFile, match)
    } catch {
      // file outside projectRoot or other error — skip
    }
  }

  // 2. Build import graph
  const graphSpinner = ora('Building import graph…').start()
  const packages = discoverWorkspaces(projectRoot)
  const filesByPackage = new Map<string, string[]>()
  for (const pkg of packages) filesByPackage.set(pkg.rel, [])
  for (const f of allFiles) {
    const matchingPkg = packages.find(pkg => pkg.rel === '.' || f.startsWith(pkg.rel + '/'))
    if (matchingPkg) filesByPackage.get(matchingPkg.rel)!.push(f)
  }
  const importGraph = mergeImportGraphs(
    packages.map(pkg => buildImportGraph(pkg.root, filesByPackage.get(pkg.rel) ?? [], projectRoot))
  )
  graphSpinner.succeed('Import graph built')

  // 3. Load test records from connectors
  let testRecords: TestRecord[] = []
  if (config.dashboard.connectors.length > 0) {
    const recSpinner = ora('Loading test records…').start()
    const connector = new AllureConnector()
    const engine = new InferenceEngine(defaultDefinitions, projectRoot, config.inference ?? {})
    for (const connectorConfig of config.dashboard.connectors) {
      if (connectorConfig.id === 'allure') {
        try {
          const records = await connector.read(connectorConfig, engine)
          testRecords.push(
            ...records.map(r => ({
              id: r.id,
              historyId: r.metadata?.historyId as string | undefined,
              status: r.status,
              dimensions: r.dimensions,
            }))
          )
        } catch {
          // connector error — skip
        }
      }
    }
    recSpinner.succeed(`Loaded ${testRecords.length} test records`)
  }

  // 4. Load analysis plugins from config
  const pluginRules: AnalysisRule[] = []
  for (const pluginId of config.analysisPlugins) {
    try {
      const mod = (await import(pluginId)) as Record<string, unknown>
      const plugin = (mod.default ?? Object.values(mod)[0]) as {
        id: string
        canApply(r: string): boolean
        rules(): AnalysisRule[]
      }
      if (plugin && typeof plugin.canApply === 'function') {
        for (const pkg of packages) {
          if (!plugin.canApply(pkg.root)) continue
          pluginRules.push(...plugin.rules())
        }
      }
    } catch {
      printWarning(`Failed to load analysis plugin: ${pluginId}`)
    }
  }

  // 5. Run analysis
  const analysisSpinner = ora('Running analysis rules…').start()
  const cache = loadIntermediateCache(intermediatesPath)
  const allRules: AnalysisRule[] = [...builtInAnalysisRules, ...pluginRules]
  const findings = runAnalysis({
    files: allFiles,
    topology,
    rules: allRules,
    importGraph,
    testRecords: testRecords.length > 0 ? testRecords : undefined,
    cache,
  })
  saveIntermediateCache(intermediatesPath, cache)
  analysisSpinner.succeed(`Analysis complete — ${findings.length} findings`)

  // 6. Summarise
  const summary = { error: 0, warning: 0, info: 0 }
  for (const f of findings) summary[f.severity]++

  if (!options.ci) {
    printAnalysisSummary(findings, summary)
  }

  printSuccess(
    `Analysis complete — ${summary.error} errors, ${summary.warning} warnings, ${summary.info} info`
  )

  // 7. Compute entropy
  let entropyEdgeCount = 0
  let entropyMaxFanOut = 0
  for (const [, targets] of importGraph.imports) {
    entropyEdgeCount += targets.size
    if (targets.size > entropyMaxFanOut) entropyMaxFanOut = targets.size
  }

  const flakyCount = findings.filter(f => f.kind === 'flakiness').length
  const totalTests = testRecords.length

  const entropyInput: EntropyInput = {
    fileCount: allFiles.length,
    passRate:
      totalTests > 0
        ? testRecords.filter(r => r.status === 'passed').length / totalTests
        : undefined,
    flakyRatio: totalTests > 0 ? flakyCount / totalTests : 0,
    circularDepFiles: new Set(
      findings
        .filter(f => f.ruleId === 'built-in:circular-dep')
        .map(f => (f.subject.type === 'file' ? f.subject.path : ''))
        .filter(Boolean)
    ).size,
    edgeCount: entropyEdgeCount,
    maxFanOut: entropyMaxFanOut,
    unusedExports: findings.filter(f => f.ruleId === 'built-in:unused-export').length,
    lcovCoverage: undefined,
    coverageGaps: findings.filter(f => f.kind === 'coverage-gap').length,
    findingsByWeight: findings.reduce((sum, f) => {
      if (f.severity === 'error') return sum + 3
      if (f.severity === 'warning') return sum + 1
      return sum + 0.5
    }, 0),
    resolvedRatio: (() => {
      const total = topology.size
      const resolved = [...topology.values()].filter(dims => {
        const keys = Object.keys(dims)
        return keys.length > 0 && !keys.some(k => k.endsWith('?') || k === '?')
      }).length
      return total > 0 ? resolved / total : 1
    })(),
  }
  const entropy = computeEntropy(entropyInput)
  printSuccess(`Entropy: ${entropy.score} (${entropy.classification})`)

  return { findings, summary, entropy }
}

function printAnalysisSummary(
  findings: Finding[],
  _summary: { error: number; warning: number; info: number }
): void {
  const byKind = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!byKind.has(f.kind)) byKind.set(f.kind, [])
    byKind.get(f.kind)!.push(f)
  }
  for (const [kind, group] of byKind) {
    console.log(`\n  ${kind} (${group.length})`)
    for (const f of group.slice(0, 10)) {
      const subj =
        f.subject.type === 'file'
          ? f.subject.path
          : f.subject.type === 'edge'
            ? `${f.subject.from} → ${f.subject.to}`
            : JSON.stringify(f.subject.dimensions)
      console.log(`  ├─ ${subj}`)
    }
    if (group.length > 10) console.log(`  └─ …and ${group.length - 10} more`)
  }
}
