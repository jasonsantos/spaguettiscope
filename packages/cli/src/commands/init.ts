import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import {
  discoverWorkspaces,
  builtInDetectors,
  type InitDetector,
  type DetectedConnector,
  type PluginDetector,
} from '@spaguettiscope/core'
import { printWarning, printSuccess, printCommandHeader } from '../formatter/index.js'
import { initGuidance } from '../formatter/guidance.js'

export interface InitOptions {
  interactive?: boolean
  plugins?: string // comma-separated module IDs
  projectRoot?: string
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  printCommandHeader('init')
  const projectRoot = options.projectRoot ?? process.cwd()

  // Guard: refuse if config already exists
  if (
    existsSync(join(projectRoot, 'spasco.config.json')) ||
    existsSync(join(projectRoot, 'spaguettiscope.config.json'))
  ) {
    throw new Error('spasco.config.json already exists. Remove it first to re-initialize.')
  }

  // Resolve project name from root package.json
  let projectName: string | undefined
  try {
    const rootPkg = JSON.parse(
      readFileSync(join(projectRoot, 'package.json'), 'utf-8')
    ) as Record<string, unknown>
    if (typeof rootPkg.name === 'string') projectName = rootPkg.name
  } catch {
    // no root package.json — fine
  }

  // Discover workspaces
  const packages = discoverWorkspaces(projectRoot)

  // Collect all detectors
  const allDetectors: InitDetector[] = [...builtInDetectors]
  if (options.plugins) {
    for (const pluginId of options.plugins.split(',').map(s => s.trim()).filter(Boolean)) {
      try {
        const mod = (await import(pluginId)) as Record<string, unknown>
        const det = mod.detector
        if (det && typeof (det as InitDetector).detect === 'function') {
          allDetectors.push(det as InitDetector)
        }
      } catch {
        printWarning(`Failed to load plugin detector: ${pluginId}`)
      }
    }
  }

  // Run detectors across all workspaces
  let detected: DetectedConnector[] = []
  for (const pkg of packages) {
    for (const detector of allDetectors) {
      try {
        const results = detector.detect(pkg.root, projectRoot)
        detected.push(...results)
      } catch {
        // detector error — skip silently
      }
    }
  }

  // Discover plugins from workspace packages matching @spaguettiscope/plugin-* or plugin-*
  const detectedPlugins: Array<{ id: string; source: string }> = []
  const pluginDetectors: Array<{ name: string; detector: PluginDetector }> = []

  for (const pkg of packages) {
    const pkgName = pkg.packageJson.name as string | undefined
    if (!pkgName) continue
    const segment = pkgName.includes('/') ? pkgName.split('/').pop()! : pkgName
    if (!segment.startsWith('plugin-')) continue

    try {
      const mod = (await import(pkgName)) as Record<string, unknown>
      const det = mod.detector as PluginDetector | undefined
      if (det && typeof det.detect === 'function') {
        pluginDetectors.push({ name: pkgName, detector: det })
      }
    } catch {
      // Plugin not loadable — skip
    }
  }

  // Also load plugin detectors from --plugins flag if provided
  if (options.plugins) {
    for (const pluginId of options.plugins.split(',').map(s => s.trim()).filter(Boolean)) {
      // Only add to pluginDetectors if not already loaded as InitDetector above
      try {
        const mod = (await import(pluginId)) as Record<string, unknown>
        const det = mod.detector as PluginDetector | undefined
        if (det && typeof det.detect === 'function' && !pluginDetectors.some(p => p.name === pluginId)) {
          pluginDetectors.push({ name: pluginId, detector: det })
        }
      } catch {
        // Not a PluginDetector — already handled above as InitDetector
      }
    }
  }

  // Run plugin detectors against all workspace packages
  for (const { name, detector } of pluginDetectors) {
    for (const pkg of packages) {
      if (detector.detect(pkg.root, projectRoot)) {
        detectedPlugins.push({
          id: name,
          source: `detected ${detector.id} in ${(pkg.packageJson.name as string | undefined) ?? pkg.rel}`,
        })
        break // One match is enough
      }
    }
  }

  // Deduplicate plugins
  const uniquePlugins = [...new Map(detectedPlugins.map(p => [p.id, p])).values()]

  // Interactive confirmation
  if (options.interactive && process.stdout.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    detected = await promptConfirmConnectors(detected, rl)
    projectName = await promptProjectName(projectName, rl)
    rl.close()
  }

  // Build config
  const config: Record<string, unknown> = {
    ...(projectName !== undefined ? { name: projectName } : {}),
    ...(uniquePlugins.length > 0 ? { plugins: uniquePlugins.map(p => p.id) } : {}),
    dashboard: { connectors: detected.map(d => d.config) },
  }

  // Write
  const configPath = join(projectRoot, 'spasco.config.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')

  if (detected.length === 0) {
    printWarning('No connectors detected. Edit spasco.config.json to add them manually.')
  } else {
    printSuccess(
      `Detected ${detected.length} connector(s):\n` +
        detected.map(d => `  • ${d.source}`).join('\n')
    )
  }
  printSuccess(`Config written → ${configPath}`)
  console.log(
    initGuidance({
      connectorCount: detected.length,
      pluginCount: uniquePlugins.length,
      configPath: 'spasco.config.json',
    })
  )
}

async function promptProjectName(current: string | undefined, rl: ReturnType<typeof createInterface>): Promise<string | undefined> {
  const answer = await rl.question(`Project name [${current ?? ''}]: `)
  return answer.trim() || current
}

async function promptConfirmConnectors(
  detected: DetectedConnector[],
  rl: ReturnType<typeof createInterface>
): Promise<DetectedConnector[]> {
  if (detected.length === 0) return []
  const kept: DetectedConnector[] = []
  for (const d of detected) {
    const answer = await rl.question(`Include ${d.source}? [Y/n] `)
    if (answer.trim().toLowerCase() !== 'n') kept.push(d)
  }
  return kept
}
