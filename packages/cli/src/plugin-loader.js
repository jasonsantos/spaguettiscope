/**
 * SpaguettiScope Plugin Loader
 * Discovers and loads framework plugins dynamically
 */

import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export class PluginLoader {
  constructor() {
    this.plugins = new Map()
    this.pluginPaths = []
    this.initialized = false
  }

  /**
   * Initialize plugin loader and discover available plugins
   */
  async initialize() {
    if (this.initialized) {
      return
    }

    // Add default plugin search paths
    this.addPluginPath(join(__dirname, '../../../plugins'))
    this.addPluginPath(join(process.cwd(), 'plugins'))
    this.addPluginPath(join(process.cwd(), 'node_modules/@spaguettiscope'))

    // Discover and load plugins
    await this.discoverPlugins()

    this.initialized = true
  }

  /**
   * Add a plugin search path
   */
  addPluginPath(path) {
    if (existsSync(path) && !this.pluginPaths.includes(path)) {
      this.pluginPaths.push(path)
    }
  }

  /**
   * Discover available plugins
   */
  async discoverPlugins() {
    const builtInPlugins = await this.loadBuiltInPlugins()
    const externalPlugins = await this.loadExternalPlugins()

    // Merge plugins (external plugins can override built-in ones)
    for (const [name, plugin] of builtInPlugins) {
      this.plugins.set(name, plugin)
    }

    for (const [name, plugin] of externalPlugins) {
      this.plugins.set(name, plugin)
    }

    console.log(
      `Discovered ${this.plugins.size} plugin(s): ${Array.from(this.plugins.keys()).join(', ')}`
    )
  }

  /**
   * Load built-in plugins
   */
  async loadBuiltInPlugins() {
    const plugins = new Map()

    // Load NextJS plugin
    try {
      // Try multiple possible paths for the NextJS plugin
      const possiblePaths = [
        join(__dirname, '../../../plugins/nextjs/src/index.js'),
        join(process.cwd(), 'plugins/nextjs/src/index.js'),
        join(process.cwd(), '../plugins/nextjs/src/index.js'),
        join(process.cwd(), '../../plugins/nextjs/src/index.js'),
      ]

      let nextjsPlugin = null
      for (const pluginPath of possiblePaths) {
        if (existsSync(pluginPath)) {
          try {
            const module = await import(pluginPath)
            nextjsPlugin = module.nextjsPlugin || module.default
            if (nextjsPlugin) {
              plugins.set('nextjs', nextjsPlugin)
              console.log('✅ Loaded built-in NextJS plugin from:', pluginPath)
              break
            }
          } catch (importError) {
            console.warn(
              `Failed to import from ${pluginPath}:`,
              importError.message
            )
          }
        }
      }

      if (!nextjsPlugin) {
        console.warn('⚠️  NextJS plugin not found in any expected location')
      }
    } catch (error) {
      console.warn('⚠️  Could not load NextJS plugin:', error.message)
    }

    return plugins
  }

  /**
   * Load external plugins from node_modules
   */
  async loadExternalPlugins() {
    const plugins = new Map()

    // Look for @spaguettiscope/plugin-* packages
    for (const searchPath of this.pluginPaths) {
      try {
        if (!existsSync(searchPath)) {
          continue
        }

        const { readdirSync } = await import('fs')
        const entries = readdirSync(searchPath, { withFileTypes: true })

        for (const entry of entries) {
          // Check if it's a directory or symlink to a directory that starts with 'plugin-'
          if (entry.name.startsWith('plugin-')) {
            const fullPath = join(searchPath, entry.name)
            const { statSync } = await import('fs')

            try {
              const stats = statSync(fullPath)
              if (stats.isDirectory() || stats.isSymbolicLink()) {
                // For symlinks, check if the target is a directory
                let isPluginDir = stats.isDirectory()
                if (stats.isSymbolicLink()) {
                  const { realpathSync } = await import('fs')
                  const realPath = realpathSync(fullPath)
                  const realStats = statSync(realPath)
                  isPluginDir = realStats.isDirectory()
                }

                if (isPluginDir) {
                  const pluginName = entry.name.replace('plugin-', '')
                  const pluginPath = fullPath

                  try {
                    const plugin = await this.loadPlugin(pluginPath, pluginName)
                    if (plugin) {
                      plugins.set(pluginName, plugin)
                      console.log(`✅ Loaded external plugin: ${pluginName}`)
                    }
                  } catch (error) {
                    console.warn(
                      `⚠️  Could not load plugin ${pluginName}:`,
                      error.message
                    )
                  }
                }
              }
            } catch (statError) {
              console.warn(`⚠️  Could not stat ${fullPath}:`, statError.message)
            }
          }
        }
      } catch (error) {
        console.warn(
          `⚠️  Could not scan plugin directory ${searchPath}:`,
          error.message
        )
      }
    }

    return plugins
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginPath, pluginName) {
    const packageJsonPath = join(pluginPath, 'package.json')
    const srcIndexPath = join(pluginPath, 'src/index.js')
    const indexPath = join(pluginPath, 'index.js')

    // Check if it's a valid plugin package
    if (!existsSync(packageJsonPath)) {
      throw new Error(`No package.json found in ${pluginPath}`)
    }

    // Try to load the plugin module
    let pluginModule

    if (existsSync(srcIndexPath)) {
      pluginModule = await import(srcIndexPath)
    } else if (existsSync(indexPath)) {
      pluginModule = await import(indexPath)
    } else {
      throw new Error(`No index.js found in ${pluginPath}`)
    }

    // Extract the plugin instance
    const pluginInstance =
      pluginModule.default ||
      pluginModule[`${pluginName}Plugin`] ||
      pluginModule[`${pluginName}plugin`] ||
      Object.values(pluginModule).find(
        exp => exp && typeof exp === 'object' && exp.name === pluginName
      )

    if (!pluginInstance) {
      throw new Error(`No valid plugin instance found in ${pluginPath}`)
    }

    // Validate plugin interface
    if (
      typeof pluginInstance.discover !== 'function' ||
      typeof pluginInstance.canAnalyze !== 'function'
    ) {
      throw new Error(
        `Plugin ${pluginName} does not implement required interface`
      )
    }

    return pluginInstance
  }

  /**
   * Get a plugin by name
   */
  getPlugin(name) {
    if (!this.initialized) {
      throw new Error('Plugin loader not initialized. Call initialize() first.')
    }

    const plugin = this.plugins.get(name)
    if (!plugin) {
      throw new Error(
        `Plugin '${name}' not found. Available plugins: ${Array.from(this.plugins.keys()).join(', ')}`
      )
    }

    return plugin
  }

  /**
   * List all available plugins
   */
  listPlugins() {
    if (!this.initialized) {
      throw new Error('Plugin loader not initialized. Call initialize() first.')
    }

    return Array.from(this.plugins.entries()).map(([name, plugin]) => ({
      name,
      description: plugin.description || 'No description available',
      version: plugin.version || 'unknown',
    }))
  }

  /**
   * Auto-detect the best plugin for a project
   */
  async autoDetectPlugin(projectPath) {
    if (!this.initialized) {
      await this.initialize()
    }

    console.log(`🔍 Auto-detecting framework for: ${projectPath}`)

    for (const [name, plugin] of this.plugins) {
      try {
        const canAnalyze = await plugin.canAnalyze(projectPath)
        if (canAnalyze) {
          console.log(`✅ Detected ${name} project`)
          return { name, plugin }
        }
      } catch (error) {
        console.warn(`⚠️  Error checking ${name} plugin:`, error.message)
      }
    }

    throw new Error(`No compatible plugin found for project at ${projectPath}`)
  }

  /**
   * Validate plugin compatibility with project
   */
  async validatePlugin(pluginName, projectPath) {
    const plugin = this.getPlugin(pluginName)

    try {
      const canAnalyze = await plugin.canAnalyze(projectPath)
      if (!canAnalyze) {
        throw new Error(
          `Plugin '${pluginName}' cannot analyze project at ${projectPath}`
        )
      }
      return true
    } catch (error) {
      throw new Error(`Plugin validation failed: ${error.message}`)
    }
  }

  /**
   * Get plugin information
   */
  getPluginInfo(name) {
    const plugin = this.getPlugin(name)

    return {
      name: plugin.name || name,
      description: plugin.description || 'No description available',
      version: plugin.version || 'unknown',
      filePatterns: plugin.getFilePatterns ? plugin.getFilePatterns() : [],
      ignorePatterns: plugin.getIgnorePatterns
        ? plugin.getIgnorePatterns()
        : [],
      configSchema: plugin.getConfigSchema ? plugin.getConfigSchema() : {},
    }
  }

  /**
   * Install a plugin from npm (future feature)
   */
  async installPlugin(_packageName) {
    // This would use npm/pnpm to install plugins
    throw new Error('Plugin installation not yet implemented')
  }

  /**
   * Unload a plugin
   */
  unloadPlugin(name) {
    return this.plugins.delete(name)
  }

  /**
   * Reload all plugins
   */
  async reloadPlugins() {
    this.plugins.clear()
    this.initialized = false
    await this.initialize()
  }
}
