import { minimatch } from 'minimatch'
import type { SkeletonFile } from './types.js'
import { isDraft } from './types.js'

export function matchFile(
  absoluteFilePath: string,
  skeleton: SkeletonFile,
  projectRoot: string
): Record<string, string> {
  if (!absoluteFilePath.startsWith(projectRoot + '/')) {
    throw new Error(
      `matchFile: absoluteFilePath must be under projectRoot.\n` +
      `  projectRoot:       ${projectRoot}\n` +
      `  absoluteFilePath:  ${absoluteFilePath}`
    )
  }
  const relPath = absoluteFilePath.slice(projectRoot.length + 1)

  const result: Record<string, string> = {}

  for (const entry of skeleton.entries) {
    if (isDraft(entry)) continue
    const matches = entry.paths.some(p => minimatch(relPath, p, { dot: true }))
    if (matches) {
      Object.assign(result, entry.attributes)
    }
  }

  return result
}
