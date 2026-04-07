import type { ScanPlugin, PluginDetector } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { reactRules } from './rules.js'

export const reactPlugin: ScanPlugin = {
  id: 'react',
  canApply,
  rules: () => reactRules,
  packageType: () => 'react',
}

export const detector: PluginDetector = {
  id: 'react',
  detect: canApply,
}

export default reactPlugin
