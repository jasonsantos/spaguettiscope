import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { InitDetector, DetectedConnector } from '../interface.js'

export const typescriptDetector: InitDetector = {
  connectorId: 'typescript',
  detect(packageRoot: string, projectRoot: string): DetectedConnector[] {
    const absFile = join(packageRoot, 'tsconfig.json')
    if (!existsSync(absFile)) return []
    const rel = relative(projectRoot, absFile)
    return [{ config: { id: 'typescript', tsconfigFile: rel }, source: `found at ${rel}` }]
  },
}
