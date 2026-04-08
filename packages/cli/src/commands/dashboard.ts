import { writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs'
import { join, resolve, isAbsolute, relative } from 'node:path'
import ora from 'ora'
import {
  loadConfig,
  InferenceEngine,
  defaultDefinitions,
  readSkeleton,
  matchFile,
  discoverWorkspaces,
  buildImportGraph,
  mergeImportGraphs,
  runAnalysis,
  builtInAnalysisRules,
  loadIntermediateCache,
  saveIntermediateCache,
  type AnalysisRule,
  type Finding,
  type EntropyResult,
} from '@spaguettiscope/core'
import { walkFiles } from '../utils/files.js'
import { computeEntropyForProject } from '../utils/entropy-input.js'
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
import { dashboardGuidance } from '../formatter/guidance.js'

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
  /** Project root directory. Defaults to process.cwd(). Pass explicitly in tests. */
  projectRoot?: string
}

function resolveRecordSourceFile(
  record: NormalizedRunRecord,
  projectRoot: string
): string | null {
  const labels = record.metadata?.labels as Array<{ name: string; value: string }> | undefined
  const raw = labels?.find(l => l.name === 'testSourceFile')?.value ?? record.source.file
  if (!raw) return null
  return isAbsolute(raw) ? raw : join(projectRoot, raw)
}

