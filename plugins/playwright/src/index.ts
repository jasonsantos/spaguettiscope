import type { ScanPlugin } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { playwrightRules } from './rules.js'

export const playwrightPlugin: ScanPlugin = {
  id: 'playwright',
  canApply,
  rules: () => playwrightRules,
}

export default playwrightPlugin
