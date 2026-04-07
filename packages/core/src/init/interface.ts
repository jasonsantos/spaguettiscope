// packages/core/src/init/interface.ts
import type { ConnectorConfig } from '../config/schema.js'

export interface DetectedConnector {
  config: ConnectorConfig
  source: string // human-readable: "found at .spasco/vitest-core.json"
}

export interface InitDetector {
  readonly connectorId: string
  detect(packageRoot: string, projectRoot: string): DetectedConnector[]
}

export interface PluginDetector {
  readonly id: string
  detect(packageRoot: string, projectRoot: string): boolean
}
