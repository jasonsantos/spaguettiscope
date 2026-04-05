import { minimatch } from 'minimatch'
import type { SkeletonFile } from './types.js'
import { isDraft } from './types.js'

export function matchFile(
  absoluteFilePath: string,
  skeleton: SkeletonFile,
  projectRoot: string
): Record<string, string> {
  const relPath = absoluteFilePath.startsWith(projectRoot + '/')
    ? absoluteFilePath.slice(projectRoot.length + 1)
    : absoluteFilePath

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
