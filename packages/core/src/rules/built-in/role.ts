import type { Rule } from '../types.js'

export const builtInRoleRules: Rule[] = [
  {
    id: 'built-in:role:e2e-dir',
    selector: { path: 'e2e/**' },
    yields: [{ kind: 'concrete', key: 'role', value: 'e2e' }],
  },
  {
    id: 'built-in:role:e2e-ts',
    selector: { path: '**/*.e2e.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'e2e' }],
  },
  {
    id: 'built-in:role:e2e-tsx',
    selector: { path: '**/*.e2e.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'e2e' }],
  },
  {
    id: 'built-in:role:mock',
    selector: { path: '**/__mocks__/**' },
    yields: [{ kind: 'concrete', key: 'role', value: 'mock' }],
  },
  {
    id: 'built-in:role:test-dir',
    selector: { path: '**/__tests__/**' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
  {
    id: 'built-in:role:test-ts',
    selector: { path: '**/*.test.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
  {
    id: 'built-in:role:test-tsx',
    selector: { path: '**/*.test.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
  {
    id: 'built-in:role:spec-ts',
    selector: { path: '**/*.spec.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
  {
    id: 'built-in:role:spec-tsx',
    selector: { path: '**/*.spec.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'test' }],
  },
  {
    id: 'built-in:role:bdd-spec',
    selector: { path: '**/*.feature' },
    yields: [{ kind: 'concrete', key: 'role', value: 'bdd-spec' }],
  },
]
