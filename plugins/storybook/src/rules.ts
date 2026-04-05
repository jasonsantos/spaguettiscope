import type { Rule } from '@spaguettiscope/core'

export const storybookRules: Rule[] = [
  {
    id: 'storybook:story-tsx',
    selector: { path: '**/*.stories.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'story' },
      { kind: 'concrete', key: 'layer', value: 'documentation' },
    ],
  },
  {
    id: 'storybook:story-ts',
    selector: { path: '**/*.stories.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'story' },
      { kind: 'concrete', key: 'layer', value: 'documentation' },
    ],
  },
  {
    id: 'storybook:config',
    selector: { path: '.storybook/**' },
    yields: [{ kind: 'concrete', key: 'role', value: 'storybook-config' }],
  },
]
