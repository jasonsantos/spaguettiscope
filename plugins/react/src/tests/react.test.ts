import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRules } from '@spaguettiscope/core'
import { canApply } from '../detect.js'
import { reactRules } from '../rules.js'

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

describe('canApply', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `spasco-react-detect-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when react is in dependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18.0.0' } })
    )
    expect(canApply(dir)).toBe(true)
  })

  it('returns true when react is in devDependencies', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { react: '^18.0.0' } })
    )
    expect(canApply(dir)).toBe(true)
  })

  it('returns false when react is absent', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { lodash: '^4.0.0' } })
    )
    expect(canApply(dir)).toBe(false)
  })

  it('returns false when package.json does not exist', () => {
    expect(canApply(join(dir, 'nonexistent'))).toBe(false)
  })

  it('returns false when package.json is malformed', () => {
    writeFileSync(join(dir, 'package.json'), 'not json')
    expect(canApply(dir)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

describe('reactRules — hook detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-react-rules-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches a .ts hook file', () => {
    const result = runRules(['src/hooks/useAuth.ts'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:hook')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('hook')
  })

  it('matches a .tsx hook file', () => {
    const result = runRules(['src/hooks/useModal.tsx'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:hook-tsx')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('hook')
  })

  it('does not match a file not starting with use followed by uppercase', () => {
    const result = runRules(['src/hooks/userouter.ts'], reactRules, projectRoot)
    const hookCandidate = result.find(c => c.source === 'react:hook')
    expect(hookCandidate).toBeUndefined()
  })

  it('matches hook in a nested directory', () => {
    const result = runRules(['lib/shared/useDebounce.ts'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:hook')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('hook')
  })
})

describe('reactRules — context detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-react-ctx-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches a .ts file containing createContext(', () => {
    writeFileSync(
      join(projectRoot, 'AuthContext.ts'),
      "import { createContext } from 'react'\nexport const AuthCtx = createContext(null)"
    )
    const result = runRules(['AuthContext.ts'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:context-ts')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('context')
    expect(candidate!.attributes.layer).toBe('ui')
  })

  it('matches a .tsx file containing createContext(', () => {
    writeFileSync(
      join(projectRoot, 'ThemeContext.tsx'),
      "import { createContext } from 'react'\nexport const ThemeCtx = createContext({ dark: false })"
    )
    const result = runRules(['ThemeContext.tsx'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:context-tsx')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('context')
    expect(candidate!.attributes.layer).toBe('ui')
  })

  it('does not match a .ts file without createContext(', () => {
    writeFileSync(join(projectRoot, 'utils.ts'), 'export function add(a: number, b: number) { return a + b }')
    const result = runRules(['utils.ts'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:context-ts')
    expect(candidate).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Provider rules
// ---------------------------------------------------------------------------

describe('reactRules — provider detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-react-provider-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches a *Provider.tsx file', () => {
    const result = runRules(['src/providers/QueryProvider.tsx'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:provider')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('provider')
    expect(candidate!.attributes.layer).toBe('ui')
  })

  it('matches a provider in a nested directory', () => {
    const result = runRules(['components/pwa/PWAProvider.tsx'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:provider')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('provider')
  })

  it('does not match a .tsx file not ending with Provider', () => {
    const result = runRules(['components/Button.tsx'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:provider')
    expect(candidate).toBeUndefined()
  })

  it('does not match a Provider.ts file (wrong extension)', () => {
    const result = runRules(['src/QueryProvider.ts'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:provider')
    expect(candidate).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// HOC rules
// ---------------------------------------------------------------------------

describe('reactRules — HOC detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-react-hoc-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches a with[A-Z]*.ts HOC file', () => {
    const result = runRules(['src/hocs/withAuth.ts'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:hoc')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('hoc')
  })

  it('matches a with[A-Z]*.tsx HOC file', () => {
    const result = runRules(['src/hocs/withTheme.tsx'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:hoc-tsx')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('hoc')
  })

  it('matches a HOC in a nested directory', () => {
    const result = runRules(['lib/auth/withPermissions.tsx'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:hoc-tsx')
    expect(candidate).toBeDefined()
  })

  it('does not match a file starting with with but followed by lowercase', () => {
    const result = runRules(['src/withoutSomething.ts'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:hoc')
    expect(candidate).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Error boundary rules
// ---------------------------------------------------------------------------

describe('reactRules — error boundary detection', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = join(tmpdir(), `spasco-react-eb-${Date.now()}`)
    mkdirSync(projectRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('matches a .tsx file containing componentDidCatch(', () => {
    writeFileSync(
      join(projectRoot, 'ErrorBoundary.tsx'),
      `import { Component, ReactNode } from 'react'
class ErrorBoundary extends Component {
  componentDidCatch(error: Error) { console.error(error) }
  render() { return this.props.children }
}`
    )
    const result = runRules(['ErrorBoundary.tsx'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:error-boundary-tsx')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('error-boundary')
  })

  it('matches a .ts file containing componentDidCatch(', () => {
    writeFileSync(
      join(projectRoot, 'ErrorHandler.ts'),
      `class ErrorHandler { componentDidCatch(error: Error) {} }`
    )
    const result = runRules(['ErrorHandler.ts'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:error-boundary-ts')
    expect(candidate).toBeDefined()
    expect(candidate!.attributes.role).toBe('error-boundary')
  })

  it('does not match a .tsx file without componentDidCatch(', () => {
    writeFileSync(
      join(projectRoot, 'RegularComponent.tsx'),
      `export function RegularComponent() { return null }`
    )
    const result = runRules(['RegularComponent.tsx'], reactRules, projectRoot)
    const candidate = result.find(c => c.source === 'react:error-boundary-tsx')
    expect(candidate).toBeUndefined()
  })
})
