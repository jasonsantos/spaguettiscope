import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function canApply(packageRoot: string): boolean {
  const pkgPath = join(packageRoot, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return 'react' in { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  } catch {
    return false
  }
}
