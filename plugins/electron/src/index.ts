import type { ScanPlugin } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { electronRules } from './rules.js'

export const electronPlugin: ScanPlugin = {
  id: 'electron',
  canApply,
  rules: () => electronRules,
}

export default electronPlugin
