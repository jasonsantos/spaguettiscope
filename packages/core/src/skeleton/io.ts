import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { parse, stringify } from 'yaml'
import type { SkeletonFile, SkeletonFileEntry, LayerPolicyEdge } from './types.js'

function filterEntries(arr: unknown[]): SkeletonFileEntry[] {
  return arr.filter(
    (e): e is SkeletonFileEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as Record<string, unknown>).attributes === 'object' &&
      (e as Record<string, unknown>).attributes !== null &&
      Array.isArray((e as Record<string, unknown>).paths)
  )
}

export function readSkeleton(filePath: string): SkeletonFile {
  if (!existsSync(filePath)) return { entries: [] }
  const raw = readFileSync(filePath, 'utf-8')
  let parsed: unknown
  try {
    parsed = parse(raw)
  } catch (err) {
    throw new Error(`Failed to parse skeleton file at ${filePath}: ${(err as Error).message}`)
  }

  // Legacy format: top-level array of entries
  if (Array.isArray(parsed)) {
    return { entries: filterEntries(parsed) }
  }

  // New format: object with entries, layerPolicy, layerPolicyDraft
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    const entries = Array.isArray(obj.entries) ? filterEntries(obj.entries) : []
    const layerPolicy = obj.layerPolicy as Record<string, LayerPolicyEdge[]> | undefined
    const layerPolicyDraft = obj.layerPolicyDraft === true ? true : undefined
    return {
      entries,
      ...(layerPolicy ? { layerPolicy } : {}),
      ...(layerPolicyDraft ? { layerPolicyDraft } : {}),
    }
  }

  return { entries: [] }
}

export function writeSkeleton(filePath: string, skeleton: SkeletonFile): void {
  if (!skeleton.layerPolicy && !skeleton.layerPolicyDraft) {
    // Legacy format: write entries as top-level array
    writeFileSync(filePath, stringify(skeleton.entries, { lineWidth: 0 }), 'utf-8')
    return
  }
  // New format: object
  const doc: Record<string, unknown> = { entries: skeleton.entries }
  if (skeleton.layerPolicy) doc.layerPolicy = skeleton.layerPolicy
  if (skeleton.layerPolicyDraft) doc.layerPolicyDraft = skeleton.layerPolicyDraft
  writeFileSync(filePath, stringify(doc, { lineWidth: 0 }), 'utf-8')
}
