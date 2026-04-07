import type { ScanPlugin } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { storybookRules } from './rules.js'

export const storybookPlugin: ScanPlugin = {
  id: 'storybook',
  canApply,
  rules: () => storybookRules,
  packageType: () => 'storybook',
}

export default storybookPlugin
