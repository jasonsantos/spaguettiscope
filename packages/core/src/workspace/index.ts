import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse } from 'yaml'
import { minimatch } from 'minimatch'

export interface WorkspacePackage {
  name: string
  root: string        // absolute path to package directory
  rel: string         // relative to project root (e.g. "packages/web") or "."
  packageJson: Record<string, unknown>
}

function readPackageJson(dir: string): Record<string, unknown> | null {
  const p = join(dir, 'package.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function resolveGlob(pattern: string, projectRoot: string): string[] {
  const results: string[] = []

  function scan(absDir: string, relDir: string, depth: number) {
    if (depth > 4) return
    let entries: string[]
    try {
      entries = readdirSync(absDir)
    } catch {
      return
    }
    for (const entry of entries) {
      const relPath = relDir ? `${relDir}/${entry}` : entry
      const absPath = join(absDir, entry)
      let stat: ReturnType<typeof statSync>
      try {
        stat = statSync(absPath)
      } catch {
        continue
      }
      if (!stat.isDirectory()) continue
      if (minimatch(relPath, pattern)) {
        results.push(absPath)
      }
      scan(absPath, relPath, depth + 1)
    }
  }

  scan(projectRoot, '', 0)
  return results
}

function resolvePatterns(patterns: string[], projectRoot: string): WorkspacePackage[] {
  const packages: WorkspacePackage[] = []
  for (const pattern of patterns) {
    const dirs = resolveGlob(pattern, projectRoot)
    for (const dir of dirs) {
      const pkg = readPackageJson(dir)
      if (!pkg) continue
      packages.push({
        name: (pkg.name as string | undefined) ?? dir,
        root: dir,
        rel: relative(projectRoot, dir),
        packageJson: pkg,
      })
    }
  }
  return packages
}

export function discoverWorkspaces(projectRoot: string): WorkspacePackage[] {
  // 1. Try pnpm-workspace.yaml
  const pnpmWs = join(projectRoot, 'pnpm-workspace.yaml')
  if (existsSync(pnpmWs)) {
    try {
      const raw = parse(readFileSync(pnpmWs, 'utf-8')) as { packages?: string[] }
      const patterns = raw?.packages
      if (Array.isArray(patterns) && patterns.length > 0) {
        const pkgs = resolvePatterns(patterns, projectRoot)
        if (pkgs.length > 0) return pkgs
      }
    } catch {
      // fall through
    }
  }

  // 2. Try package.json workspaces
  const rootPkg = readPackageJson(projectRoot)
  if (rootPkg) {
    const ws = rootPkg.workspaces
    const patterns: string[] = Array.isArray(ws)
      ? (ws as string[])
      : Array.isArray((ws as Record<string, unknown>)?.packages)
        ? ((ws as Record<string, string[]>).packages)
        : []
    if (patterns.length > 0) {
      const pkgs = resolvePatterns(patterns, projectRoot)
      if (pkgs.length > 0) return pkgs
    }
  }

  // 3. Single-package fallback — reuse rootPkg already read above
  return [
    {
      name: (rootPkg?.name as string | undefined) ?? projectRoot,
      root: projectRoot,
      rel: '.',
      packageJson: rootPkg ?? {},
    },
  ]
}
