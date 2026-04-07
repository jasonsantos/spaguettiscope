import { resolve, dirname } from 'node:path'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import ora from 'ora'
import {
  loadConfig,
  readSkeleton,
  writeSkeleton,
  mergeSkeleton,
  runRules,
  builtInRoleRules,
  builtInSchemaRules,
  discoverWorkspaces,
  buildImportGraph,
  mergeImportGraphs,
  analyzeLayerDirections,
  type ScanPlugin,
  type Rule,
  type LayerPolicyEdge,
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
  const allRules = [...builtInRoleRules, ...builtInSchemaRules, ...pluginRules]
  const candidates = runRules(allFiles, allRules, projectRoot, {
    disabledRuleIds,
    importGraph,
  })
  ruleSpinner.succeed(`Rules produced ${candidates.length} candidates`)

  // Workspace-derived domain candidates
  const DOMAIN_PREFIXES = [{ prefix: 'plugin-', separator: ':' }]

  const workspaceDomainCandidates: Array<{
    attributes: Record<string, string>
    paths: string[]
    source: string
  }> = []
  for (const pkg of packages) {
    if (pkg.rel === '.') continue
    const name = pkg.packageJson.name as string | undefined
    if (!name) continue

    const segment = name.includes('/') ? name.split('/').pop()! : name
    let domain: string | undefined
    let isProposed = true

    for (const { prefix, separator } of DOMAIN_PREFIXES) {
      if (segment.startsWith(prefix)) {
        domain = `${prefix.slice(0, -1)}${separator}${segment.slice(prefix.length)}`
        isProposed = false
        break
      }
    }
    if (!domain) domain = segment

    const attrKey = isProposed ? 'domain?' : 'domain'
    workspaceDomainCandidates.push({
      attributes: { [attrKey]: domain },
      paths: [`${pkg.rel}/**`],
      source: `workspace:${name}`,
    })
  }

  // Directory name heuristics for layer
  const LAYER_DICTIONARY = new Map<string, string>([
    ['components', 'component'],
    ['ui', 'component'],
    ['primitives', 'component'],
    ['hooks', 'hook'],
    ['utils', 'utility'],
    ['helpers', 'utility'],
    ['lib', 'utility'],
    ['services', 'service'],
    ['model', 'model'],
    ['models', 'model'],
    ['types', 'types'],
    ['schemas', 'types'],
    ['api', 'api'],
    ['routes', 'api'],
    ['middleware', 'middleware'],
    ['views', 'view'],
    ['controllers', 'controller'],
    ['handlers', 'controller'],
    ['adapters', 'adapter'],
    ['connectors', 'adapter'],
    ['renderer', 'renderer'],
    ['renderers', 'renderer'],
  ])

  const layerHeuristicCandidates: Array<{
    attributes: Record<string, string>
    paths: string[]
    source: string
  }> = []
  for (const pkg of packages) {
    const prefix = pkg.rel === '.' ? 'src/' : `${pkg.rel}/src/`
    const srcDirs = new Set<string>()
    for (const f of allFiles) {
      if (!f.startsWith(prefix)) continue
      const rest = f.slice(prefix.length)
      const slashIdx = rest.indexOf('/')
      if (slashIdx === -1) continue
      srcDirs.add(rest.slice(0, slashIdx))
    }

    for (const dirName of srcDirs) {
      const layerValue = LAYER_DICTIONARY.get(dirName)
      if (!layerValue) continue
      layerHeuristicCandidates.push({
        attributes: { 'layer?': layerValue },
        paths: [`${prefix}${dirName}/**`],
        source: 'built-in:layer:directory-heuristic',
      })
    }
  }

  // 7. Import direction analysis for layer policy
  const layerPolicySpinner = ora('Analyzing import directions…').start()
  const proposedLayerPolicy: Record<string, LayerPolicyEdge[]> = {}

  for (const pkg of packages) {
    const pkgFiles = filesByPackage.get(pkg.rel) ?? []
    const edges = analyzeLayerDirections(importGraph, pkg.rel, pkgFiles)
    if (edges.length > 0) {
      proposedLayerPolicy[pkg.rel] = edges
    }
  }
  layerPolicySpinner.succeed(
    `Layer policy: ${Object.keys(proposedLayerPolicy).length} packages analyzed`
  )

  // 8. Merge skeleton
  const mergeSpinner = ora('Merging skeleton…').start()
  mkdirSync(dirname(skeletonPath), { recursive: true })
  const spascoGitignore = resolve(projectRoot, '.spasco', '.gitignore')
  if (!existsSync(spascoGitignore)) {
    writeFileSync(spascoGitignore, 'reports/\nintermediates.json\n')
  }
  const existing = readSkeleton(skeletonPath)
  const mergeResult = mergeSkeleton(
    existing,
    [
      ...candidates.map(c => ({ attributes: c.attributes, paths: [c.pathPattern], source: c.source })),
      ...workspaceDomainCandidates,
      ...layerHeuristicCandidates,
    ],
    allFiles
  )
  const skeleton = mergeResult.skeleton
  const { added, unchanged, markedStale } = mergeResult

  // Apply proposed layer policy
  if (Object.keys(proposedLayerPolicy).length > 0) {
    if (!skeleton.layerPolicy || skeleton.layerPolicyDraft) {
      skeleton.layerPolicy = proposedLayerPolicy
      skeleton.layerPolicyDraft = true
    }
  }

  writeSkeleton(skeletonPath, skeleton)
  mergeSpinner.succeed('Skeleton updated')

  printSuccess(
    `Scan complete — ${added} new, ${unchanged} unchanged, ${markedStale} stale → ${skeletonPath}`
  )
}