export async function runDashboard(options: DashboardOptions): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()

  if (!options.ci) printBanner()
  // TODO: --open not yet implemented
  if (options.open)
    printWarning('--open is not yet implemented — dashboard will not open automatically')

  const spinner = ora('Loading configuration…').start()
  const config = await loadConfig(projectRoot)
  spinner.succeed('Configuration loaded')

  const activeConnectorIds = [...new Set(config.dashboard.connectors.map(c => c.id))]
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
  const skeletonSetKeys = new Map<NormalizedRunRecord, Set<string>>()
  const skeleton = existsSync(skeletonPath) ? readSkeleton(skeletonPath) : null

  if (skeleton) {
    for (const record of records) {
      // Prefer the testSourceFile label (allure, etc.) over the connector result file path
      const absFilePath = resolveRecordSourceFile(record, projectRoot)
      if (!absFilePath) continue
      try {
        const skeletonAttrs = matchFile(absFilePath, skeleton, projectRoot)
        Object.assign(record.dimensions, skeletonAttrs)
        skeletonSetKeys.set(record, new Set(Object.keys(skeletonAttrs)))
      } catch {
        // File is outside projectRoot or other error — skip silently
      }
    }
  }

  // inherit-from-import pass
  const allFiles = walkFiles(projectRoot, projectRoot)
  const packages = discoverWorkspaces(projectRoot)

  if (!config.rules.disable.includes('inherit-from-import')) {
    const inheritSpinner = ora('Running inherit-from-import…').start()
    try {
      const graphs = packages.map(pkg => {
        const pkgFiles =
          pkg.rel === '.' ? allFiles : allFiles.filter(f => f.startsWith(pkg.rel + '/'))
        return buildImportGraph(pkg.root, pkgFiles, projectRoot)
      })
      const importGraph = mergeImportGraphs(graphs)

      for (const record of records) {
        if (record.dimensions.role !== 'test') continue

        const absFilePath = resolveRecordSourceFile(record, projectRoot)
        if (!absFilePath) continue

        let relFilePath: string
        try {
          relFilePath = relative(projectRoot, absFilePath)
        } catch {
          continue
        }

        const imports = importGraph.imports.get(relFilePath)
        if (!imports || imports.size === 0) continue

        const inherited: Record<string, string> = {}
        for (const importedFile of imports) {
          // Attribute lookup: skeleton takes precedence (human-annotated), inference fills the rest
          let attrs: Record<string, string> = {}
          if (skeleton) {
            try {
              attrs = matchFile(join(projectRoot, importedFile), skeleton, projectRoot)
            } catch {
              // file outside projectRoot — skip
              continue
            }
          }
          // Fill in any dimensions the skeleton didn't cover using the inference engine
          const inferred = engine.infer(join(projectRoot, importedFile))
          for (const [k, v] of Object.entries(inferred)) {
            if (!(k in attrs)) attrs[k] = v
          }
          // Don't inherit role:test from imported files — only non-test roles are meaningful
          if (attrs['role'] === 'test') delete attrs['role']
          Object.assign(inherited, attrs)
        }

        // role always inherits from the import target (that's the whole point of this pass —
        // a test file for a library module should appear under role:library, not role:test).
        // All other dimensions: direct skeleton annotation wins over inherited values.
        const skeletonKeys = skeletonSetKeys.get(record) ?? new Set<string>()
        for (const [k, v] of Object.entries(inherited)) {
          if (k === 'role' || !skeletonKeys.has(k)) {
            record.dimensions[k] = v
          }
        }
      }
      inheritSpinner.succeed('inherit-from-import applied')
    } catch (err) {
      inheritSpinner.warn(`inherit-from-import skipped: ${(err as Error).message}`)
    }
  }

  const aggregated = aggregateAll(records)

  const outputDir = resolve(projectRoot, options.output ?? config.dashboard.outputDir)
  mkdirSync(outputDir, { recursive: true })

  // Compute per-category pass rates for the trend chart
  const connectorCategoryMap = Object.fromEntries(CONNECTORS.map(c => [c.id, c.category]))
  const testingRecs  = records.filter(r => connectorCategoryMap[r.connectorId] === 'testing')
  const coverageRecs = records.filter(r => r.connectorId === 'lcov')
  const testPassRate = testingRecs.length > 0
    ? testingRecs.filter(r => r.status === 'passed').length / testingRecs.length
    : undefined
  const coveragePassRate = coverageRecs.length > 0
    ? coverageRecs.filter(r => r.status === 'passed').length / coverageRecs.length
    : undefined

  const historyPath = resolve(projectRoot, config.dashboard.historyFile)

  let entropyForHistory:
    | { overall: EntropyResult; byPackage: Record<string, EntropyResult> }
    | undefined

  if (!options.ci) {
    const html = buildDashboardHtml()
    const outputPath = join(outputDir, 'index.html')
    writeFileSync(outputPath, html, 'utf-8')

    // Run analysis to populate findings tab
    const analysisTopology = new Map<string, Record<string, string>>()
    if (skeleton) {
      for (const relFile of allFiles) {
        try {
          const match = matchFile(join(projectRoot, relFile), skeleton, projectRoot)
          analysisTopology.set(relFile, match)
        } catch {
          // file outside projectRoot or other error — skip
        }
      }
    }

    const analysisPkgFiles = new Map<string, string[]>()
    for (const pkg of packages) analysisPkgFiles.set(pkg.rel, [])
    for (const f of allFiles) {
      const matchingPkg = packages.find(pkg => pkg.rel === '.' || f.startsWith(pkg.rel + '/'))
      if (matchingPkg) analysisPkgFiles.get(matchingPkg.rel)!.push(f)
    }
    const analysisImportGraph = mergeImportGraphs(
      packages.map(pkg =>
        buildImportGraph(pkg.root, analysisPkgFiles.get(pkg.rel) ?? [], projectRoot)
      )
    )

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

    const intermediatesPath = resolve(projectRoot, config.analysis.intermediates)
    const analysisCache = loadIntermediateCache(intermediatesPath)
    const findings: Finding[] = runAnalysis({
      files: allFiles,
      topology: analysisTopology,
      rules: [...builtInAnalysisRules, ...pluginRules],
      importGraph: analysisImportGraph,
      cache: analysisCache,
      layerPolicy: skeleton?.layerPolicy,
      layerPolicyDraft: skeleton?.layerPolicyDraft,
    })
    saveIntermediateCache(intermediatesPath, analysisCache)

    // Compute entropy
    const entropySpinner = ora('Computing entropy…').start()
    const entropyResult = computeEntropyForProject(
      {
        files: allFiles,
        importGraph: analysisImportGraph,
        findings,
        topology: analysisTopology,
        records,
      },
      packages
    )
    entropyForHistory = entropyResult
    entropySpinner.succeed(
      `Entropy: ${entropyResult.overall.score} (${entropyResult.overall.classification})`
    )

    const history = await readHistory(historyPath)

    const dashboardData: DashboardData = {
      generatedAt: new Date().toISOString(),
      projectName: config.name,
      projectRoot,
      connectors: activeConnectorIds,
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
      entropy: entropyResult,
    }

    writeDashboardData(outputDir, dashboardData, records, findings)

    // Copy renderer assets (JS bundle) alongside index.html
    const rendererDist = getRendererAssetsDir()
    if (existsSync(rendererDist)) {
      cpSync(rendererDist, join(outputDir, 'assets'), { recursive: true })
    }

    printSuccess(`Dashboard generated → ${outputPath}`)
    console.log(
      dashboardGuidance({
        outputPath: join(outputDir, 'index.html'),
        entropyScore: entropyResult.overall.score,
        entropyClassification: entropyResult.overall.classification,
        testPassRate: aggregated.overall.passRate,
        findingCount: findings.length,
      })
    )
  }

  await appendHistory(historyPath, {
    runAt: new Date().toISOString(),
    connectors: activeConnectorIds,
    overall: aggregated.overall,
    testPassRate,
    coveragePassRate,
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
    ...(entropyForHistory
      ? {
          entropyScore: entropyForHistory.overall.score,
          entropyByPackage: Object.fromEntries(
            Object.entries(entropyForHistory.byPackage).map(([k, v]) => [k, v.score])
          ),
        }
      : {}),
  })

  // Always print terminal summary
  const summary = formatTerminalSummary(aggregated, {
    projectName: config.name,
    connectors: activeConnectorIds,
  })
  printBox(summary)
}
