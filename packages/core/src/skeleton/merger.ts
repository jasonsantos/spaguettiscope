import { minimatch } from 'minimatch'
import type { SkeletonFile, SkeletonFileEntry, SkeletonEntry, DraftEntry } from './types.js'
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

/**
 * Merges rule candidates into an existing skeleton using append-only semantics.
 *
 * - Existing annotated entries are never removed or modified (only stale-flagged).
 * - The stale flag is one-directional: once set, it is not cleared by subsequent merges.
 *   Clearing stale entries is the responsibility of the `annotate` command.
 * - `allRelativeFilePaths` must be relative to the project root (not absolute paths).
 *   Absolute paths will silently break stale detection.
 * - Duplicate detection uses exact path-string matching. Two candidates with logically
 *   equivalent but textually different globs are not deduplicated.
 */
export function mergeSkeleton(
  existing: SkeletonFile,
  candidates: MergeCandidate[],
  allRelativeFilePaths: string[]
): MergeResult {
  // Shallow-copy each entry, deep-copy attributes (the only nested object)
  const entries: SkeletonFileEntry[] = existing.entries.map(e => ({ ...e, attributes: { ...e.attributes } }))
  let markedStale = 0
  let added = 0
  let unchanged = 0

  // Mark resolved entries stale if no current files match their paths
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (isDraft(entry) || isStale(entry)) continue
    const hasFiles = entry.paths.some(p =>
      allRelativeFilePaths.some(f => minimatch(f, p, { dot: true }))
    )
    if (!hasFiles) {
      entries[i] = { ...entry, stale: true } as SkeletonEntry
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
    const isUncertain = Object.keys(candidate.attributes).some(k => k.endsWith('?'))
    const newEntry: SkeletonFileEntry = isUncertain
      ? { attributes: candidate.attributes, paths: candidate.paths, draft: true, source: candidate.source } as DraftEntry
      : { attributes: candidate.attributes, paths: candidate.paths }
    entries.push(newEntry)
    added++
  }

  return { skeleton: { entries }, added, unchanged, markedStale }
}
