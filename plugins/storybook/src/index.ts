import type { ScanPlugin, PluginDetector } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { storybookRules } from './rules.js'

export const storybookPlugin: ScanPlugin = {
  id: 'storybook',
  canApply,
  rules: () => storybookRules,
  packageType: () => 'storybook',
}

export const detector: PluginDetector = {
  id: 'storybook',
  detect: canApply,
}

export default storybookPlugin
