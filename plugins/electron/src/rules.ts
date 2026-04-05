import type { Rule } from '@spaguettiscope/core'

export const electronRules: Rule[] = [
  // --- Main process entry ---
  {
    id: 'electron:main',
    selector: {
      path: '**/*.ts',
      content: 'new BrowserWindow\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'electron-main' },
      { kind: 'concrete', key: 'layer', value: 'electron-main' },
    ],
  },

  // --- Preload scripts ---
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

  // --- IPC handlers (main process) ---
  {
    id: 'electron:ipc-handler',
    selector: {
      path: '**/*.ts',
      content: 'ipcMain\\.handle\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'ipc-handler' },
      { kind: 'concrete', key: 'layer', value: 'electron-main' },
    ],
  },

  // --- IPC on-listeners (main process, fire-and-forget) ---
  {
    id: 'electron:ipc-listener',
    selector: {
      path: '**/*.ts',
      content: 'ipcMain\\.on\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'ipc-handler' },
      { kind: 'concrete', key: 'layer', value: 'electron-main' },
    ],
  },

  // --- IPC invokers (preload / renderer) ---
  {
    id: 'electron:ipc-invoker',
    selector: {
      path: '**/*.ts',
      content: 'ipcRenderer\\.invoke\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'ipc-invoker' },
      { kind: 'concrete', key: 'layer', value: 'electron-renderer' },
    ],
  },

  // --- IPC send (renderer → main, no reply) ---
  {
    id: 'electron:ipc-sender',
    selector: {
      path: '**/*.ts',
      content: 'ipcRenderer\\.send\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'ipc-invoker' },
      { kind: 'concrete', key: 'layer', value: 'electron-renderer' },
    ],
  },

  // --- electron-store (key-value persistence) ---
  {
    id: 'electron:store',
    selector: {
      path: '**/*.ts',
      content: 'electron-store',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'storage' },
      { kind: 'concrete', key: 'layer', value: 'electron-main' },
    ],
  },

  // --- better-sqlite3 (embedded SQL database) ---
  {
    id: 'electron:db-client',
    selector: {
      path: '**/*.ts',
      content: 'better-sqlite3',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'db-client' },
      { kind: 'concrete', key: 'layer', value: 'electron-main' },
    ],
  },

  // --- File watcher (chokidar) ---
  {
    id: 'electron:file-watcher',
    selector: {
      path: '**/*.ts',
      content: 'chokidar',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'file-watcher' },
      { kind: 'concrete', key: 'layer', value: 'electron-main' },
    ],
  },

  // --- Auto-updater ---
  {
    id: 'electron:auto-updater',
    selector: {
      path: '**/*.ts',
      content: 'autoUpdater',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'auto-updater' },
      { kind: 'concrete', key: 'layer', value: 'electron-main' },
    ],
  },

  // --- Renderer layer (broad) ---
  {
    id: 'electron:renderer',
    selector: { path: 'src/renderer/**' },
    yields: [{ kind: 'concrete', key: 'layer', value: 'electron-renderer' }],
  },

  // --- Renderer screens ---
  {
    id: 'electron:screen',
    selector: { path: 'src/renderer/screens/**' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'screen' },
      { kind: 'concrete', key: 'layer', value: 'electron-renderer' },
    ],
  },

  // --- Renderer hooks ---
  {
    id: 'electron:hook',
    selector: { path: 'src/renderer/hooks/**' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'hook' },
      { kind: 'concrete', key: 'layer', value: 'electron-renderer' },
    ],
  },
]
