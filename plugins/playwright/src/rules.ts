import type { Rule } from '@spaguettiscope/core'

export const playwrightRules: Rule[] = [
  {
    id: 'playwright:fixture',
    selector: {
      path: '**/*.ts',
      content: 'test\\.extend\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'fixture' },
      { kind: 'concrete', key: 'layer', value: 'test' },
    ],
  },
  {
    id: 'playwright:page-object',
    selector: {
      path: '**/*.ts',
      graph: { kind: 'imported-by', glob: '**/*.spec.ts' },
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'page-object' },
      { kind: 'concrete', key: 'layer', value: 'test' },
    ],
  },
]
