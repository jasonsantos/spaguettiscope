import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRules } from '../../../rules/runner.js'
import { builtInSchemaRules } from '../../../rules/built-in/schema.js'

describe('builtInSchemaRules', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-schema-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('assigns role=schema and layer=validation to a .ts file with z.object( near the top', () => {
    writeFileSync(
      join(projectRoot, 'user.schema.ts'),
      "import { z } from 'zod'\nexport const UserSchema = z.object({ id: z.string() })"
    )
    const r = runRules(['user.schema.ts'], builtInSchemaRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'schema')).toBe(true)
    expect(r.some(c => c.attributes.layer === 'validation')).toBe(true)
  })

  it('does NOT assign schema to a .ts file with z.object( past the first 200 chars', () => {
    const padding = 'x'.repeat(200)
    writeFileSync(
      join(projectRoot, 'util.ts'),
      `// ${padding}\nexport const Schema = z.object({ id: z.string() })`
    )
    const r = runRules(['util.ts'], builtInSchemaRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'schema')).toBe(false)
  })

  it('does NOT assign schema to a .ts file without z.object(', () => {
    writeFileSync(
      join(projectRoot, 'service.ts'),
      "export function doSomething() { return true }"
    )
    const r = runRules(['service.ts'], builtInSchemaRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'schema')).toBe(false)
  })
})
