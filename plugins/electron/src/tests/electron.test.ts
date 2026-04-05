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
  it('returns rules array with all expected ids', () => {
    const rules = electronPlugin.rules()
    const ids = rules.map(r => r.id)
    expect(ids).toContain('electron:preload')
    expect(ids).toContain('electron:main')
    expect(ids).toContain('electron:ipc-handler')
    expect(ids).toContain('electron:ipc-listener')
    expect(ids).toContain('electron:ipc-invoker')
    expect(ids).toContain('electron:ipc-sender')
    expect(ids).toContain('electron:store')
    expect(ids).toContain('electron:db-client')
    expect(ids).toContain('electron:file-watcher')
    expect(ids).toContain('electron:auto-updater')
    expect(ids).toContain('electron:renderer')
    expect(ids).toContain('electron:screen')
    expect(ids).toContain('electron:hook')
  })

  // --- electron:main ---

  it('main rule matches new BrowserWindow(', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:main')!
    expect(new RegExp(rule.selector.content!).test('new BrowserWindow(')).toBe(true)
  })

  it('main rule yields role=electron-main and layer=electron-main', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:main')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'electron-main' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-main' })
  })

  // --- electron:preload ---

  it('preload rule matches contextBridge.exposeInMainWorld', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:preload')!
    expect(new RegExp(rule.selector.content!).test('contextBridge.exposeInMainWorld')).toBe(true)
  })

  it('preload rule yields role=preload and layer=electron-main', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:preload')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'preload' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-main' })
  })

  // --- electron:ipc-handler ---

  it('ipc-handler rule matches ipcMain.handle(', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:ipc-handler')!
    expect(rule.selector.content).toBeDefined()
    expect(new RegExp(rule.selector.content!).test('ipcMain.handle(')).toBe(true)
  })

  it('ipc-handler rule does not match ipcRenderer.invoke(', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:ipc-handler')!
    expect(new RegExp(rule.selector.content!).test('ipcRenderer.invoke(')).toBe(false)
  })

  it('ipc-handler rule yields role=ipc-handler and layer=electron-main', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:ipc-handler')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'ipc-handler' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-main' })
  })

  // --- electron:ipc-listener ---

  it('ipc-listener rule matches ipcMain.on(', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:ipc-listener')!
    expect(new RegExp(rule.selector.content!).test('ipcMain.on(')).toBe(true)
  })

  it('ipc-listener rule yields role=ipc-handler and layer=electron-main', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:ipc-listener')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'ipc-handler' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-main' })
  })

  // --- electron:ipc-invoker ---

  it('ipc-invoker rule matches ipcRenderer.invoke(', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:ipc-invoker')!
    expect(new RegExp(rule.selector.content!).test('ipcRenderer.invoke(')).toBe(true)
  })

  it('ipc-invoker rule yields role=ipc-invoker and layer=electron-renderer', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:ipc-invoker')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'ipc-invoker' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-renderer' })
  })

  // --- electron:ipc-sender ---

  it('ipc-sender rule matches ipcRenderer.send(', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:ipc-sender')!
    expect(new RegExp(rule.selector.content!).test('ipcRenderer.send(')).toBe(true)
  })

  it('ipc-sender rule yields role=ipc-invoker and layer=electron-renderer', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:ipc-sender')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'ipc-invoker' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-renderer' })
  })

  // --- electron:store ---

  it('store rule matches electron-store import', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:store')!
    expect(new RegExp(rule.selector.content!).test("import Store from 'electron-store'")).toBe(true)
  })

  it('store rule yields role=storage and layer=electron-main', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:store')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'storage' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-main' })
  })

  // --- electron:db-client ---

  it('db-client rule matches better-sqlite3 import', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:db-client')!
    expect(new RegExp(rule.selector.content!).test("import Database from 'better-sqlite3'")).toBe(true)
  })

  it('db-client rule yields role=db-client and layer=electron-main', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:db-client')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'db-client' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-main' })
  })

  // --- electron:file-watcher ---

  it('file-watcher rule matches chokidar import', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:file-watcher')!
    expect(new RegExp(rule.selector.content!).test("import chokidar from 'chokidar'")).toBe(true)
  })

  it('file-watcher rule yields role=file-watcher and layer=electron-main', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:file-watcher')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'file-watcher' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-main' })
  })

  // --- electron:auto-updater ---

  it('auto-updater rule matches autoUpdater usage', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:auto-updater')!
    expect(new RegExp(rule.selector.content!).test('autoUpdater.checkForUpdatesAndNotify()')).toBe(true)
  })

  it('auto-updater rule yields role=auto-updater and layer=electron-main', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:auto-updater')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'auto-updater' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-main' })
  })

  // --- electron:renderer ---

  it('renderer rule has path src/renderer/** and yields layer=electron-renderer', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:renderer')!
    expect(rule.selector.path).toBe('src/renderer/**')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-renderer' })
  })

  // --- electron:screen ---

  it('screen rule has path src/renderer/screens/**', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:screen')!
    expect(rule.selector.path).toBe('src/renderer/screens/**')
  })

  it('screen rule yields role=screen and layer=electron-renderer', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:screen')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'screen' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-renderer' })
  })

  // --- electron:hook ---

  it('hook rule has path src/renderer/hooks/**', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:hook')!
    expect(rule.selector.path).toBe('src/renderer/hooks/**')
  })

  it('hook rule yields role=hook and layer=electron-renderer', () => {
    const rule = electronPlugin.rules().find(r => r.id === 'electron:hook')!
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'hook' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'electron-renderer' })
  })
})
