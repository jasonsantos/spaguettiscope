import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { IntermediateCache } from './types.js'

export function createIntermediateCache(): IntermediateCache & {
  toJSON(): Record<string, unknown>
} {
  const store = new Map<string, unknown>()

  return {
    get<T>(key: string): T | undefined {
      return store.get(key) as T | undefined
    },
    set<T>(key: string, value: T): void {
      store.set(key, value)
    },
    toJSON(): Record<string, unknown> {
      return Object.fromEntries(store)
    },
  }
}

export function loadIntermediateCache(
  filePath: string
): IntermediateCache & { toJSON(): Record<string, unknown> } {
  const cache = createIntermediateCache()
  if (!existsSync(filePath)) return cache
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
    for (const [k, v] of Object.entries(raw)) {
      cache.set(k, v)
    }
  } catch {
    // corrupted cache — start fresh
  }
  return cache
}

export function saveIntermediateCache(
  filePath: string,
  cache: IntermediateCache & { toJSON(): Record<string, unknown> }
): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(cache.toJSON(), null, 2))
}
