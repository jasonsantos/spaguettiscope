import type { Rule } from '@spaguettiscope/core'

export const nextjsRules: Rule[] = [
  {
    id: 'nextjs:api-endpoint',
    selector: { path: 'app/api/($1)/**/route.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'api-endpoint' },
      { kind: 'concrete', key: 'layer', value: 'bff' },
      { kind: 'extracted', key: 'domain', capture: 1 },
    ],
  },
  {
    id: 'nextjs:page',
    selector: { path: 'app/($1)/**/page.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'page' },
      { kind: 'extracted', key: 'domain', capture: 1 },
    ],
  },
  {
    id: 'nextjs:layout',
    selector: { path: 'app/($1)/**/layout.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'layout' },
      { kind: 'extracted', key: 'domain', capture: 1 },
    ],
  },
  {
    id: 'nextjs:client-component',
    selector: {
      path: '**/*.tsx',
      content: "^['\"]use client['\"]",
    },
    yields: [{ kind: 'concrete', key: 'layer', value: 'client-component' }],
  },
  {
    id: 'nextjs:middleware',
    selector: { path: 'middleware.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'middleware' }],
  },
]
