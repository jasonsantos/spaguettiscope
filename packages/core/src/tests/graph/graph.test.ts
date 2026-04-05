import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildImportGraph, mergeImportGraphs } from '../../graph/index.js'

describe('buildImportGraph', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-graph-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function write(relPath: string, content: string) {
    const abs = join(dir, relPath)
    mkdirSync(abs.substring(0, abs.lastIndexOf('/')), { recursive: true })
    writeFileSync(abs, content)
  }

  it('records import edge from importer to imported', () => {
    write('src/index.ts', "import { foo } from './utils'")
    write('src/utils.ts', 'export const foo = 1')

    const graph = buildImportGraph(dir, ['src/index.ts', 'src/utils.ts'], dir)

    expect(graph.imports.get('src/index.ts')).toContain('src/utils.ts')
    expect(graph.importedBy.get('src/utils.ts')).toContain('src/index.ts')
  })

  it('skips node_modules imports', () => {
    write('src/index.ts', "import React from 'react'")

    const graph = buildImportGraph(dir, ['src/index.ts'], dir)

    expect(graph.imports.get('src/index.ts')?.size).toBe(0)
  })

  it('file with no imports has empty Set in imports', () => {
    write('src/types.ts', 'export type Foo = string')

    const graph = buildImportGraph(dir, ['src/types.ts'], dir)

    expect(graph.imports.has('src/types.ts')).toBe(true)
    expect(graph.imports.get('src/types.ts')!.size).toBe(0)
  })

  it('resolves .ts extension', () => {
    write('src/a.ts', "import { b } from './b'")
    write('src/b.ts', 'export const b = 2')

    const graph = buildImportGraph(dir, ['src/a.ts', 'src/b.ts'], dir)

    expect(graph.imports.get('src/a.ts')).toContain('src/b.ts')
  })

  it('resolves /index.ts', () => {
    write('src/a.ts', "import { x } from './lib'")
    write('src/lib/index.ts', 'export const x = 3')

    const graph = buildImportGraph(dir, ['src/a.ts', 'src/lib/index.ts'], dir)

    expect(graph.imports.get('src/a.ts')).toContain('src/lib/index.ts')
  })

  it('captures re-export with source', () => {
    write('src/a.ts', "export { foo } from './utils'")
    write('src/utils.ts', 'export const foo = 1')

    const graph = buildImportGraph(dir, ['src/a.ts', 'src/utils.ts'], dir)

    expect(graph.imports.get('src/a.ts')).toContain('src/utils.ts')
  })

  it('captures require() calls', () => {
    write('src/a.js', "const utils = require('./utils')")
    write('src/utils.js', 'module.exports = {}')

    const graph = buildImportGraph(dir, ['src/a.js', 'src/utils.js'], dir)

    expect(graph.imports.get('src/a.js')).toContain('src/utils.js')
  })

  it('silently skips unresolvable imports', () => {
    write('src/a.ts', "import { x } from './missing'")

    const graph = buildImportGraph(dir, ['src/a.ts'], dir)

    expect(graph.imports.get('src/a.ts')!.size).toBe(0)
  })
})

describe('mergeImportGraphs', () => {
  it('merges two disjoint graphs', () => {
    const g1 = {
      imports: new Map([['a.ts', new Set(['b.ts'])]]),
      importedBy: new Map([['b.ts', new Set(['a.ts'])]]),
    }
    const g2 = {
      imports: new Map([['c.ts', new Set(['d.ts'])]]),
      importedBy: new Map([['d.ts', new Set(['c.ts'])]]),
    }

    const merged = mergeImportGraphs([g1, g2])

    expect(merged.imports.get('a.ts')).toContain('b.ts')
    expect(merged.imports.get('c.ts')).toContain('d.ts')
  })
})
