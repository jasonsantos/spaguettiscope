/**
 * SpaguettiScope Framework-Agnostic File Scanner
 * Scans project files based on plugin-provided patterns
 */

import { glob } from 'glob'
import { readFileSync, statSync } from 'fs'
import { extname, relative, dirname } from 'path'

export class FileScanner {
  constructor(projectPath, plugin, options = {}) {
    this.projectPath = projectPath
    this.plugin = plugin
    this.customIgnorePatterns = options.ignorePatterns || []
  }

  /**
   * Scan project files using plugin patterns
   */
  async scan() {
    const includePatterns = this.plugin.getFilePatterns()
    const pluginIgnorePatterns = this.plugin.getIgnorePatterns()

    // Combine plugin ignore patterns with custom ignore patterns
    const allIgnorePatterns = [
      ...pluginIgnorePatterns,
      ...this.customIgnorePatterns,
    ]

    // Combine patterns
    const patterns = [
      ...includePatterns,
      ...allIgnorePatterns.map(p => `!${p}`),
    ]

    console.log(`Scanning files with patterns: ${includePatterns.join(', ')}`)
    if (this.customIgnorePatterns.length > 0) {
      console.log(
        `📋 Using ${this.customIgnorePatterns.length} custom ignore patterns`
      )
    }

    const files = await glob(patterns, {
      cwd: this.projectPath,
      absolute: true,
    })

    const fileInfos = []

    for (const fullPath of files) {
      try {
        const stats = statSync(fullPath)
        const relativePath = relative(this.projectPath, fullPath)
        const content = readFileSync(fullPath, 'utf8')

        const fileInfo = {
          path: relativePath,
          fullPath,
          content,
          type: this.determineFileType(relativePath, content),
          size: stats.size,
          lines: this.countLines(content),
          extension: extname(fullPath),
          directory: dirname(relativePath),
          lastModified: stats.mtime,
          metadata: {},
        }

        fileInfos.push(fileInfo)
      } catch (error) {
        console.warn(`Could not read file: ${fullPath}`, error.message)
      }
    }

    return fileInfos
  }

  /**
   * Determine basic file type
   */
  determineFileType(filePath, content) {
    // Basic type detection - plugins can override this
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return 'test'
    }

    if (filePath.includes('.stories.') || filePath.includes('.story.')) {
      return 'story'
    }

    if (
      filePath.includes('/components/') ||
      filePath.includes('\\components\\')
    ) {
      return 'component'
    }

    if (
      filePath.includes('/utils/') ||
      filePath.includes('/lib/') ||
      filePath.includes('\\utils\\') ||
      filePath.includes('\\lib\\')
    ) {
      return 'utility'
    }

    // Check for React components
    if (
      content.includes('export default') &&
      (content.includes('React') ||
        content.includes('jsx') ||
        content.includes('tsx'))
    ) {
      return 'component'
    }

    return 'source'
  }

  /**
   * Count lines in content
   */
  countLines(content) {
    return content.split('\n').length
  }

  /**
   * Get file statistics
   */
  getStats(files) {
    const stats = {
      totalFiles: files.length,
      totalLines: files.reduce((sum, f) => sum + f.lines, 0),
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      fileTypes: {},
      extensions: {},
    }

    files.forEach(file => {
      // Count by type
      stats.fileTypes[file.type] = (stats.fileTypes[file.type] || 0) + 1

      // Count by extension
      stats.extensions[file.extension] =
        (stats.extensions[file.extension] || 0) + 1
    })

    return stats
  }
}
