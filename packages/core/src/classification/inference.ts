import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { minimatch } from 'minimatch'
import type { DimensionDefinition, DimensionSet } from './model.js'

export class InferenceEngine {
  private readonly packageJsonCache = new Map<string, string | undefined>()

  private readonly nextjsRootCache = new Map<string, string | undefined>();

  private static readonly NEXTJS_RESERVED = new Set([
    'page', 'layout', 'loading', 'error', 'template', 'route',
    'not-found', 'default', 'global-error', 'opengraph-image',
    'twitter-image', 'icon', 'apple-icon',
  ]);

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
        const domain = this.inferDomain(absoluteFilePath)
        if (domain !== undefined) result.domain = domain
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

  private inferDomain(absoluteFilePath: string): string | undefined {
    const nextjsRoot = this.findNextjsRoot(dirname(absoluteFilePath));
    if (!nextjsRoot) return undefined;

    const relative = absoluteFilePath
      .slice(nextjsRoot.length + 1)
      .replace(/\\/g, '/');

    if (!relative.startsWith('app/')) return undefined;

    const rest = relative.slice('app/'.length);
    const segments = rest.split('/');

    for (const segment of segments) {
      if (segment.startsWith('(')) continue; // route group — skip
      if (segment.startsWith('[')) return undefined; // dynamic param
      const base = segment.replace(/\.\w+$/, ''); // strip extension
      if (InferenceEngine.NEXTJS_RESERVED.has(base)) return undefined;
      return segment; // first real segment is the domain
    }

    return undefined;
  }

  private findNextjsRoot(dir: string): string | undefined {
    if (this.nextjsRootCache.has(dir)) return this.nextjsRootCache.get(dir);

    const hasNextConfig =
      existsSync(join(dir, 'next.config.js')) ||
      existsSync(join(dir, 'next.config.mjs')) ||
      existsSync(join(dir, 'next.config.ts'));
    const hasAppDir = existsSync(join(dir, 'app'));

    if (hasNextConfig && hasAppDir) {
      this.nextjsRootCache.set(dir, dir);
      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      this.nextjsRootCache.set(dir, undefined);
      return undefined;
    }

    const result = this.findNextjsRoot(parent);
    this.nextjsRootCache.set(dir, result);
    return result;
  }
}
