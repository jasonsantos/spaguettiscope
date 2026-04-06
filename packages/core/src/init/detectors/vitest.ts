import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

const SCAN_DIRS = ['.spasco', 'test-results']

function isVitestJson(filePath: string): boolean {
  try {
    const obj = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
    return Array.isArray(obj.testResults)
  } catch {
    return false
  }
}

export const vitestDetector: InitDetector = {
  connectorId: 'vitest',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const results: DetectedConnector[] = []
    for (const scanDir of SCAN_DIRS) {
      const absDir = join(packageRoot, scanDir)
      if (!existsSync(absDir)) continue
      let entries: string[]
      try {
        entries = readdirSync(absDir)
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue
        const absFile = join(absDir, entry)
        if (!isVitestJson(absFile)) continue
        const relFile = relative(projectRoot, absFile)
        results.push({
          config: { id: 'vitest', reportFile: relFile },
          source: `found at ${relFile}`,
        })
      }
    }
    return results
  },
}
