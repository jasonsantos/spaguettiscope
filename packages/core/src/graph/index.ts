import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, relative, dirname } from 'node:path'
import { parse } from '@typescript-eslint/parser'

export interface ImportGraph {
  /** rel-to-projectRoot → Set of rel-to-projectRoot paths this file imports */
  imports: Map<string, Set<string>>
  /** reverse index: rel-to-projectRoot → Set of files that import it */
  importedBy: Map<string, Set<string>>
  /** Subset of imports where ALL imports from source→target are type-only */
  typeOnlyImports: Map<string, Set<string>>
}

type AstNode = { type: string; [key: string]: unknown }

interface SpecifierInfo {
  specifier: string
  typeOnly: boolean
}

function extractSpecifiers(code: string, isJsx: boolean): SpecifierInfo[] {
  const specifiers: SpecifierInfo[] = []
  let program: { body: AstNode[] }

  try {
    program = parse(code, { jsx: isJsx, range: false, loc: false } as Parameters<typeof parse>[1]) as unknown as { body: AstNode[] }
  } catch {
    try {
      program = parse(code, { jsx: false, range: false, loc: false } as Parameters<typeof parse>[1]) as unknown as { body: AstNode[] }
    } catch {
      return specifiers
    }
  }

  function visit(node: AstNode): void {
    if (!node || typeof node.type !== 'string') return

    if (
      node.type === 'ImportDeclaration' &&
      (node.source as AstNode)?.type === 'Literal'
    ) {
      const specifier = (node.source as { value: string }).value
      // typeOnly if the import declaration itself is `import type`, OR if all specifiers have importKind === 'type'
      let typeOnly = node.importKind === 'type'
      if (!typeOnly) {
        const nodeSpecifiers = node.specifiers as AstNode[]
        if (Array.isArray(nodeSpecifiers) && nodeSpecifiers.length > 0) {
          typeOnly = nodeSpecifiers.every(s => (s as { importKind?: string }).importKind === 'type')
        }
      }
      specifiers.push({ specifier, typeOnly })
    } else if (
      node.type === 'ExportAllDeclaration' &&
      (node.source as AstNode)?.type === 'Literal'
    ) {
      specifiers.push({
        specifier: (node.source as { value: string }).value,
        typeOnly: node.exportKind === 'type',
      })
    } else if (
      node.type === 'ExportNamedDeclaration' &&
      node.source != null &&
      (node.source as AstNode).type === 'Literal'
    ) {
      specifiers.push({
        specifier: (node.source as { value: string }).value,
        typeOnly: node.exportKind === 'type',
      })
    } else if (
      node.type === 'ImportExpression' &&
      (node.source as AstNode)?.type === 'Literal'
    ) {
      specifiers.push({
        specifier: (node.source as { value: string }).value,
        typeOnly: false,
      })
    } else if (
      node.type === 'TSImportType' &&
      (node.source as AstNode)?.type === 'Literal'
    ) {
      specifiers.push({
        specifier: (node.source as { value: string }).value,
        typeOnly: true,
      })
    } else if (
      node.type === 'CallExpression' &&
      (node.callee as AstNode)?.type === 'Identifier' &&
      (node.callee as { name: string }).name === 'require'
    ) {
      const args = node.arguments as AstNode[]
      if (args?.[0]?.type === 'Literal') {
        const val = (args[0] as unknown as { value: unknown }).value
        if (typeof val === 'string') specifiers.push({ specifier: val, typeOnly: false })
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent') continue
      const child = node[key]
      if (Array.isArray(child)) {
        ;(child as AstNode[]).forEach(c => {
          if (c && typeof c.type === 'string') visit(c)
        })
      } else if (child && typeof (child as AstNode).type === 'string') {
        visit(child as AstNode)
      }
    }
  }

  for (const stmt of program.body) visit(stmt)
  return specifiers
}

function resolveSpecifier(
  specifier: string,
  fromAbs: string,
  packageRoot: string,
  projectRoot: string
): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null

  const normPackageRoot = packageRoot.endsWith('/') ? packageRoot.slice(0, -1) : packageRoot
  const candidate = resolve(dirname(fromAbs), specifier)

  // No cross-package edges
  if (!candidate.startsWith(normPackageRoot + '/') && candidate !== normPackageRoot) return null

  // TypeScript ESM convention: imports use .js but the actual file is .ts/.tsx.
  // Build a list of base paths to probe before trying bare-extension variants.
  const bases: string[] = [candidate]
  if (candidate.endsWith('.js'))  bases.push(candidate.slice(0, -3) + '.ts',  candidate.slice(0, -3) + '.tsx')
  if (candidate.endsWith('.jsx')) bases.push(candidate.slice(0, -4) + '.tsx')
  if (candidate.endsWith('.mjs')) bases.push(candidate.slice(0, -4) + '.mts')

  for (const base of bases) {
    if (existsSync(base) && statSync(base).isFile()) return relative(projectRoot, base)
  }

  // No extension supplied — try all common ones
  if (!candidate.match(/\.[mc]?[jt]sx?$/)) {
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']) {
      const full = candidate + ext
      if (existsSync(full) && statSync(full).isFile()) return relative(projectRoot, full)
    }
  }

  return null
}

