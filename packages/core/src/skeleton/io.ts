import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { parse, stringify } from 'yaml'
import type { SkeletonFile, SkeletonFileEntry } from './types.js'

export function readSkeleton(filePath: string): SkeletonFile {
  if (!existsSync(filePath)) return { entries: [] }
  const raw = readFileSync(filePath, 'utf-8')
  let parsed: unknown
  try {
    parsed = parse(raw)
  } catch (err) {
    throw new Error(`Failed to parse skeleton file at ${filePath}: ${(err as Error).message}`)
  }
  if (!Array.isArray(parsed)) return { entries: [] }
  const entries = (parsed as unknown[]).filter(
    (e): e is SkeletonFileEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as Record<string, unknown>).attributes === 'object' &&
      (e as Record<string, unknown>).attributes !== null &&
      Array.isArray((e as Record<string, unknown>).paths)
  )
  return { entries }
}

export function writeSkeleton(filePath: string, skeleton: SkeletonFile): void {
  writeFileSync(filePath, stringify(skeleton.entries, { lineWidth: 0 }), 'utf-8')
}
