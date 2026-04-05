import type { Rule } from '@spaguettiscope/core'

export const storybookRules: Rule[] = [
  // Story files — plural form (standard convention)
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
    id: 'storybook:story-jsx',
    selector: { path: '**/*.stories.jsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'story' },
      { kind: 'concrete', key: 'layer', value: 'documentation' },
    ],
  },
  {
    id: 'storybook:story-js',
    selector: { path: '**/*.stories.js' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'story' },
      { kind: 'concrete', key: 'layer', value: 'documentation' },
    ],
  },
  // Story files — singular form (used in some projects)
  {
    id: 'storybook:story-singular-tsx',
    selector: { path: '**/*.story.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'story' },
      { kind: 'concrete', key: 'layer', value: 'documentation' },
    ],
  },
  {
    id: 'storybook:story-singular-ts',
    selector: { path: '**/*.story.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'story' },
      { kind: 'concrete', key: 'layer', value: 'documentation' },
    ],
  },
  // MDX documentation pages (plain .mdx with <Meta> from @storybook/addon-docs)
  // Covers both *.stories.mdx and plain *.mdx files that contain Storybook Meta
  {
    id: 'storybook:mdx-doc',
    selector: {
      path: '**/*.mdx',
      content: '@storybook',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'story' },
      { kind: 'concrete', key: 'layer', value: 'documentation' },
    ],
  },
  // .storybook config files — specific roles for key files
  {
    id: 'storybook:main-config',
    selector: { path: '.storybook/main.{ts,js,mts,mjs,cts,cjs}' },
    yields: [{ kind: 'concrete', key: 'role', value: 'storybook-main' }],
  },
  {
    id: 'storybook:preview-config',
    selector: { path: '.storybook/preview.{ts,tsx,js,jsx,mts,mjs}' },
    yields: [{ kind: 'concrete', key: 'role', value: 'storybook-preview' }],
  },
  {
    id: 'storybook:manager-config',
    selector: { path: '.storybook/manager.{ts,js,mts,mjs}' },
    yields: [{ kind: 'concrete', key: 'role', value: 'storybook-manager' }],
  },
  // Catch-all for remaining .storybook/* files (theme.ts, etc.)
  {
    id: 'storybook:config',
    selector: { path: '.storybook/**' },
    yields: [{ kind: 'concrete', key: 'role', value: 'storybook-config' }],
  },
  // Chromatic configuration
  {
    id: 'storybook:chromatic-config-file',
    selector: { path: 'chromatic.config.{ts,js,mts,mjs,cjs,cts}' },
    yields: [{ kind: 'concrete', key: 'role', value: 'chromatic-config' }],
  },
]
