import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { minimatch } from 'minimatch'
import type { DimensionDefinition, DimensionSet } from './model.js'

export class InferenceEngine {
  private readonly packageJsonCache = new Map<string, string | undefined>()

  constructor(
    private readonly definitions: DimensionDefinition[],
    private readonly projectRoot: string = process.cwd(),
    private readonly userRules: Record<string, { glob: string; value: string }[]> = {}
  ) {}

  infer(absoluteFilePath: string): DimensionSet {
    const relativePath = absoluteFilePath.startsWith(this.projectRoot + '/')
      ? absoluteFilePath.slice(this.projectRoot.length + 1)
      : absoluteFilePath

    const result: DimensionSet = {}

    for (const definition of this.definitions) {
      if (definition.name === 'package') {
        const pkgName = this.inferPackage(absoluteFilePath)
        if (pkgName !== undefined) result.package = pkgName
        continue
      }

      if (definition.name === 'domain') {
        // domain inference handled in Task 7 — skip for now
        continue
      }

      const matched = definition.patterns.find(pattern =>
        pattern.globs.some(glob => minimatch(relativePath, glob, { matchBase: false, dot: true }))
      )

      if (matched) {
        result[definition.name] = matched.value
      } else if (definition.fallback !== undefined) {
        result[definition.name] = definition.fallback
      }
    }

    // User-configured rules — highest priority, applied after all inference
    for (const [dimension, rules] of Object.entries(this.userRules)) {
      for (const rule of rules) {
        if (minimatch(relativePath, rule.glob, { matchBase: false, dot: true })) {
          result[dimension] = rule.value
          break
        }
      }
    }

    return result
  }

  private inferPackage(absoluteFilePath: string): string | undefined {
    return this.walkForPackageJson(dirname(absoluteFilePath))
  }

  private walkForPackageJson(dir: string): string | undefined {
    if (this.packageJsonCache.has(dir)) return this.packageJsonCache.get(dir)

    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: unknown }
        const name = typeof pkg.name === 'string' ? pkg.name : undefined
        this.packageJsonCache.set(dir, name)
        return name
      } catch {
        this.packageJsonCache.set(dir, undefined)
        return undefined
      }
    }

    const parent = dirname(dir)
    if (parent === dir) {
      // Reached filesystem root
      this.packageJsonCache.set(dir, undefined)
      return undefined
    }

    const result = this.walkForPackageJson(parent)
    this.packageJsonCache.set(dir, result)
    return result
  }
}
