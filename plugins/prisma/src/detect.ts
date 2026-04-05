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
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    return '@prisma/client' in allDeps || 'prisma' in allDeps
  } catch {
    return false
  }
}
