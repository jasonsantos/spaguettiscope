import type { ScanPlugin, PluginDetector } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { nextjsRules } from './rules.js'

export const nextjsPlugin: ScanPlugin = {
  id: 'nextjs',
  canApply,
  rules: () => nextjsRules,
  packageType: () => 'nextjs',
}

export const detector: PluginDetector = {
  id: 'nextjs',
  detect: canApply,
}

export default nextjsPlugin
