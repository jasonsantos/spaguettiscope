import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createIntermediateCache,
  loadIntermediateCache,
  saveIntermediateCache,
} from '../../analysis/intermediates.js'

describe('IntermediateCache', () => {
  it('returns undefined for unknown keys', () => {
    const cache = createIntermediateCache()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('stores and retrieves a value', () => {
    const cache = createIntermediateCache()
    cache.set('my-key', { count: 42 })
    expect(cache.get('my-key')).toEqual({ count: 42 })
  })

  it('overwrites an existing key', () => {
    const cache = createIntermediateCache()
    cache.set('k', 'first')
    cache.set('k', 'second')
    expect(cache.get('k')).toBe('second')
  })
})

describe('loadIntermediateCache / saveIntermediateCache', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `spasco-cache-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty cache when file does not exist', () => {
    const cache = loadIntermediateCache(join(tmpDir, 'intermediates.json'))
    expect(cache.get('x')).toBeUndefined()
  })

  it('round-trips values through save and load', () => {
    const path = join(tmpDir, 'intermediates.json')
    const cache = createIntermediateCache()
    cache.set('coverage-matrix', { 'src/auth.ts': ['src/auth.test.ts'] })
    saveIntermediateCache(path, cache)
    const loaded = loadIntermediateCache(path)
    expect(loaded.get('coverage-matrix')).toEqual({ 'src/auth.ts': ['src/auth.test.ts'] })
  })

  it('creates parent directory when saving to a nested path', () => {
    const path = join(tmpDir, 'nested', 'intermediates.json')
    const cache = createIntermediateCache()
    cache.set('k', 1)
    saveIntermediateCache(path, cache)
    expect(existsSync(path)).toBe(true)
  })
})
