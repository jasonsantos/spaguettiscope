import type { Rule } from '@spaguettiscope/core'

export const reactRules: Rule[] = [
  {
    id: 'react:hook',
    selector: { path: '**/use[A-Z]*.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'hook' }],
  },
  {
    id: 'react:hook-tsx',
    selector: { path: '**/use[A-Z]*.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'hook' }],
  },
  {
    id: 'react:context-ts',
    selector: {
      path: '**/*.ts',
      content: 'createContext\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'context' },
      { kind: 'concrete', key: 'layer', value: 'ui' },
    ],
  },
  {
    id: 'react:context-tsx',
    selector: {
      path: '**/*.tsx',
      content: 'createContext\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'context' },
      { kind: 'concrete', key: 'layer', value: 'ui' },
    ],
  },
]
