import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

const CANDIDATES: Array<{ dir?: string; filename: string }> = [
  { filename: 'eslint-report.json' },
  { filename: 'eslint-results.json' },
  { dir: '.spasco', filename: 'eslint.json' },
  { dir: '.spasco', filename: 'eslint-report.json' },
]

export const eslintDetector: InitDetector = {
  connectorId: 'eslint',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    for (const { dir, filename } of CANDIDATES) {
      const absFile = dir ? join(packageRoot, dir, filename) : join(packageRoot, filename)
      if (existsSync(absFile)) {
        const rel = relative(projectRoot, absFile)
        return [{ config: { id: 'eslint', reportFile: rel }, source: `found at ${rel}` }]
      }
    }
    return []
  },
}
