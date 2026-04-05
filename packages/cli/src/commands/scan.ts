import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ora from 'ora'
import {
  loadConfig,
  readSkeleton,
  writeSkeleton,
  mergeSkeleton,
  runRules,
  builtInRoleRules,
} from '@spaguettiscope/core'
import { printSuccess } from '../formatter/index.js'

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

function walkFiles(dir: string, projectRoot: string): string[] {
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

export interface ScanOptions {
  projectRoot?: string
}

export async function runScan(options: ScanOptions = {}): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const disabledRuleIds = new Set(config.rules.disable)

  const fileSpinner = ora('Scanning files…').start()
  const allFiles = walkFiles(projectRoot, projectRoot)
  fileSpinner.succeed(`Found ${allFiles.length} files`)

  const ruleSpinner = ora('Running rules…').start()
  const candidates = runRules(allFiles, builtInRoleRules, projectRoot, disabledRuleIds)
  ruleSpinner.succeed(`Rules produced ${candidates.length} candidates`)

  const mergeSpinner = ora('Merging skeleton…').start()
  const existing = readSkeleton(skeletonPath)
  const { skeleton, added, unchanged, markedStale } = mergeSkeleton(
    existing,
    candidates.map(c => ({ attributes: c.attributes, paths: [c.pathPattern], source: c.source })),
    allFiles
  )
  writeSkeleton(skeletonPath, skeleton)
  mergeSpinner.succeed('Skeleton updated')

  printSuccess(
    `Scan complete — ${added} new, ${unchanged} unchanged, ${markedStale} stale → ${skeletonPath}`
  )
}
