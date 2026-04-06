import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

const CONFIG_FILES = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']

export const playwrightDetector: InitDetector = {
  connectorId: 'playwright',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const hasConfig = CONFIG_FILES.some(f => existsSync(join(packageRoot, f)))

    // playwright-report/ is always checked (default output dir)
    const reportDir = join(packageRoot, 'playwright-report')
    if (existsSync(reportDir)) {
      const rel = relative(projectRoot, reportDir)
      return [{ config: { id: 'playwright', resultsDir: rel }, source: `found at ${rel}` }]
    }

    // test-results/ only if playwright.config.* exists (avoid false positives)
    if (hasConfig) {
      const testResultsDir = join(packageRoot, 'test-results')
      if (existsSync(testResultsDir)) {
        const rel = relative(projectRoot, testResultsDir)
        return [{ config: { id: 'playwright', resultsDir: rel }, source: `found at ${rel}` }]
      }
    }

    return []
  },
}