const PARSEABLE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

export function buildImportGraph(
  packageRoot: string,
  filePaths: string[],  // relative to projectRoot
  projectRoot: string
): ImportGraph {
  const graph: ImportGraph = { imports: new Map(), importedBy: new Map(), typeOnlyImports: new Map() }

  for (const relPath of filePaths) {
    const dotIdx = relPath.lastIndexOf('.')
    const ext = dotIdx === -1 ? '' : relPath.slice(dotIdx)
    if (!PARSEABLE_EXTS.has(ext)) continue

    if (!graph.imports.has(relPath)) {
      graph.imports.set(relPath, new Set())
    }

    const absPath = join(projectRoot, relPath)
    const isJsx = absPath.endsWith('.tsx') || absPath.endsWith('.jsx')

    let code: string
    try {
      code = readFileSync(absPath, 'utf-8')
    } catch {
      continue
    }

    // Track per-target whether it's typeOnly; concrete wins over typeOnly for the same target
    const targetTypeOnly = new Map<string, boolean>()

    for (const { specifier, typeOnly } of extractSpecifiers(code, isJsx)) {
      const resolved = resolveSpecifier(specifier, absPath, packageRoot, projectRoot)
      if (!resolved) continue

      graph.imports.get(relPath)!.add(resolved)

      if (!graph.importedBy.has(resolved)) {
        graph.importedBy.set(resolved, new Set())
      }
      graph.importedBy.get(resolved)!.add(relPath)

      // concrete wins: if we've already seen a concrete edge, stay concrete
      if (targetTypeOnly.has(resolved)) {
        if (!typeOnly) targetTypeOnly.set(resolved, false)
      } else {
        targetTypeOnly.set(resolved, typeOnly)
      }
    }

    // Populate typeOnlyImports for this file
    for (const [target, isTypeOnly] of targetTypeOnly) {
      if (isTypeOnly) {
        if (!graph.typeOnlyImports.has(relPath)) {
          graph.typeOnlyImports.set(relPath, new Set())
        }
        graph.typeOnlyImports.get(relPath)!.add(target)
      }
    }
  }

  return graph
}

export function mergeImportGraphs(graphs: ImportGraph[]): ImportGraph {
  const merged: ImportGraph = { imports: new Map(), importedBy: new Map(), typeOnlyImports: new Map() }

  for (const g of graphs) {
    for (const [k, v] of g.imports) {
      if (!merged.imports.has(k)) merged.imports.set(k, new Set())
      for (const dep of v) merged.imports.get(k)!.add(dep)
    }
    for (const [k, v] of g.importedBy) {
      if (!merged.importedBy.has(k)) merged.importedBy.set(k, new Set())
      for (const dep of v) merged.importedBy.get(k)!.add(dep)
    }
  }

  // An edge is typeOnly in merged only if it's typeOnly in every graph that contains it.
  // Two-pass: collect all typeOnly candidates, then demote any that are concrete in any graph.
  const candidateTypeOnly = new Map<string, Set<string>>()
  for (const g of graphs) {
    for (const [src, targets] of g.typeOnlyImports) {
      if (!candidateTypeOnly.has(src)) candidateTypeOnly.set(src, new Set())
      for (const tgt of targets) candidateTypeOnly.get(src)!.add(tgt)
    }
  }

  // Demote: remove any edge that is concrete (present in imports but NOT in typeOnlyImports) in any graph
  for (const g of graphs) {
    for (const [src, targets] of g.imports) {
      for (const tgt of targets) {
        const isTypeOnlyInThisGraph = g.typeOnlyImports.get(src)?.has(tgt) ?? false
        if (!isTypeOnlyInThisGraph) {
          // This edge is concrete in this graph — demote from candidates
          candidateTypeOnly.get(src)?.delete(tgt)
        }
      }
    }
  }

  for (const [src, targets] of candidateTypeOnly) {
    if (targets.size > 0) {
      merged.typeOnlyImports.set(src, new Set(targets))
    }
  }

  return merged
}
