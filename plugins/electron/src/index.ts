import type { ScanPlugin, PluginDetector } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { electronRules } from './rules.js'

export const electronPlugin: ScanPlugin = {
  id: 'electron',
  canApply,
  rules: () => electronRules,
  packageType: () => 'electron',
}

export const detector: PluginDetector = {
  id: 'electron',
  detect: canApply,
}

export default electronPlugin
