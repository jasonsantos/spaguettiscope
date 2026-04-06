import { existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Dirent } from 'node:fs'
import type { InitDetector, DetectedConnector } from '../interface.js'

function findLcovFiles(dir: string): string[] {
  const results: string[] = []
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  for (const entry of entries) {
    const absPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findLcovFiles(absPath))
    } else if (entry.name === 'lcov.info') {
      results.push(absPath)
    }
  }
  return results
}

export const lcovDetector: InitDetector = {
  connectorId: 'lcov',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const coverageDir = join(packageRoot, 'coverage')
    if (!existsSync(coverageDir)) return []

    const pkgRel = relative(projectRoot, packageRoot) || '.'
    return findLcovFiles(coverageDir).map(absFile => {
      const relFile = relative(projectRoot, absFile)
      return {
        config: { id: 'lcov', lcovFile: relFile, packageRoot: pkgRel },
        source: `found at ${relFile}`,
      }
    })
  },
}
