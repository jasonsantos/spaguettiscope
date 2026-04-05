import { minimatch } from 'minimatch'
import type { SkeletonFile, SkeletonFileEntry, DraftEntry } from './types.js'
import { isDraft, isStale } from './types.js'

export interface MergeCandidate {
  attributes: Record<string, string>
  paths: string[]
  source?: string
}

export interface MergeResult {
  skeleton: SkeletonFile
  added: number
  unchanged: number
  markedStale: number
}

export function mergeSkeleton(
  existing: SkeletonFile,
  candidates: MergeCandidate[],
  allRelativeFilePaths: string[]
): MergeResult {
  // Deep-copy entries so we don't mutate the input
  const entries: SkeletonFileEntry[] = existing.entries.map(e => ({ ...e, attributes: { ...e.attributes } }))
  let markedStale = 0
  let added = 0
  let unchanged = 0

  // Mark resolved entries stale if no current files match their paths
  for (const entry of entries) {
    if (isDraft(entry) || isStale(entry)) continue
    const hasFiles = entry.paths.some(p =>
      allRelativeFilePaths.some(f => minimatch(f, p, { dot: true }))
    )
    if (!hasFiles) {
      ;(entry as any).stale = true
      markedStale++
    }
  }

  // Add new candidates not covered by any existing entry
  for (const candidate of candidates) {
    const alreadyExists = entries.some(e =>
      candidate.paths.some(cp => e.paths.includes(cp))
    )
    if (alreadyExists) {
      unchanged++
      continue
    }
    const isUncertain = '?' in candidate.attributes
    const newEntry: SkeletonFileEntry = isUncertain
      ? { attributes: candidate.attributes, paths: candidate.paths, draft: true, source: candidate.source } as DraftEntry
      : { attributes: candidate.attributes, paths: candidate.paths }
    entries.push(newEntry)
    added++
  }

  return { skeleton: { entries }, added, unchanged, markedStale }
}
