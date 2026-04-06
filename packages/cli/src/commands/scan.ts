import { resolve, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import ora from 'ora'
import {
  loadConfig,
  readSkeleton,
  writeSkeleton,
  mergeSkeleton,
  runRules,
  builtInRoleRules,
  discoverWorkspaces,
  buildImportGraph,
  mergeImportGraphs,
  type ScanPlugin,
  type Rule,
} from '@spaguettiscope/core'
import { walkFiles } from '../utils/files.js'
import { printSuccess } from '../formatter/index.js'

export interface ScanOptions {
  projectRoot?: string
}

export async function runScan(options: ScanOptions = {}): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const disabledRuleIds = new Set(config.rules.disable)

  // 1. Discover workspace packages
  const packages = discoverWorkspaces(projectRoot)

  // 2. Walk all files
  const fileSpinner = ora('Scanning files…').start()
  const allFiles = walkFiles(projectRoot, projectRoot)
  fileSpinner.succeed(`Found ${allFiles.length} files`)

  // 3. Load plugins from config
  const plugins: ScanPlugin[] = []
  for (const pluginId of config.plugins) {
    try {
      const mod = await import(pluginId) as Record<string, unknown>
      const plugin = (mod.default ?? Object.values(mod)[0]) as ScanPlugin
      if (!plugin || typeof plugin.canApply !== 'function') {
        console.warn(`[spasco] Plugin ${pluginId} did not export a valid ScanPlugin — skipping`)
        continue
      }
      plugins.push(plugin)
    } catch (err) {
      ora().warn(`Failed to load plugin ${pluginId}: ${(err as Error).message}`)
    }
  }

  // 4. Build per-package import graphs, merge
  const graphSpinner = ora('Building import graphs…').start()

  // Bucket files by package — O(files × packages); packages count is typically small
  const filesByPackage = new Map<string, string[]>()
  for (const pkg of packages) {
    filesByPackage.set(pkg.rel, [])
  }
  for (const f of allFiles) {
    // For single-package (rel='.'), all files belong to it
    const matchingPkg = packages.find(pkg =>
      pkg.rel === '.' || f.startsWith(pkg.rel + '/')
    )
    if (matchingPkg) {
      filesByPackage.get(matchingPkg.rel)!.push(f)
    }
  }

  const graphs = packages.map(pkg =>
    buildImportGraph(pkg.root, filesByPackage.get(pkg.rel) ?? [], projectRoot)
  )
  const importGraph = mergeImportGraphs(graphs)
  graphSpinner.succeed('Import graphs built')

  // 5. Scope plugin rules to their detected packages
  const pluginRules: Rule[] = []
  for (const pkg of packages) {
    for (const plugin of plugins) {
      if (!plugin.canApply(pkg.root)) continue
      for (const rule of plugin.rules()) {
        pluginRules.push({
          ...rule,
          id: `${plugin.id}::${pkg.rel}::${rule.id}`,
          selector: {
            ...rule.selector,
            path: pkg.rel === '.' ? rule.selector.path : `${pkg.rel}/${rule.selector.path}`,
          },
        })
      }
    }
  }

  // 6. Run rules (built-ins fire on all files; plugin rules are already scoped)
  const ruleSpinner = ora('Running rules…').start()
  const allRules = [...builtInRoleRules, ...pluginRules]
  const candidates = runRules(allFiles, allRules, projectRoot, {
    disabledRuleIds,
    importGraph,
  })
  ruleSpinner.succeed(`Rules produced ${candidates.length} candidates`)

  // 7. Merge skeleton
  const mergeSpinner = ora('Merging skeleton…').start()
  mkdirSync(dirname(skeletonPath), { recursive: true })
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
