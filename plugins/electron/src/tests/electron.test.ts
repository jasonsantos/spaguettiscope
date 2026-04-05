import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { electronPlugin } from '../index.js'

describe('electronPlugin.canApply', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-electron-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when electron is in dependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { electron: '30.0.0' } })
    )
    expect(electronPlugin.canApply(dir)).toBe(true)
  })

  it('returns true when electron is in devDependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'app', devDependencies: { electron: '30.0.0' } })
    )
    expect(electronPlugin.canApply(dir)).toBe(true)
  })

  it('returns false when electron is not present', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { react: '18.0.0' } })
    )
    expect(electronPlugin.canApply(dir)).toBe(false)
  })

  it('returns false when package.json does not exist', () => {
    expect(electronPlugin.canApply(dir)).toBe(false)
  })
})

describe('electronPlugin.rules', () => {
  it('returns rules array with expected ids', () => {
    const rules = electronPlugin.rules()
    const ids = rules.map(r => r.id)
    expect(ids).toContain('electron:preload')
    expect(ids).toContain('electron:main')
    expect(ids).toContain('electron:renderer')
  })

  it('preload rule has content predicate matching contextBridge.exposeInMainWorld', () => {
    const rules = electronPlugin.rules()
    const rule = rules.find(r => r.id === 'electron:preload')!
    expect(rule.selector.content).toBeDefined()
    expect(new RegExp(rule.selector.content!).test('contextBridge.exposeInMainWorld')).toBe(true)
  })

  it('preload rule yields role=preload and layer=electron-main', () => {
    const rules = electronPlugin.rules()
    const rule = rules.find(r => r.id === 'electron:preload')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'preload' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-main' })
  })

  it('main rule has content predicate matching new BrowserWindow(', () => {
    const rules = electronPlugin.rules()
    const rule = rules.find(r => r.id === 'electron:main')!
    expect(rule.selector.content).toBeDefined()
    expect(new RegExp(rule.selector.content!).test('new BrowserWindow(')).toBe(true)
  })

  it('main rule yields role=electron-main and layer=process', () => {
    const rules = electronPlugin.rules()
    const rule = rules.find(r => r.id === 'electron:main')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'electron-main' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'process' })
  })

  it('renderer rule has correct path selector and yields layer=electron-renderer', () => {
    const rules = electronPlugin.rules()
    const rule = rules.find(r => r.id === 'electron:renderer')!
    expect(rule.selector.path).toBe('src/renderer/**')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-renderer' })
  })
})
