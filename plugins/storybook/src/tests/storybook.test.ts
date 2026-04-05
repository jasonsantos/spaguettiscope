import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { storybookPlugin } from '../index.js'

describe('storybookPlugin.canApply', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-storybook-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when storybook is in dependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { storybook: '8.0.0' } })
    )
    expect(storybookPlugin.canApply(dir)).toBe(true)
  })

  it('returns true when @storybook/react is in devDependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'web', devDependencies: { '@storybook/react': '8.0.0' } })
    )
    expect(storybookPlugin.canApply(dir)).toBe(true)
  })

  it('returns true when @storybook/nextjs is in devDependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'web', devDependencies: { '@storybook/nextjs': '8.0.0' } })
    )
    expect(storybookPlugin.canApply(dir)).toBe(true)
  })

  it('returns false when no storybook-related package is present', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'api', dependencies: { express: '4.0.0' } })
    )
    expect(storybookPlugin.canApply(dir)).toBe(false)
  })

  it('returns false when package.json does not exist', () => {
    expect(storybookPlugin.canApply(dir)).toBe(false)
  })
})

describe('storybookPlugin.rules', () => {
  it('returns rules array with expected ids', () => {
    const rules = storybookPlugin.rules()
    const ids = rules.map(r => r.id)
    expect(ids).toContain('storybook:story-tsx')
    expect(ids).toContain('storybook:story-ts')
    expect(ids).toContain('storybook:config')
  })

  it('story-tsx rule yields role=story and layer=documentation', () => {
    const rules = storybookPlugin.rules()
    const rule = rules.find(r => r.id === 'storybook:story-tsx')!
    expect(rule.selector.path).toBe('**/*.stories.tsx')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'story' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'documentation' })
  })

  it('story-ts rule yields role=story and layer=documentation', () => {
    const rules = storybookPlugin.rules()
    const rule = rules.find(r => r.id === 'storybook:story-ts')!
    expect(rule.selector.path).toBe('**/*.stories.ts')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'story' })
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'layer', value: 'documentation' })
  })

  it('config rule has correct path selector and yields role=storybook-config', () => {
    const rules = storybookPlugin.rules()
    const rule = rules.find(r => r.id === 'storybook:config')!
    expect(rule.selector.path).toBe('.storybook/**')
    expect(rule.yields).toContainEqual({ kind: 'concrete', key: 'role', value: 'storybook-config' })
  })
})
