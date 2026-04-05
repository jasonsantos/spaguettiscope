import { describe, it, expect } from 'vitest'
import { runRules } from '../../../rules/runner.js'
import { builtInRoleRules } from '../../../rules/built-in/role.js'

describe('builtInRoleRules', () => {
  const projectRoot = '/project'

  it('assigns role=test to *.test.ts', () => {
    const r = runRules(['src/auth/auth.test.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=test to *.test.tsx', () => {
    const r = runRules(['src/Button.test.tsx'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=test to *.spec.ts', () => {
    const r = runRules(['src/auth/auth.spec.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=test to *.spec.tsx', () => {
    const r = runRules(['src/Button.spec.tsx'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=test to files under __tests__/', () => {
    const r = runRules(['src/__tests__/util.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'test')).toBe(true)
  })

  it('assigns role=mock to files under __mocks__/', () => {
    const r = runRules(['src/__mocks__/api.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'mock')).toBe(true)
  })

  it('assigns role=e2e to *.e2e.ts', () => {
    const r = runRules(['tests/login.e2e.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'e2e')).toBe(true)
  })

  it('assigns role=e2e to *.e2e.tsx', () => {
    const r = runRules(['tests/login.e2e.tsx'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'e2e')).toBe(true)
  })

  it('assigns role=e2e to files under e2e/', () => {
    const r = runRules(['e2e/flows/checkout.ts'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'e2e')).toBe(true)
  })

  it('assigns role=bdd-spec to *.feature files', () => {
    const r = runRules(['some/path/file.feature'], builtInRoleRules, projectRoot)
    expect(r.some(c => c.attributes.role === 'bdd-spec')).toBe(true)
  })
})
