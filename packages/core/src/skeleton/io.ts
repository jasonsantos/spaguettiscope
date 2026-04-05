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
  return { entries: Array.isArray(parsed) ? parsed : [] }
}

export function writeSkeleton(filePath: string, skeleton: SkeletonFile): void {
  writeFileSync(filePath, stringify(skeleton.entries, { lineWidth: 0 }), 'utf-8')
}
