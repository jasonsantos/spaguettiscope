import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

export const allureDetector: InitDetector = {
  connectorId: 'allure',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const absDir = join(packageRoot, 'allure-results')
    if (!existsSync(absDir)) return []
    const rel = relative(projectRoot, absDir)
    return [{ config: { id: 'allure', resultsDir: rel }, source: `found at ${rel}` }]
  },
}
