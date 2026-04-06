import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SpascoConfigSchema, type SpascoConfig } from './schema.js'

const CONFIG_FILENAMES = ['spasco.config.json', 'spaguettiscope.config.json'] as const

export async function loadConfig(projectRoot: string): Promise<SpascoConfig> {
  const filename = CONFIG_FILENAMES.find(f => existsSync(join(projectRoot, f)))
  if (!filename) {
    return SpascoConfigSchema.parse({})
  }

  const configPath = join(projectRoot, filename)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    throw new Error(`Failed to parse ${filename}: invalid JSON`)
  }

  const result = SpascoConfigSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid ${filename}:\n${issues}`)
  }

  return result.data
}
