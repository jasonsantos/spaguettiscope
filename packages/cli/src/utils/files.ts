import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage',
  '.next',
  '.nuxt',
  'out',
  '.vite',
])

export function walkFiles(dir: string, projectRoot: string): string[] {
  const results: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue
    const abs = join(dir, entry)
    let stat
    try {
      stat = statSync(abs)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      results.push(...walkFiles(abs, projectRoot))
    } else {
      results.push(relative(projectRoot, abs))
    }
  }
  return results
}
