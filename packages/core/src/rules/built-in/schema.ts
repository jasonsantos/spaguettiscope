import type { Rule } from '../types.js'

export const builtInSchemaRules: Rule[] = [
  {
    id: 'built-in:schema:zod',
    selector: {
      path: '**/*.ts',
      content: 'z\\.object\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'schema' },
      { kind: 'concrete', key: 'layer', value: 'validation' },
    ],
  },
]
