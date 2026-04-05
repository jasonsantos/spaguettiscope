import type { Rule } from '@spaguettiscope/core'

export const prismaRules: Rule[] = [
  {
    id: 'prisma:schema',
    selector: { path: '**/schema.prisma' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'schema' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
  {
    id: 'prisma:migration',
    selector: { path: '**/migrations/**' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'migration' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
  {
    id: 'prisma:seed',
    selector: { path: '**/seed.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'seed' },
      { kind: 'concrete', key: 'layer', value: 'data' },
    ],
  },
]
