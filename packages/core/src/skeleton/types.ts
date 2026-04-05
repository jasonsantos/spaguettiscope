export interface SkeletonEntry {
  attributes: Record<string, string>
  paths: string[]
  stale?: true
}

export interface DraftEntry {
  attributes: Record<string, string>
  paths: string[]
  draft: true
  source?: string
}

export type SkeletonFileEntry = SkeletonEntry | DraftEntry

export interface SkeletonFile {
  entries: SkeletonFileEntry[]
}

export function isDraft(entry: SkeletonFileEntry): entry is DraftEntry {
  return (entry as DraftEntry).draft === true
}

export function isStale(entry: SkeletonFileEntry): boolean {
  return !isDraft(entry) && (entry as SkeletonEntry).stale === true
}

export function isPending(entry: SkeletonFileEntry): boolean {
  return isDraft(entry) && '?' in entry.attributes
}
