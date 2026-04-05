import type { ScanPlugin } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { reactRules } from './rules.js'

export const reactPlugin: ScanPlugin = {
  id: 'react',
  canApply,
  rules: () => reactRules,
}

export default reactPlugin
