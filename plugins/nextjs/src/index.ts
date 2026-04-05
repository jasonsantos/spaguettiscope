import type { ScanPlugin } from '@spaguettiscope/core'
import { canApply } from './detect.js'
import { nextjsRules } from './rules.js'

export const nextjsPlugin: ScanPlugin = {
  id: 'nextjs',
  canApply,
  rules: () => nextjsRules,
}

export default nextjsPlugin
