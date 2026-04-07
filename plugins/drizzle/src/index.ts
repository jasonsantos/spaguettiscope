import type { ScanPlugin, PluginDetector } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { drizzleRules } from './rules.js'

export const drizzlePlugin: ScanPlugin = {
  id: 'drizzle',
  canApply,
  rules: () => drizzleRules,
  packageType: () => 'drizzle',
}

export const detector: PluginDetector = {
  id: 'drizzle',
  detect: canApply,
}

export default drizzlePlugin
