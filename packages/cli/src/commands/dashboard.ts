import { writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ora from 'ora'
import { loadConfig, InferenceEngine, defaultDefinitions } from '@spaguettiscope/core'
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
  /** Project root directory. Defaults to process.cwd(). Pass explicitly in tests. */
  projectRoot?: string
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

  const engine = new InferenceEngine(defaultDefinitions, projectRoot)
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

    // Copy renderer assets (JS bundle) alongside index.html
    const rendererDist = getRendererAssetsDir()
    if (existsSync(rendererDist)) {
      cpSync(rendererDist, join(outputDir, 'assets'), { recursive: true })
    }

    printSuccess(`Dashboard generated → ${outputPath}`)
  }

  // Always print terminal summary
  const summary = formatTerminalSummary(aggregated, {
    projectName: config.name,
    connectors: config.dashboard.connectors.map(c => c.id),
  })
  printBox(summary)
}
