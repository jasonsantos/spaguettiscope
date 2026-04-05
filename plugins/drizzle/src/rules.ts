import type { Rule } from '@spaguettiscope/core'

export const drizzleRules: Rule[] = [
  {
    id: 'drizzle:schema',
    selector: {
      path: '**/*.ts',
      content: 'pgTable\\(|mysqlTable\\(|sqliteTable\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'schema' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
  {
    id: 'drizzle:migration-sql',
    selector: { path: '**/migrations/**/*.sql' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'migration' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
  {
    id: 'drizzle:migration-ts',
    selector: { path: '**/migrations/**/*.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'migration' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
]
