import type { Rule } from '@spaguettiscope/core'

export const electronRules: Rule[] = [
  {
    id: 'electron:preload',
    selector: {
      path: '**/*.ts',
      content: 'contextBridge\\.exposeInMainWorld',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'preload' },
      { kind: 'concrete', key: 'layer', value: 'electron-main' },
    ],
  },
  {
    id: 'electron:main',
    selector: {
      path: '**/*.ts',
      content: 'new BrowserWindow\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'electron-main' },
      { kind: 'concrete', key: 'layer', value: 'process' },
    ],
  },
  {
    id: 'electron:renderer',
    selector: { path: 'src/renderer/**' },
    yields: [{ kind: 'concrete', key: 'layer', value: 'electron-renderer' }],
  },
]
